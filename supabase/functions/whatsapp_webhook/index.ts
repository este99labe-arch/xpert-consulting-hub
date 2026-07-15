import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  return (phone || "").split("").filter((c) => c >= "0" && c <= "9").join("");
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
    if (!res.ok) console.error("WA send REJECTED by Meta:", res.status, JSON.stringify(data));
    return { ok: res.ok, id: (data as any)?.messages?.[0]?.id ?? null };
  } catch (e) {
    console.error("waSend failed:", e);
    return { ok: false, id: null };
  }
}

const EXT_BY_MIME: Record<string, string> = {
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/amr": "amr", "audio/aac": "aac",
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "application/pdf": "pdf",
};

async function fetchMedia(mediaId: string, token: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  try {
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meta = await metaRes.json().catch(() => ({}));
    if (!metaRes.ok || !meta?.url) { console.error("media meta failed", metaRes.status, JSON.stringify(meta)); return null; }
    const binRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!binRes.ok) { console.error("media download failed", binRes.status); return null; }
    const bytes = new Uint8Array(await binRes.arrayBuffer());
    return { bytes, mime: meta.mime_type || "application/octet-stream" };
  } catch (e) {
    console.error("fetchMedia error", e);
    return null;
  }
}

async function storeMedia(admin: any, accountId: string, convId: string, bytes: Uint8Array, mime: string): Promise<string | null> {
  const ext = EXT_BY_MIME[mime.split(";")[0]] || "bin";
  const path = `${accountId}/${convId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage.from("chat-media").upload(path, bytes, { contentType: mime, upsert: false });
  if (error) { console.error("storeMedia upload error", error.message); return null; }
  return path;
}

async function transcribeAudio(bytes: Uint8Array, mime: string): Promise<string | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) { console.warn("OPENAI_API_KEY no configurada; se omite transcripción"); return null; }
  try {
    const ext = EXT_BY_MIME[mime.split(";")[0]] || "ogg";
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: mime }), `audio.${ext}`);
    form.append("model", "whisper-1");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { console.error("Whisper error", res.status, JSON.stringify(data)); return null; }
    return (data?.text || "").trim() || null;
  } catch (e) {
    console.error("transcribeAudio error", e);
    return null;
  }
}

async function extractIncoming(admin: any, cfg: any, conv: any, msg: any) {
  const token = cfg.access_token;
  const type = msg.type;

  if ((type === "audio" || type === "voice") && msg.audio?.id && token) {
    const media = await fetchMedia(msg.audio.id, token);
    if (media) {
      const path = await storeMedia(admin, cfg.account_id, conv.id, media.bytes, media.mime);
      const transcription = await transcribeAudio(media.bytes, media.mime);
      return { text: transcription || "[Audio recibido]", message_type: "audio", media_path: path, media_mime: media.mime, transcription };
    }
    return { text: "[Audio recibido]", message_type: "audio", media_path: null, media_mime: null, transcription: null };
  }

  if (type === "image" && msg.image?.id && token) {
    const media = await fetchMedia(msg.image.id, token);
    const path = media ? await storeMedia(admin, cfg.account_id, conv.id, media.bytes, media.mime) : null;
    return { text: msg.image?.caption || "", message_type: "image", media_path: path, media_mime: media?.mime || "image/jpeg", transcription: null };
  }

  if (type === "document" && msg.document?.id && token) {
    const media = await fetchMedia(msg.document.id, token);
    const path = media ? await storeMedia(admin, cfg.account_id, conv.id, media.bytes, media.mime) : null;
    return { text: msg.document?.caption || msg.document?.filename || "[Documento]", message_type: "document", media_path: path, media_mime: media?.mime || null, transcription: null };
  }

  return { text: msg.text?.body || "", message_type: "text", media_path: null, media_mime: null, transcription: null };
}

// ════════════════════════════════════════════════════════════════════════════
// Fechas límite en lenguaje natural (ES + CA).
// Réplica de src/lib/dueDate.ts — si cambias la lógica, sincroniza ambos.
// ════════════════════════════════════════════════════════════════════════════
const WEEKDAYS: Record<string, number> = {
  lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, domingo: 7,
  dilluns: 1, dimarts: 2, dimecres: 3, dijous: 4, divendres: 5, dissabte: 6, diumenge: 7,
};
const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  gener: 1, febrer: 2, marc: 3, maig: 5, juny: 6, juliol: 7, agost: 8,
  setembre: 9, novembre: 11, desembre: 12,
};
const stripAccents = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const atNoon = (d: Date) => { const r = new Date(d); r.setHours(12, 0, 0, 0); return r; };
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

function parseDueDate(text: string, now: Date): Date | null {
  const t = " " + stripAccents(text) + " ";

  if (/\b(pasado manana|dema passat)\b/.test(t)) return atNoon(addDays(now, 2));
  if (/\b(manana|dema)\b/.test(t)) return atNoon(addDays(now, 1));
  if (/\b(para hoy|avui|hoy mismo)\b/.test(t)) return atNoon(now);

  const isoDow = now.getDay() === 0 ? 7 : now.getDay();
  if (/\b(la )?(semana que viene|proxima semana|setmana que ve|propera setmana)\b/.test(t)) {
    return atNoon(addDays(now, 7 - isoDow + 5));
  }
  if (/\b(esta semana|aquesta setmana)\b/.test(t)) {
    return atNoon(addDays(now, Math.max(0, 5 - isoDow)));
  }

  const dowMatch = t.match(
    /\b(?:el |del |para el |abans de |antes del |antes de el |pel |per )?(lunes|martes|miercoles|jueves|viernes|sabado|domingo|dilluns|dimarts|dimecres|dijous|divendres|dissabte|diumenge)\b/,
  );
  if (dowMatch) {
    const target = WEEKDAYS[dowMatch[1]];
    if (target) {
      const ahead = (target - isoDow + 7) % 7;
      return atNoon(addDays(now, ahead));
    }
  }

  const dm = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (dm) {
    const day = Number(dm[1]);
    const month = Number(dm[2]);
    let year = dm[3] ? Number(dm[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const d = atNoon(new Date(year, month - 1, day));
      if (!dm[3] && d < atNoon(now)) d.setFullYear(d.getFullYear() + 1);
      return d;
    }
  }

  const dmName = t.match(/\b(?:el |dia |el dia )?(\d{1,2}) de ([a-z]+)\b/);
  if (dmName) {
    const day = Number(dmName[1]);
    const month = MONTHS[dmName[2]];
    if (month && day >= 1 && day <= 31) {
      const d = atNoon(new Date(now.getFullYear(), month - 1, day));
      if (d < atNoon(now)) d.setFullYear(d.getFullYear() + 1);
      return d;
    }
  }

  const dayOnly = t.match(/\b(?:el dia|para el dia|para el|pel dia|abans del dia|antes del dia)\s+(\d{1,2})\b/);
  if (dayOnly) {
    const day = Number(dayOnly[1]);
    if (day >= 1 && day <= 31) {
      const d = atNoon(new Date(now.getFullYear(), now.getMonth(), day));
      if (d < atNoon(now)) d.setMonth(d.getMonth() + 1);
      return d;
    }
  }

  return null;
}

const madridNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" }));

// ════════════════════════════════════════════════════════════════════════════
// NLU: clasificación de intención + síntesis + fecha con LLM (si hay clave).
// Fallback determinista: palabras clave + parseDueDate.
// ════════════════════════════════════════════════════════════════════════════
async function classifyLLM(intents: any[], text: string): Promise<any | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key || !text) return null;
  try {
    const now = madridNow();
    const hoy = now.toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(6000),
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              `Clasificas mensajes de WhatsApp de clientes de una gestoría/PYME española. Hoy es ${hoy} (Europe/Madrid). ` +
              `El mensaje puede estar en castellano o catalán. Responde SOLO un objeto JSON con: ` +
              `"intent_id" (id de la lista de intenciones que mejor encaje, o null), ` +
              `"creates_task" (true si el mensaje pide un trabajo, gestión o documento que alguien debe realizar), ` +
              `"title" (título breve en castellano de la solicitud, máx. 60 caracteres, o null), ` +
              `"due_date" ("YYYY-MM-DD" si menciona un plazo o fecha límite, resolviendo expresiones relativas respecto a hoy, o null). ` +
              `Intenciones disponibles: ${JSON.stringify(intents.map((i) => ({ id: i.id, name: i.name, kind: i.kind })))}`,
          },
          { role: "user", content: text.slice(0, 1200) },
        ],
      }),
    });
    if (!res.ok) { console.error("LLM classify error", res.status); return null; }
    const data = await res.json();
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (e) {
    console.error("classifyLLM failed (fallback a palabras clave):", e);
    return null;
  }
}

// ─── Chat pipeline: contactos externos (no empleados) ───
async function handleChatMessage(admin: any, cfg: any, msg: any, senderPhone: string, contactName: string | null) {
  const account_id = cfg.account_id;

  let { data: conv } = await admin.from("chat_conversations")
    .select("*").eq("account_id", account_id).eq("contact_phone", senderPhone).maybeSingle();
  let isNew = false;
  if (!conv) {
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

  // Conversación borrada (borrado lógico): un mensaje nuevo la reactiva
  if (conv.deleted_at) {
    await admin.from("chat_conversations").update({ deleted_at: null }).eq("id", conv.id);
    conv.deleted_at = null;
  }

  const content = await extractIncoming(admin, cfg, conv, msg);
  const text = content.text;

  const { data: msgRow } = await admin.from("chat_messages").insert({
    account_id, conversation_id: conv.id, direction: "IN", author_type: "CONTACT",
    body: text, message_type: content.message_type, media_url: content.media_path,
    media_mime: content.media_mime, media_transcription: content.transcription,
    wa_message_id: msg.id || null, status: "DELIVERED",
  }).select("id").single();

  const preview = content.message_type === "image" ? (text || "📷 Foto")
    : content.message_type === "audio" ? (text && text !== "[Audio recibido]" ? `🎤 ${text}` : "🎤 Audio")
    : content.message_type === "document" ? "📎 Documento" : text;
  await admin.from("chat_conversations").update({
    last_message_at: new Date().toISOString(),
    last_message_preview: (preview || "").slice(0, 120), last_direction: "IN",
    unread_count: (conv.unread_count || 0) + 1,
  }).eq("id", conv.id);

  const token = cfg.access_token;
  const botActive = cfg.bot_enabled && !conv.bot_paused && conv.status !== "HUMAN";

  const botSend = async (t: string) => {
    if (!token) return;
    const r = await waSend(cfg.phone_number_id, token, msg.from, t);
    await admin.from("chat_messages").insert({
      account_id, conversation_id: conv.id, direction: "OUT", author_type: "BOT",
      body: t, wa_message_id: r.id, status: r.ok ? "SENT" : "FAILED",
    });
    await admin.from("chat_conversations").update({
      last_message_at: new Date().toISOString(), last_message_preview: t.slice(0, 120), last_direction: "OUT",
    }).eq("id", conv.id);
  };

  if (botActive && isNew && cfg.welcome_message) await botSend(cfg.welcome_message);

  // ══════════════════════════════════════════════════════════════════════════
  // CONSOLIDACIÓN (crítico): nunca un ticket por mensaje.
  // Si hay un ticket abierto de esta conversación dentro de la ventana de
  // consolidación, TODO mensaje entrante se añade a ese ticket.
  // ══════════════════════════════════════════════════════════════════════════
  const windowMin = Number(cfg.task_consolidation_minutes) || 60;
  const { data: openTask } = await admin.from("reminders")
    .select("id, description, remind_at, created_at, chat_message_ids")
    .eq("chat_conversation_id", conv.id).eq("origin", "CHAT")
    .eq("is_completed", false).is("archived_at", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const withinWindow = openTask &&
    Date.now() - new Date(openTask.created_at).getTime() < windowMin * 60_000;

  const stamp = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
  const lineText = text ||
    (content.message_type === "image" ? "[📷 Foto adjunta]" :
     content.message_type === "document" ? "[📎 Documento adjunto]" : "");

  if (openTask && withinWindow) {
    if (lineText) {
      const updates: any = {
        description: `${openTask.description || ""}\n[${stamp}] ${lineText}`.slice(0, 8000),
        chat_message_ids: [...(openTask.chat_message_ids || []), msgRow?.id].filter(Boolean),
      };
      // Si el mensaje nuevo menciona un plazo, se actualiza la fecha límite
      const due = text ? parseDueDate(text, madridNow()) : null;
      if (due) updates.remind_at = due.toISOString();
      await admin.from("reminders").update(updates).eq("id", openTask.id);
    }
    return; // consolidado en el ticket existente: sin ack ni fallback repetidos
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CLASIFICACIÓN: LLM (si hay OPENAI_API_KEY) con fallback a palabras clave.
  // Se ejecuta en TODA conversación (nueva o con historial): cada mensaje
  // fuera de la ventana de consolidación puede ser una petición nueva.
  // ══════════════════════════════════════════════════════════════════════════
  const lower = stripAccents(text || "");
  const { data: intents } = await admin.from("chat_intents")
    .select("*").eq("account_id", account_id).eq("is_active", true).order("sort_order");

  let matched = lower
    ? (intents || []).find((it: any) =>
        (it.keywords || []).some((k: string) => lower.includes(stripAccents(String(k)))))
    : null;

  const ai = text && text !== "[Audio recibido]" ? await classifyLLM(intents || [], text) : null;
  if (ai?.intent_id) {
    const byId = (intents || []).find((i: any) => i.id === ai.intent_id);
    if (byId) matched = byId;
  }
  const createsTask = Boolean(matched?.creates_task || ai?.creates_task);
  console.log("CLASSIFY:", JSON.stringify({
    text: (text || "").slice(0, 60), matched: matched?.name || null,
    ai: ai ? { intent: ai.intent_id, task: ai.creates_task, due: ai.due_date } : "sin LLM",
    createsTask,
  }));

  // Fecha límite: la del LLM si es válida; si no, parser determinista
  let due: Date | null = null;
  if (ai?.due_date && /^\d{4}-\d{2}-\d{2}$/.test(ai.due_date)) {
    const d = new Date(`${ai.due_date}T12:00:00`);
    if (!isNaN(d.getTime())) due = d;
  }
  if (!due && text) due = parseDueDate(text, madridNow());

  let actionTaken = false;

  if (createsTask && lineText) {
    const assignee = matched?.assignee || cfg.default_assignee || null;
    const { data: col } = await admin.from("task_columns")
      .select("id").eq("account_id", account_id).eq("is_archived", false).order("sort_order").limit(1).maybeSingle();
    let creator = assignee;
    if (!creator) {
      const { data: anyUser } = await admin.from("user_accounts")
        .select("user_id").eq("account_id", account_id).eq("is_active", true).limit(1).maybeSingle();
      creator = anyUser?.user_id;
    }
    const title = (ai?.title || "").trim().slice(0, 80) || (text || "Solicitud WhatsApp").slice(0, 80);
    const who = conv.contact_name || senderPhone;
    const { error: insErr } = await admin.from("reminders").insert({
      account_id, created_by: creator, assigned_to: assignee,
      title,
      description: `Solicitud por WhatsApp de ${who}:\n[${stamp}] ${lineText}`,
      priority: "MEDIUM",
      remind_at: due ? due.toISOString() : null,
      column_id: col?.id || null, origin: "CHAT", chat_conversation_id: conv.id,
      entity_type: "CHAT", entity_id: conv.id, entity_label: who,
      client_id: conv.client_id || null,
      labels: matched?.name ? [matched.name] : [],
      chat_message_ids: msgRow?.id ? [msgRow.id] : [],
    });
    if (insErr) {
      console.error("TASK INSERT FAILED:", insErr.message);
    } else {
      actionTaken = true;
      // La tarea asignada arrastra la asignación del chat al mismo empleado
      // (el manager sigue viéndolo todo por RLS de rol)
      await admin.from("chat_conversations").update({
        status: "HUMAN",
        ...(assignee ? { assigned_to: assignee } : {}),
      }).eq("id", conv.id);
      if (assignee) {
        await admin.from("chat_conversation_members").upsert(
          { conversation_id: conv.id, user_id: assignee, account_id },
          { onConflict: "conversation_id,user_id" },
        );
      }
      if (botActive && cfg.task_ack_message) await botSend(cfg.task_ack_message);
    }
  } else if (botActive && matched?.auto_reply) {
    await botSend(matched.auto_reply);
    actionTaken = true;
  }

  // Sin acción automática → "No atendido" (PENDING) SIEMPRE, aunque el bot
  // esté pausado o la conversación estuviera atendida: así el manager lo ve,
  // lo revisa y lo asigna. El aviso de fallback solo se envía si el bot manda.
  if (!actionTaken && !isNew) {
    await admin.from("chat_conversations").update({ status: "PENDING" }).eq("id", conv.id);
    if (botActive && cfg.fallback_message) await botSend(cfg.fallback_message);
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

  // ─── POST: cuerpo crudo (NO confiar hasta verificar la firma HMAC) ───
  const rawBody = await req.text();
  const sigHeader = req.headers.get("X-Hub-Signature-256") || req.headers.get("x-hub-signature-256") || "";

  let body: any;
  try { body = JSON.parse(rawBody); } catch { return new Response("Bad request", { status: 400, headers: corsHeaders }); }
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  const messages = value?.messages;
  const okResponse = new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const phoneNumberId = value?.metadata?.phone_number_id;
  const { data: cfg } = phoneNumberId
    ? await admin.from("whatsapp_config").select("*").eq("phone_number_id", phoneNumberId).eq("is_enabled", true).maybeSingle()
    : { data: null };

  const secrets = [cfg?.app_secret, Deno.env.get("WHATSAPP_APP_SECRET")].filter(Boolean) as string[];
  if (secrets.length === 0) return new Response("Server misconfigured", { status: 500, headers: corsHeaders });

  let signatureOk = false;
  for (const secret of secrets) {
    try {
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sigBytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
      const expected = "sha256=" + Array.from(sigBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      if (sigHeader.length !== expected.length) continue;
      let diff = 0;
      for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sigHeader.charCodeAt(i);
      if (diff === 0) { signatureOk = true; break; }
    } catch (e) {
      console.error("Signature verification error:", e);
    }
  }
  if (!signatureOk) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  if (!messages || messages.length === 0) return okResponse;
  if (!cfg) { console.log(`No config for phone_number_id ${phoneNumberId}`); return okResponse; }

  const contactName = value?.contacts?.[0]?.profile?.name || null;

  for (const msg of messages) {
    const senderPhone = normalizePhone(msg.from || "");

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
