import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GRAPH = "https://graph.facebook.com/v21.0";

/**
 * ¿Puede este usuario administrar la cuenta?
 *
 * Vale por pertenencia directa (MANAGER/MASTER_ADMIN) o por una sesión de
 * soporte activa. Las RLS ya contemplan la suplantación vía
 * get_user_account_id(), pero las Edge Functions usan la service key y se
 * saltan las RLS: sin esta comprobación, un MASTER_ADMIN dentro de una cuenta
 * cliente se topa con un 403 aunque la UI le deje entrar a todo lo demás.
 *
 * Confiar en la sesión de soporte es seguro: start_support_session solo la
 * abre si has_role(uid,'MASTER_ADMIN'), y caduca a las 8 horas.
 */
async function canManageAccount(admin: any, userId: string, accountId: string) {
  const { data: ua } = await admin
    .from("user_accounts").select("roles(code)")
    .eq("user_id", userId).eq("account_id", accountId).maybeSingle();
  const roleCode = (ua as any)?.roles?.code;
  if (roleCode === "MANAGER" || roleCode === "MASTER_ADMIN") return true;

  const { data: ss } = await admin
    .from("support_sessions").select("user_id")
    .eq("user_id", userId).eq("account_id", accountId)
    .gt("expires_at", new Date().toISOString()).maybeSingle();
  return !!ss;
}

// App ID de Meta (público). Puede sobreescribirse por secreto META_APP_ID.
const APP_ID = Deno.env.get("META_APP_ID") || "1514206456624236";

// App Secret de Meta. META_APP_SECRET manda sobre WHATSAPP_APP_SECRET: si el
// primero quedó con un valor viejo, actualizar el segundo no sirve de nada, así
// que registramos cuál se está usando para que el diagnóstico no dependa de
// recordar qué secreto se tocó.
const SECRET_SOURCE = Deno.env.get("META_APP_SECRET")
  ? "META_APP_SECRET"
  : Deno.env.get("WHATSAPP_APP_SECRET") ? "WHATSAPP_APP_SECRET" : "ninguno";
