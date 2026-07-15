import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function waSendText(phoneNumberId, token, to, text) {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) console.error("WA send REJECTED:", res.status, JSON.stringify(data));
    return { ok: res.ok, id: data?.messages?.[0]?.id ?? null, error: res.ok ? null : data };
  } catch (e) {
    return { ok: false, id: null, error: String(e) };
  }
}

async function waSendTemplate(phoneNumberId, token, to, templateName, lang) {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to, type: "template",
        template: { name: templateName, language: { code: lang || "es" } },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) console.error("WA template REJECTED:", res.status, JSON.stringify(data));
    return { ok: res.ok, id: data?.messages?.[0]?.id ?? null, error: res.ok ? null : data };
  } catch (e) {
    return { ok: false, id: null, error: String(e) };
  }
}

// Sube el binario a la Media API de Meta y devuelve el media id
async function uploadMediaToMeta(phoneNumberId, token, bytes, mime) {
  try {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("file", new Blob([bytes], { type: mime }), "upload");
    form.append("type", mime);
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { console.error("Meta media upload failed", res.status, JSON.stringify(data)); return { id: null, error: data }; }
    return { id: data?.id ?? null, error: null };
  } catch (e) {
    return { id: null, error: String(e) };
  }
}

async function waSendImage(phoneNumberId, token, to, mediaId, caption) {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to, type: "image",
        image: caption ? { id: mediaId, caption } : { id: mediaId },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) console.error("WA image REJECTED:", res.status, JSON.stringify(data));
    return { ok: res.ok, id: data?.messages?.[0]?.id ?? null, error: res.ok ? null : data };
  } catch (e) {
    return { ok: false, id: null, error: String(e) };
  }
}

const renderTemplate = (tmpl, vars) =>
  tmpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");

const errText = (err) => {
  if (!err) return null;
  if (typeof err === "string") return err.slice(0, 400);
  const m = err?.error?.message || err?.message;
  const c = err?.error?.code;
  return (m ? `[${c ?? "?"}] ${m}` : JSON.stringify(err)).slice(0, 400);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let payload;
  try { payload = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const { event, conversation_id, body: msgBody, task_title, task_desc, use_template, media_path, caption } = payload || {};
  if (!conversation_id) return json({ error: "conversation_id requerido" }, 400);

  const { data: conv } = await admin
    .from("chat_conversations").select("*").eq("id", conversation_id).maybeSingle();
  if (!conv) return json({ error: "Conversacion no encontrada" }, 404);

  const { data: cfg } = await admin
    .from("whatsapp_config").select("*").eq("account_id", conv.account_id).maybeSingle();
  if (!cfg || !cfg.is_enabled || !cfg.access_token || !cfg.phone_number_id) {
    return json({ error: "WhatsApp no esta configurado para esta cuenta" }, 400);
  }

  let text = "";
  let authorType = "AGENT";
  let authorUser = null;

  if (event === "task_completed") {
    text = renderTemplate(cfg.task_completed_template || 'Tu solicitud "{{tarea}}" se ha completado.', {
      contacto: conv.contact_name || "",
      tarea: task_title || "",
      descripcion: task_desc || "",
    });
    authorType = "SYSTEM";
  } else {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "No autenticado" }, 401);

    const { data: ua } = await admin
      .from("user_accounts").select("roles(code)").eq("user_id", user.id).eq("account_id", conv.account_id).maybeSingle();
    const roleCode = ua?.roles?.code;
    let allowed = roleCode === "MANAGER" || roleCode === "MASTER_ADMIN" || conv.assigned_to === user.id;
    if (!allowed) {
      // Miembros asignados a la conversación (multi-asignación)
      const { data: mem } = await admin
        .from("chat_conversation_members").select("user_id")
        .eq("conversation_id", conv.id).eq("user_id", user.id).maybeSingle();
      allowed = !!mem;
    }
    if (!allowed) return json({ error: "Sin permiso para esta conversacion" }, 403);

    authorUser = user.id;
    if (use_template) {
      if (!cfg.reopen_template_name) return json({ error: "No hay plantilla de reapertura configurada" }, 400);
    } else if (!media_path) {
      text = (msgBody || "").trim();
      if (!text) return json({ error: "Mensaje vacio" }, 400);
    }
  }

  // ─── Envío de imagen (desde storage) ───
  if (media_path && event !== "task_completed") {
    const { data: file, error: dlErr } = await admin.storage.from("chat-media").download(media_path);
    if (dlErr || !file) return json({ error: "No se pudo leer el adjunto" }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = (file as any).type || "image/jpeg";
    const up = await uploadMediaToMeta(cfg.phone_number_id, cfg.access_token, bytes, mime);
    if (!up.id) return json({ error: errText(up.error) || "Fallo al subir la imagen a Meta" }, 400);
    const result = await waSendImage(cfg.phone_number_id, cfg.access_token, conv.contact_phone, up.id, (caption || "").trim());
    const detail = result.ok ? null : errText(result.error);
    await admin.from("chat_messages").insert({
      account_id: conv.account_id, conversation_id, direction: "OUT",
      author_type: authorType, author_user_id: authorUser,
      body: (caption || "").trim(), message_type: "image", media_url: media_path, media_mime: mime,
      wa_message_id: result.id, status: result.ok ? "SENT" : "FAILED", error_detail: detail,
    });
    await admin.from("chat_conversations").update({
      last_message_at: new Date().toISOString(), last_message_preview: (caption || "📷 Foto").slice(0, 120), last_direction: "OUT",
      // La respuesta de un agente marca la conversación como atendida
      ...(authorType === "AGENT" ? { status: "HUMAN" } : {}),
    }).eq("id", conversation_id);
    return json({ ok: result.ok, error: detail });
  }

  const result = use_template
    ? await waSendTemplate(cfg.phone_number_id, cfg.access_token, conv.contact_phone, cfg.reopen_template_name, cfg.reopen_template_lang)
    : await waSendText(cfg.phone_number_id, cfg.access_token, conv.contact_phone, text);
  const detail = result.ok ? null : errText(result.error);
  const bodyToStore = use_template ? `\u{1F4CB} Plantilla enviada: ${cfg.reopen_template_name}` : text;

  await admin.from("chat_messages").insert({
    account_id: conv.account_id,
    conversation_id,
    direction: "OUT",
    author_type: authorType,
    author_user_id: authorUser,
    body: bodyToStore,
    wa_message_id: result.id,
    status: result.ok ? "SENT" : "FAILED",
    error_detail: detail,
  });

  await admin.from("chat_conversations").update({
    last_message_at: new Date().toISOString(),
    last_message_preview: bodyToStore.slice(0, 120),
    last_direction: "OUT",
    // La respuesta de un agente marca la conversación como atendida
    ...(authorType === "AGENT" ? { status: "HUMAN" } : {}),
  }).eq("id", conversation_id);

  return json({ ok: result.ok, error: detail });
});
