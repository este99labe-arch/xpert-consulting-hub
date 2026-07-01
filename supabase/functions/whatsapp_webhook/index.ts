import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\+\(\)]/g, "");
}

const ENTRY_KEYWORDS = ["entrada", "entrar", "llegada", "inicio", "in", "check in"];
const EXIT_KEYWORDS = ["salida", "salir", "fin", "out", "check out"];
function parseCommand(text: string): "ENTRY" | "EXIT" | null {
  const lower = text.trim().toLowerCase();
  if (ENTRY_KEYWORDS.some((k) => lower.includes(k))) return "ENTRY";
  if (EXIT_KEYWORDS.some((k) => lower.includes(k))) return "EXIT";
  return null;
}

async function waSend(phoneNumberId: string, token: string, to: string, text: string) {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, id: (data as any)?.messages?.[0]?.id ?? null };
  } catch (e) {
    console.error("waSend failed:", e);
    return { ok: false, id: null };
  }
}

// ─── Chat pipeline: contactos externos (no empleados) ───
async function handleChatMessage(admin: any, cfg: any, msg: any, senderPhone: string, contactName: string | null) {
  const account_id = cfg.account_id;
  const text = msg.text?.body || "";

  // Buscar / crear conversación
  let { data: conv } = await admin.from("chat_conversations")
    .select("*").eq("account_id", account_id).eq("contact_phone", senderPhone).maybeSingle();
  let isNew = false;
  if (!conv) {
    // Intentar mapear a un contacto de cliente registrado (por teléfono)
    const last9 = senderPhone.slice(-9);
    const { data: cc } = await admin.from("client_contacts")
      .select("id, client_id, name").eq("account_id", account_id).ilike("phone", `%${last9}`).maybeSingle();
    const ins = await admin.from("chat_conversations").insert({
      account_id, contact_phone: senderPhone,
      contact_name: cc?.name || contactName || null,
      client_id: cc?.client_id || null, contact_id: cc?.id || null,
      status: "BOT",
    }).select("*").single();
    conv = ins.data;
    isNew = true;
  }
  if (!conv) return;

  // Guardar mensaje entrante
  await admin.from("chat_messages").insert({
    account_id, conversation_id: conv.id, direction: "IN", author_type: "CONTACT",
    body: text, wa_message_id: msg.id || null, status: "DELIVERED",
  });
  await admin.from("chat_conversations").update({
    last_message_at: new Date().toISOString(),
    last_message_preview: text.slice(0, 120), last_direction: "IN",
    unread_count: (conv.unread_count || 0) + 1,
  }).eq("id", conv.id);

  // Bot: solo si está activo, no pausado y no intervenido por humano
  if (!cfg.bot_enabled || conv.bot_paused || conv.status === "HUMAN") return;
  const token = cfg.access_token;
  if (!token) return;

  const botSend = async (t: string) => {
    const r = await waSend(cfg.phone_number_id, token, msg.from, t);
    await admin.from("chat_messages").insert({
      account_id, conversation_id: conv.id, direction: "OUT", author_type: "BOT",
      body: t, wa_message_id: r.id, status: r.ok ? "SENT" : "FAILED",
    });
    await admin.from("chat_conversations").update({
      last_message_at: new Date().toISOString(), last_message_preview: t.slice(0, 120), last_direction: "OUT",
    }).eq("id", conv.id);
  };

  if (isNew && cfg.welcome_message) await botSend(cfg.welcome_message);

  // Clasificación por palabras clave
  const lower = text.toLowerCase();
  const { data: intents } = await admin.from("chat_intents")
    .select("*").eq("account_id", account_id).eq("is_active", true).order("sort_order");
  const matched = (intents || []).find((it: any) =>
    (it.keywords || []).some((k: string) => lower.includes(String(k).toLowerCase())));

  if (matched?.creates_task) {
    const assignee = matched.assignee || cfg.default_assignee || null;
    const { data: col } = await admin.from("task_columns")
      .select("id").eq("account_id", account_id).eq("is_archived", false).order("sort_order").limit(1).maybeSingle();
    let creator = assignee;
    if (!creator) {
      const { data: anyUser } = await admin.from("user_accounts")
        .select("user_id").eq("account_id", account_id).eq("is_active", true).limit(1).maybeSingle();
      creator = anyUser?.user_id;
    }
    await admin.from("reminders").insert({
      account_id, created_by: creator, assigned_to: assignee,
      title: `WhatsApp: ${text.slice(0, 80)}`, description: text,
      remind_at: new Date().toISOString(), priority: "MEDIUM",
      column_id: col?.id || null, origin: "CHAT", chat_conversation_id: conv.id,
      entity_type: "CHAT", entity_id: conv.id, entity_label: conv.contact_name || senderPhone,
      client_id: conv.client_id || null,
    });
    await admin.from("chat_conversations").update({ status: "HUMAN" }).eq("id", conv.id);
    if (cfg.task_ack_message) await botSend(cfg.task_ack_message);
  } else if (matched?.auto_reply) {
    await botSend(matched.auto_reply);
  } else if (!isNew) {
    await admin.from("chat_conversations").update({ status: "PENDING" }).eq("id", conv.id);
    if (cfg.fallback_message) await botSend(cfg.fallback_message);
  }
}

