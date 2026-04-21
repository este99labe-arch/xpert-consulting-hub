import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

async function sendWhatsAppReply(
  phoneNumberId: string,
  to: string,
  text: string,
  accessToken: string
) {
  try {
    await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text },
        }),
      }
    );
  } catch (e) {
    console.error("Failed to send WhatsApp reply:", e);
  }
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // ─── GET: Meta webhook verification ───
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode !== "subscribe" || !token || !challenge) {
      return new Response("Bad request", { status: 400, headers: corsHeaders });
    }

    // Look up verify_token in whatsapp_config
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: configs } = await supabase
      .from("whatsapp_config")
      .select("verify_token")
      .eq("is_enabled", true)
      .eq("verify_token", token);

    if (!configs || configs.length === 0) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    return new Response(challenge, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }

  // ─── POST: Incoming WhatsApp messages ───
  if (req.method === "POST") {
    // Verify Meta's HMAC-SHA256 signature to ensure the payload is genuine
    const rawBody = await req.text();
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET");
    if (!appSecret) {
      console.error("WHATSAPP_APP_SECRET not configured — rejecting webhook for security");
      return new Response("Server misconfigured", { status: 500, headers: corsHeaders });
    }
    const sigHeader = req.headers.get("X-Hub-Signature-256") || req.headers.get("x-hub-signature-256") || "";
    try {
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(appSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const sigBytes = new Uint8Array(
        await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)),
      );
      const expected = "sha256=" + Array.from(sigBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      // Constant-time compare
      if (sigHeader.length !== expected.length) {
        return new Response("Forbidden", { status: 403, headers: corsHeaders });
      }
      let diff = 0;
      for (let i = 0; i < expected.length; i++) {
        diff |= expected.charCodeAt(i) ^ sigHeader.charCodeAt(i);
      }
      if (diff !== 0) {
        return new Response("Forbidden", { status: 403, headers: corsHeaders });
      }
    } catch (e) {
      console.error("Signature verification failed:", e);
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    const body = JSON.parse(rawBody);

    // Meta sends webhook payloads with this structure
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      // Could be a status update — acknowledge
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    if (!accessToken) {
      console.error("WHATSAPP_ACCESS_TOKEN not configured");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const msg of messages) {
      const senderPhone = normalizePhone(msg.from || "");
      const messageText = msg.text?.body || "";
      const messageType = msg.type; // text, location, etc.

      // Extract location if provided
      let locationLat: number | null = null;
      let locationLng: number | null = null;
      if (msg.location) {
        locationLat = msg.location.latitude || null;
        locationLng = msg.location.longitude || null;
      }

      // 1. Find employee by phone
      const { data: profiles } = await supabase
        .from("employee_profiles")
        .select("user_id, account_id, first_name")
        .eq("phone", senderPhone);

      // Also try with + prefix
      let profile = profiles?.[0];
      if (!profile) {
        const { data: profiles2 } = await supabase
          .from("employee_profiles")
          .select("user_id, account_id, first_name")
          .eq("phone", `+${senderPhone}`);
        profile = profiles2?.[0];
      }

      if (!profile) {
        // Try matching last digits (phone might be stored differently)
        const lastDigits = senderPhone.slice(-9);
        const { data: profiles3 } = await supabase
          .from("employee_profiles")
          .select("user_id, account_id, first_name")
          .ilike("phone", `%${lastDigits}`);
        profile = profiles3?.[0];
      }

      if (!profile) {
        console.log(`No employee found for phone: ${senderPhone}`);
        // We can't reply without knowing the phone_number_id, skip
        continue;
      }

      // 2. Check whatsapp_config is enabled for this account
      const { data: config } = await supabase
        .from("whatsapp_config")
        .select("phone_number_id, is_enabled")
        .eq("account_id", profile.account_id)
        .eq("is_enabled", true)
        .maybeSingle();

      if (!config) {
        console.log(`WhatsApp not enabled for account: ${profile.account_id}`);
        continue;
      }

      // 3. Parse command
      const command = parseCommand(messageText);
      if (!command) {
        await sendWhatsAppReply(
          config.phone_number_id,
          msg.from,
          `Hola ${profile.first_name || ""}. No he entendido tu mensaje. Envía "entrada" para fichar entrada o "salida" para fichar salida.`,
          accessToken
        );
        continue;
      }

      const todayStr = new Date().toISOString().split("T")[0];
      const now = new Date().toISOString();

      // 4. Get today's records (multiple sessions allowed)
      const { data: todayRecords } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", profile.user_id)
        .eq("account_id", profile.account_id)
        .eq("work_date", todayStr)
        .order("created_at");

      const records = todayRecords || [];
      // Find active session (check_in without check_out)
      const activeRecord = records.find((r: any) => r.check_in && !r.check_out);

      if (command === "ENTRY") {
        if (activeRecord) {
          await sendWhatsAppReply(
            config.phone_number_id,
            msg.from,
            `⚠️ Ya tienes una sesión activa desde las ${new Date(activeRecord.check_in).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}. Envía "salida" para cerrarla antes de abrir otra.`,
            accessToken
          );
          continue;
        }

        // Create a new session record
        await supabase.from("attendance_records").insert({
          user_id: profile.user_id,
          account_id: profile.account_id,
          work_date: todayStr,
          check_in: now,
          source: "WHATSAPP",
          phone_number: senderPhone,
          location_lat: locationLat,
          location_lng: locationLng,
        });

        const sessionNum = records.filter((r: any) => r.check_out).length + 1;
        await sendWhatsAppReply(
          config.phone_number_id,
          msg.from,
          `✅ Entrada registrada a las ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}${sessionNum > 1 ? ` (sesión ${sessionNum})` : ""}. ¡Buen día ${profile.first_name || ""}!`,
          accessToken
        );
      } else if (command === "EXIT") {
        if (!activeRecord) {
          await sendWhatsAppReply(
            config.phone_number_id,
            msg.from,
            `⚠️ No tienes una sesión activa. Envía "entrada" primero.`,
            accessToken
          );
          continue;
        }

        await supabase
          .from("attendance_records")
          .update({
            check_out: now,
            source: activeRecord.source === "WHATSAPP" ? "WHATSAPP" : "MIXED",
            location_lat: locationLat || activeRecord.location_lat,
            location_lng: locationLng || activeRecord.location_lng,
          })
          .eq("id", activeRecord.id);

        // Calculate total worked today across all sessions
        const sessionMins = Math.round(
          (new Date().getTime() - new Date(activeRecord.check_in).getTime()) / 60000
        );
        const totalMins = records.reduce((acc: number, r: any) => {
          if (r.check_in && r.check_out) {
            return acc + Math.round((new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 60000);
          }
          return acc;
        }, 0) + sessionMins;

        const totalH = Math.floor(totalMins / 60);
        const totalM = totalMins % 60;
        const sesH = Math.floor(sessionMins / 60);
        const sesM = sessionMins % 60;

        await sendWhatsAppReply(
          config.phone_number_id,
          msg.from,
          `✅ Salida registrada (${sesH}h ${sesM}m esta sesión). Total hoy: ${totalH}h ${totalM}m. ${profile.first_name || ""}`,
          accessToken
        );
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", {
    status: 405,
    headers: corsHeaders,
  });
});
