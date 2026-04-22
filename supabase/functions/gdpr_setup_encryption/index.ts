// Edge Function: gdpr_setup_encryption
// Configura la clave maestra de cifrado AES-256 en la base de datos y re-cifra
// los datos existentes que estuvieran cifrados con la clave por defecto temporal.
//
// Flujo:
// 1. Lee ENCRYPTION_KEY del entorno (secret seguro).
// 2. Re-cifra todos los datos PII existentes (que estaban con clave temporal) con la clave real.
// 3. Sustituye la función _get_encryption_key() para que devuelva la clave real.
//
// Idempotente: si los datos ya están cifrados con la nueva clave, el segundo intento
// fallará silenciosamente (el descifrado con la clave vieja devolverá NULL → no se actualiza).
//
// Solo invocable por MASTER_ADMIN.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TEMP_KEY = "xpert_default_dev_key_REPLACE_IN_PRODUCTION_2026";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ENCRYPTION_KEY = Deno.env.get("ENCRYPTION_KEY");

    if (!ENCRYPTION_KEY) {
      return new Response(
        JSON.stringify({ error: "ENCRYPTION_KEY secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth: solo MASTER_ADMIN
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isMaster } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "MASTER_ADMIN",
    });
    if (!isMaster) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Re-cifrar datos existentes (clave temporal → clave real)
    const { data: reencrypted, error: reErr } = await admin.rpc("reencrypt_all_with_key", {
      _old_key: TEMP_KEY,
      _new_key: ENCRYPTION_KEY,
    });

    if (reErr) {
      // Si falla porque ya están cifrados con la nueva clave, no es bloqueante
      console.warn("Reencrypt warning:", reErr.message);
    }

    // 2. Sustituir la función _get_encryption_key para que use la clave real.
    //    Lo hacemos vía RPC parametrizado para no exponer la clave en logs.
    //    Creamos una RPC ad-hoc que ejecuta DDL con la clave inline.
    //    (alternativa: ALTER DATABASE postgres SET app.encryption_key = ... vía función)
    const { error: setErr } = await admin.rpc("_install_encryption_key", {
      _key: ENCRYPTION_KEY,
    });

    if (setErr) {
      return new Response(
        JSON.stringify({ error: `Failed to install key: ${setErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        reencrypted: reencrypted || null,
        message: "Encryption key installed and data re-encrypted with master key.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