const APP_SECRET = Deno.env.get("META_APP_SECRET") || Deno.env.get("WHATSAPP_APP_SECRET") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const { account_id, code } = payload || {};
  let { phone_number_id, waba_id } = payload || {};
  if (!account_id || !code) return json({ error: "account_id y code son obligatorios" }, 400);

  // --- Autenticación: el llamante debe ser MANAGER/MASTER_ADMIN de la cuenta ---
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const { data: { user } } = await userClient.auth.getUser(jwt);
  if (!user) return json({ error: "No autenticado" }, 401);

  if (!await canManageAccount(admin, user.id, account_id)) {
    return json({ error: "Sin permisos para configurar WhatsApp en esta cuenta" }, 403);
  }

  if (!APP_SECRET) return json({ error: "Falta el secreto META_APP_SECRET / WHATSAPP_APP_SECRET" }, 500);

  // --- 1) Canjear el code por un token de acceso ---
  // El canje de Embedded Signup va SIN redirect_uri: el code no está atado a
  // ninguna URL de retorno.
  //
  // Antes se probaban varios redirect_uri "por si acaso". Era contraproducente:
  // el code es de un solo uso, así que si el primer intento (el bueno) fallaba
  // por cualquier motivo, los siguientes lo encontraban ya gastado y devolvían
  // "make sure your redirect_uri is identical..." — un mensaje que señala al
  // sitio equivocado y tapa el error real. Un intento, y se cuenta la verdad.
  const tokenUrl = `${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(APP_ID)}` +
    `&client_secret=${encodeURIComponent(APP_SECRET)}&code=${encodeURIComponent(code)}`;
  const tokenRes = await fetch(tokenUrl);
  const tokenData: any = await tokenRes.json().catch(() => ({}));

  if (!tokenRes.ok || !tokenData?.access_token) {
    const e = tokenData?.error || {};

    // Meta devuelve el mismo "revisa tu redirect_uri" tanto si el code está
    // gastado o caducado como si las credenciales de la app no son las que lo
    // emitieron. Para distinguirlo, pedimos un token de aplicación con el mismo
    // par client_id/client_secret: si eso falla, el problema son las
    // credenciales; si funciona, el problema es el code.
    let credsOk: boolean | null = null;
    let credsErr = "";
    try {
      const probe = await fetch(
        `${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(APP_ID)}` +
        `&client_secret=${encodeURIComponent(APP_SECRET)}&grant_type=client_credentials`,
      );
      const probeData = await probe.json().catch(() => ({} as any));
      credsOk = probe.ok && !!probeData?.access_token;
      if (!credsOk) credsErr = probeData?.error?.message || String(probe.status);
    } catch (err) {
      credsErr = String(err);
    }

    // ¿Llegó a correr el asistente de Embedded Signup? phone_number_id y
    // waba_id vienen del evento WA_EMBEDDED_SIGNUP, que SOLO emite ese
    // asistente. Sin ellos, el popup fue un login normal de Facebook y el code
    // es de OAuth corriente — atado a un redirect_uri, y por eso rechazado.
    // Es la diferencia entre un problema de código y uno de configuración en
    // Meta, y desde fuera los dos dan el mismo mensaje.
    const esRan = !!(phone_number_id || waba_id);
    const codeFp = `${String(code).slice(0, 12)}…(${String(code).length})`;

    const diag = credsOk === false
      ? `Las credenciales de la app no son válidas (app_id ${APP_ID}, secreto de ${SECRET_SOURCE}): ${credsErr}`
      : `Credenciales OK (app_id ${APP_ID}). Meta code=${e.code ?? "?"}/${e.error_subcode ?? "-"}. ` +
        `code=${codeFp}. Asistente Embedded Signup: ${esRan ? `SÍ (waba ${waba_id ?? "-"}, phone ${phone_number_id ?? "-"})` : "NO se ejecutó — el popup fue un login normal"}.`;

    console.error("token exchange failed", tokenRes.status, JSON.stringify(tokenData),
      "app_id", APP_ID, "secret_source", SECRET_SOURCE, "creds_ok", credsOk);

    return json({
      error: `No se pudo obtener el token: ${e.message || tokenRes.status} — ${diag}`,
      meta_error: {
        message: e.message ?? null, type: e.type ?? null, code: e.code ?? null,
        error_subcode: e.error_subcode ?? null, fbtrace_id: e.fbtrace_id ?? null,
        http_status: tokenRes.status,
        app_id: APP_ID, secret_source: SECRET_SOURCE, secret_len: APP_SECRET.length,
        credentials_ok: credsOk,
        embedded_signup_ran: esRan, waba_id: waba_id ?? null, phone_number_id: phone_number_id ?? null,
      },
    }, 400);
  }
  const accessToken: string = tokenData.access_token;

  // --- 2) Resolver WABA / número si el frontend no los envió ---
  if (!waba_id) {
    // Deducir la WABA desde los permisos concedidos al token.
    const dbgRes = await fetch(`${GRAPH}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(APP_ID + "|" + APP_SECRET)}`);
    const dbg = await dbgRes.json().catch(() => ({}));
    const scopes = dbg?.data?.granular_scopes as Array<{ scope: string; target_ids?: string[] }> | undefined;
    const waScope = scopes?.find((s) => s.scope === "whatsapp_business_management" || s.scope === "whatsapp_business_messaging");
    waba_id = waScope?.target_ids?.[0];
  }
  if (!waba_id) return json({ error: "No se pudo determinar la WABA. Reintenta el flujo." }, 400);

  if (!phone_number_id) {
    const numRes = await fetch(`${GRAPH}/${waba_id}/phone_numbers?access_token=${encodeURIComponent(accessToken)}`);
    const nums = await numRes.json().catch(() => ({}));
    phone_number_id = nums?.data?.[0]?.id;
  }
  if (!phone_number_id) return json({ error: "No se pudo determinar el número de teléfono." }, 400);

  // --- 3) Datos del número (para display_phone) ---
  let displayPhone: string | null = null;
  try {
    const infoRes = await fetch(`${GRAPH}/${phone_number_id}?fields=display_phone_number,verified_name&access_token=${encodeURIComponent(accessToken)}`);
    const info = await infoRes.json().catch(() => ({}));
    if (info?.display_phone_number) displayPhone = info.display_phone_number;
  } catch (_) { /* opcional */ }

  // --- 4) Suscribir la WABA al webhook de la app ---
  const subRes = await fetch(`${GRAPH}/${waba_id}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const subData = await subRes.json().catch(() => ({}));
  if (!subRes.ok) {
    console.error("subscribed_apps failed", subRes.status, JSON.stringify(subData));
    return json({ error: `No se pudo suscribir la WABA al webhook: ${subData?.error?.message || subRes.status}` }, 400);
  }

  // --- 5) Guardar en whatsapp_config (upsert por cuenta) ---
  const { data: existing } = await admin
    .from("whatsapp_config").select("id, verify_token").eq("account_id", account_id).maybeSingle();

  const row: any = {
    phone_number_id,
    waba_id,
    access_token: accessToken,
    is_enabled: true,
    updated_at: new Date().toISOString(),
  };
  if (displayPhone) row.display_phone = displayPhone;
  // Genera un verify_token si aún no hay (necesario para revalidar el webhook si hiciera falta).
  if (!existing?.verify_token) row.verify_token = crypto.randomUUID();

  const { error: saveErr } = existing
    ? await admin.from("whatsapp_config").update(row).eq("id", existing.id)
    : await admin.from("whatsapp_config").insert({ account_id, ...row });
  if (saveErr) {
    console.error("save config failed", saveErr);
    return json({ error: `No se pudo guardar la configuración: ${saveErr.message}` }, 500);
  }

  return json({ ok: true, phone_number_id, waba_id, display_phone: displayPhone });
});
