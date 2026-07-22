import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GRAPH = "https://graph.facebook.com/v21.0";

// App ID de Meta (público). Puede sobreescribirse por secreto META_APP_ID.
const APP_ID = Deno.env.get("META_APP_ID") || "1514206456624236";
// App Secret de Meta (secreto). Reutiliza el que ya usa el webhook si existe.
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

  const { data: ua } = await admin
    .from("user_accounts").select("roles(code)").eq("user_id", user.id).eq("account_id", account_id).maybeSingle();
  const roleCode = (ua as any)?.roles?.code;
  if (roleCode !== "MANAGER" && roleCode !== "MASTER_ADMIN") {
    return json({ error: "Sin permisos para configurar WhatsApp en esta cuenta" }, 403);
  }

  if (!APP_SECRET) return json({ error: "Falta el secreto META_APP_SECRET / WHATSAPP_APP_SECRET" }, 500);

  // --- 1) Canjear el code por un token de acceso ---
  // El SDK de JavaScript (FB.login) emite el code contra un redirect_uri que
  // debe COINCIDIR en el canje. Probamos los candidatos habituales (redirect_uri
  // enviado por el front, el origen de la página con/sin barra, y vacío). Un
  // canje con redirect_uri erróneo NO consume el code, así que es seguro iterar.
  const origin = (req.headers.get("origin") || "").replace(/\/+$/, "");
  const redirectCandidates = Array.from(new Set(
    [payload.redirect_uri, origin ? origin + "/" : null, origin || null, ""]
      .filter((v) => v !== undefined && v !== null),
  )) as string[];
  let tokenData: any = null;
  let lastErr = "";
  for (const ru of redirectCandidates) {
    const url = `${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(APP_ID)}` +
      `&client_secret=${encodeURIComponent(APP_SECRET)}&redirect_uri=${encodeURIComponent(ru)}&code=${encodeURIComponent(code)}`;
    const r = await fetch(url);
    const d = await r.json().catch(() => ({}));
    if (r.ok && d?.access_token) { tokenData = d; break; }
    lastErr = d?.error?.message || String(r.status);
    console.error("token exchange failed", JSON.stringify(ru), r.status, JSON.stringify(d));
  }
  if (!tokenData?.access_token) {
    return json({ error: `No se pudo obtener el token: ${lastErr}` }, 400);
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
