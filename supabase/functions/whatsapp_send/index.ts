import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function waSendText(phoneNumberId: string, token: string, to: string, text: string) {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, id: (data as any)?.messages?.[0]?.id ?? null, error: res.ok ? null : data };
  } catch (e) {
    return { ok: false, id: null, error: String(e) };
  }
}

const renderTemplate = (tmpl: string, vars: Record<string, string>) =>
  tmpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const { event, conversation_id, body: msgBody, task_title } = payload || {};
  if (!conversation_id) return json({ error: "conversation_id requerido" }, 400);

  const { data: conv } = await admin
    .from("chat_conversations").select("*").eq("id", conversation_id).maybeSingle();
  if (!conv) return json({ error: "Conversación no encontrada" }, 404);

  const { data: cfg } = await admin
    .from("whatsapp_config").select("*").eq("account_id", conv.account_id).maybeSingle();
  if (!cfg || !cfg.is_enabled || !cfg.access_token || !cfg.phone_number_id) {
    return json({ error: "WhatsApp no está configurado para esta cuenta" }, 400);
  }

  let text = "";
  let authorType = "AGENT";
  let authorUser: string | null = null;

  if (event === "task_completed") {
    // Llamada del sistema (trigger). Renderiza la plantilla de tarea completada.
    text = renderTemplate(cfg.task_completed_template || 'Tu solicitud "{{tarea}}" se ha completado.', {
      contacto: conv.contact_name || "",
      tarea: task_title || "",
    });
    authorType = "SYSTEM";
  } else {
    // Envío desde la web: requiere usuario autenticado y autorizado.
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "No autenticado" }, 401);

    const { data: ua } = await admin
      .from("user_accounts").select("roles(code)").eq("user_id", user.id).eq("account_id", conv.account_id).maybeSingle();
    const roleCode = (ua as any)?.roles?.code;
    const allowed = roleCode === "MANAGER" || roleCode === "MASTER_ADMIN" || conv.assigned_to === user.id;
    if (!allowed) return json({ error: "Sin permiso para esta conversación" }, 403);

    text = (msgBody || "").trim();
    authorUser = user.id;
    if (!text) return json({ error: "Mensaje vacío" }, 400);
  }

  const result = await waSendText(cfg.phone_number_id, cfg.access_token, conv.contact_phone, text);

  await admin.from("chat_messages").insert({
    account_id: conv.account_id,
    conversation_id,
    direction: "OUT",
    author_type: authorType,
    author_user_id: authorUser,
    body: text,
    wa_message_id: result.id,
    status: result.ok ? "SENT" : "FAILED",
  });

  await admin.from("chat_conversations").update({
    last_message_at: new Date().toISOString(),
    last_message_preview: text.slice(0, 120),
    last_direction: "OUT",
  }).eq("id", conversation_id);

  return json({ ok: result.ok, error: result.error });
});
