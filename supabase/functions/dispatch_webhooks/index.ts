import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hmacSign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { account_id, event, payload } = await req.json();
    if (!account_id || !event || !payload) {
      throw new Error("account_id, event, and payload are required");
    }

    // Find active webhooks for this account subscribed to this event
    const { data: webhooks, error } = await supabase
      .from("webhooks")
      .select("*")
      .eq("account_id", account_id)
      .eq("is_active", true)
      .contains("events", [event]);

    if (error) throw error;
    if (!webhooks || webhooks.length === 0) {
      return new Response(JSON.stringify({ success: true, dispatched: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let dispatched = 0;
    let failed = 0;

    const body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    for (const wh of webhooks) {
      const start = Date.now();
      let responseStatus: number | null = null;
      let responseBody = "";
      let success = false;

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-Webhook-Event": event,
        };

        // Add HMAC signature if secret is set
        if (wh.secret) {
          const signature = await hmacSign(wh.secret, body);
          headers["X-Webhook-Signature"] = `sha256=${signature}`;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const res = await fetch(wh.url, {
          method: "POST",
          headers,
          body,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        responseStatus = res.status;
        responseBody = await res.text();
        success = res.ok;

        if (success) dispatched++;
        else failed++;
      } catch (err: any) {
        responseBody = err.message || String(err);
        failed++;
      }

      const durationMs = Date.now() - start;

      // Log delivery
      await supabase.from("webhook_logs").insert({
        webhook_id: wh.id,
        event,
        payload,
        response_status: responseStatus,
        response_body: responseBody?.slice(0, 2000),
        duration_ms: durationMs,
        success,
      });
    }

    return new Response(JSON.stringify({ success: true, dispatched, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