// ─── Attendance (empleados fichando por WhatsApp) ───
async function handleAttendance(admin: any, cfg: any, profile: any, msg: any, senderPhone: string) {
  const token = cfg.access_token || Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  if (!token) return;
  const reply = (t: string) => waSend(cfg.phone_number_id, token, msg.from, t);
  const messageText = msg.text?.body || "";
  const command = parseCommand(messageText);
  if (!command) {
    await reply(`Hola ${profile.first_name || ""}. No he entendido tu mensaje. Envía "entrada" para fichar entrada o "salida" para fichar salida.`);
    return;
  }
  const todayStr = new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();
  const locationLat = msg.location?.latitude ?? null;
  const locationLng = msg.location?.longitude ?? null;

  const { data: todayRecords } = await admin.from("attendance_records")
    .select("*").eq("user_id", profile.user_id).eq("account_id", profile.account_id).eq("work_date", todayStr).order("created_at");
  const records = todayRecords || [];
  const activeRecord = records.find((r: any) => r.check_in && !r.check_out);

  if (command === "ENTRY") {
    if (activeRecord) {
      await reply(`⚠️ Ya tienes una sesión activa desde las ${new Date(activeRecord.check_in).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}. Envía "salida" para cerrarla.`);
      return;
    }
    await admin.from("attendance_records").insert({
      user_id: profile.user_id, account_id: profile.account_id, work_date: todayStr,
      check_in: now, source: "WHATSAPP", phone_number: senderPhone, location_lat: locationLat, location_lng: locationLng,
    });
    const sessionNum = records.filter((r: any) => r.check_out).length + 1;
    await reply(`✅ Entrada registrada a las ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}${sessionNum > 1 ? ` (sesión ${sessionNum})` : ""}. ¡Buen día ${profile.first_name || ""}!`);
  } else {
    if (!activeRecord) { await reply(`⚠️ No tienes una sesión activa. Envía "entrada" primero.`); return; }
    await admin.from("attendance_records").update({
      check_out: now, source: activeRecord.source === "WHATSAPP" ? "WHATSAPP" : "MIXED",
      location_lat: locationLat || activeRecord.location_lat, location_lng: locationLng || activeRecord.location_lng,
    }).eq("id", activeRecord.id);
    const sessionMins = Math.round((Date.now() - new Date(activeRecord.check_in).getTime()) / 60000);
    const totalMins = records.reduce((acc: number, r: any) =>
      r.check_in && r.check_out ? acc + Math.round((new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 60000) : acc, 0) + sessionMins;
    await reply(`✅ Salida registrada (${Math.floor(sessionMins / 60)}h ${sessionMins % 60}m esta sesión). Total hoy: ${Math.floor(totalMins / 60)}h ${totalMins % 60}m. ${profile.first_name || ""}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);

  // ─── GET: verificación de webhook de Meta ───
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode !== "subscribe" || !token || !challenge) return new Response("Bad request", { status: 400, headers: corsHeaders });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: configs } = await admin.from("whatsapp_config").select("verify_token").eq("is_enabled", true).eq("verify_token", token);
    if (!configs || configs.length === 0) return new Response("Forbidden", { status: 403, headers: corsHeaders });
    return new Response(challenge, { status: 200, headers: { ...corsHeaders, "Content-Type": "text/plain" } });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  // ─── POST: verificación de firma HMAC ───
  const rawBody = await req.text();
  const appSecret = Deno.env.get("WHATSAPP_APP_SECRET");
  if (!appSecret) return new Response("Server misconfigured", { status: 500, headers: corsHeaders });
  const sigHeader = req.headers.get("X-Hub-Signature-256") || req.headers.get("x-hub-signature-256") || "";
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sigBytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
    const expected = "sha256=" + Array.from(sigBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    if (sigHeader.length !== expected.length) return new Response("Forbidden", { status: 403, headers: corsHeaders });
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sigHeader.charCodeAt(i);
    if (diff !== 0) return new Response("Forbidden", { status: 403, headers: corsHeaders });
  } catch (e) {
    console.error("Signature verification failed:", e);
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const body = JSON.parse(rawBody);
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  const messages = value?.messages;
  const okResponse = new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (!messages || messages.length === 0) return okResponse;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Identificar la cuenta por el número que RECIBIÓ el mensaje
  const phoneNumberId = value?.metadata?.phone_number_id;
  if (!phoneNumberId) return okResponse;
  const { data: cfg } = await admin.from("whatsapp_config").select("*").eq("phone_number_id", phoneNumberId).eq("is_enabled", true).maybeSingle();
  if (!cfg) { console.log(`No config for phone_number_id ${phoneNumberId}`); return okResponse; }

  const contactName = value?.contacts?.[0]?.profile?.name || null;

  for (const msg of messages) {
    const senderPhone = normalizePhone(msg.from || "");

    // ¿Es un empleado de esta cuenta? -> asistencia
    const last9 = senderPhone.slice(-9);
    const { data: prof } = await admin.from("employee_profiles")
      .select("user_id, account_id, first_name")
      .eq("account_id", cfg.account_id).ilike("phone", `%${last9}`).maybeSingle();

    if (prof) {
      await handleAttendance(admin, cfg, prof, msg, senderPhone);
    } else {
      await handleChatMessage(admin, cfg, msg, senderPhone, contactName);
    }
  }

  return okResponse;
});
