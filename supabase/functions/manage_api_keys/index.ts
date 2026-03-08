import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hashKey(raw: string): Promise<string> {
  const data = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `xpc_${hex}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No autorizado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("No autorizado");

    const { data: accountId } = await supabase.rpc("get_user_account_id", { _user_id: user.id });
    if (!accountId) throw new Error("Sin cuenta asociada");

    const body = await req.json();
    const { action, name, key_id } = body;

    switch (action) {
      case "generate": {
        if (!name) throw new Error("Nombre requerido");
        const rawKey = generateApiKey();
        const keyHash = await hashKey(rawKey);
        const keyPrefix = rawKey.slice(0, 12) + "...";

        const { error } = await supabase.from("api_keys").insert({
          account_id: accountId,
          name,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          created_by: user.id,
        });
        if (error) throw error;

        // Return the raw key ONCE - it cannot be retrieved later
        return new Response(JSON.stringify({ success: true, api_key: rawKey, prefix: keyPrefix }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "revoke": {
        if (!key_id) throw new Error("key_id requerido");
        const { error } = await supabase
          .from("api_keys")
          .update({ is_active: false })
          .eq("id", key_id)
          .eq("account_id", accountId);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        if (!key_id) throw new Error("key_id requerido");
        const { error } = await supabase
          .from("api_keys")
          .delete()
          .eq("id", key_id)
          .eq("account_id", accountId);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error("Acción no válida. Usa: generate, revoke, delete");
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
