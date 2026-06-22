// ============================================================
// VERI*FACTU — Envío de registros de facturación a la AEAT
// Modalidad: Veri*Factu (remisión en tiempo real).
//
// Flujo:
//   1. Autentica al usuario y comprueba acceso a la factura.
//   2. Recupera la huella del último registro de la cuenta (encadenamiento).
//   3. Construye el XML del RegistroAlta y calcula la huella SHA-256.
//   4. Si hay certificado configurado (secrets VERIFACTU_CERT + VERIFACTU_KEY),
//      envía el SOAP por TLS mutuo al endpoint de pre-producción y persiste el CSV.
//      Si NO hay certificado, deja la factura en estado PREPARED (XML + huella
//      ya calculados y encadenados) lista para enviar cuando se configure.
//   5. Registra todo en verifactu_events.
//
// Secrets necesarios para el envío real (configurar en Supabase):
//   - VERIFACTU_CERT : certificado de cliente en formato PEM
//   - VERIFACTU_KEY  : clave privada del certificado en formato PEM
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type VerifactuEnv = "sandbox" | "prod";

// Endpoint SOAP de alta de registros de facturación (SistemaFacturacion).
const REGISTRO_ENDPOINTS: Record<VerifactuEnv, string> = {
  sandbox: "https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP",
  prod: "https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP",
};

// URL del cotejo del QR (validación visual).
const QR_BASE_URLS: Record<VerifactuEnv, string> = {
  sandbox: "https://prepro7.aeat.es/wlpl/TIKE-CONT/ValidarQR",
  prod: "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR",
};

// Identificación del sistema informático (SIF) emisor de los registros.
// TODO: sustituir por los datos definitivos del software registrado en la AEAT.
const SISTEMA_INFORMATICO = {
  nombreRazon: "XpertConsulting Hub",
  nif: "", // NIF del productor del software (se completará en producción)
  nombreSistema: "XpertConsulting ERP",
  idSistema: "XC",
  version: "1.0",
  numeroInstalacion: "1",
};

// ─── Helpers de formato ────────────────────────────────────
const money = (n: number) => Number(n || 0).toFixed(2);

function toDdMmYyyy(isoDate: string): string {
  // admite yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    const [y, m, d] = isoDate.split("-");
    return `${d}-${m}-${y}`;
  }
  return isoDate;
}

// Fecha/hora con huso horario en formato ISO 8601 (ej. 2026-06-22T10:30:00+02:00)
function fechaHoraHusoGen(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const tzMin = -now.getTimezoneOffset();
  const sign = tzMin >= 0 ? "+" : "-";
  const tzH = pad(Math.floor(Math.abs(tzMin) / 60));
  const tzM = pad(Math.abs(tzMin) % 60);
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}` +
    `${sign}${tzH}:${tzM}`
  );
}

function xmlEscape(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─── Huella (hash) del registro de alta ────────────────────
// Algoritmo AEAT: concatenación clave=valor separadas por '&' en orden fijo
// y SHA-256 en hexadecimal mayúsculas.
async function calcularHuella(params: {
  idEmisor: string;
  numSerie: string;
  fechaExpedicion: string; // dd-mm-yyyy
  tipoFactura: string;
  cuotaTotal: string;
  importeTotal: string;
  huellaAnterior: string; // "" si es el primer registro
  fechaHoraHusoGen: string;
}): Promise<string> {
  const cadena =
    `IDEmisorFactura=${params.idEmisor}` +
    `&NumSerieFactura=${params.numSerie}` +
    `&FechaExpedicionFactura=${params.fechaExpedicion}` +
    `&TipoFactura=${params.tipoFactura}` +
    `&CuotaTotal=${params.cuotaTotal}` +
    `&ImporteTotal=${params.importeTotal}` +
    `&Huella=${params.huellaAnterior}` +
    `&FechaHoraHusoGenRegistro=${params.fechaHoraHusoGen}`;

  const data = new TextEncoder().encode(cadena);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

// ─── Construcción del XML RegistroAlta + SOAP ──────────────
interface RegistroAltaInput {
  emisorNif: string;
  emisorNombre: string;
  numSerie: string;
  fechaExpedicion: string; // dd-mm-yyyy
  tipoFactura: string; // F1
  descripcion: string;
  destinatarioNif?: string;
  destinatarioNombre?: string;
  baseImponible: string;
  tipoImpositivo: string;
  cuotaRepercutida: string;
  cuotaTotal: string;
  importeTotal: string;
  huella: string;
  huellaAnterior: string;
  primerRegistro: boolean;
  fechaHoraHusoGen: string;
  numAnteriorSerie?: string;
  numAnteriorFecha?: string;
}

function buildRegistroAltaXml(r: RegistroAltaInput): string {
  const encadenamiento = r.primerRegistro
    ? `<sf:Encadenamiento><sf:PrimerRegistro>S</sf:PrimerRegistro></sf:Encadenamiento>`
    : `<sf:Encadenamiento><sf:RegistroAnterior>` +
      `<sf:IDEmisorFactura>${xmlEscape(r.emisorNif)}</sf:IDEmisorFactura>` +
      `<sf:NumSerieFactura>${xmlEscape(r.numAnteriorSerie || "")}</sf:NumSerieFactura>` +
      `<sf:FechaExpedicionFactura>${xmlEscape(r.numAnteriorFecha || "")}</sf:FechaExpedicionFactura>` +
      `<sf:Huella>${xmlEscape(r.huellaAnterior)}</sf:Huella>` +
      `</sf:RegistroAnterior></sf:Encadenamiento>`;

  const destinatarios = r.destinatarioNif
    ? `<sf:Destinatarios><sf:IDDestinatario>` +
      `<sf:NombreRazon>${xmlEscape(r.destinatarioNombre || "")}</sf:NombreRazon>` +
      `<sf:NIF>${xmlEscape(r.destinatarioNif)}</sf:NIF>` +
      `</sf:IDDestinatario></sf:Destinatarios>`
    : "";

  return (
    `<sf:RegistroAlta>` +
    `<sf:IDVersion>1.0</sf:IDVersion>` +
    `<sf:IDFactura>` +
    `<sf:IDEmisorFactura>${xmlEscape(r.emisorNif)}</sf:IDEmisorFactura>` +
    `<sf:NumSerieFactura>${xmlEscape(r.numSerie)}</sf:NumSerieFactura>` +
    `<sf:FechaExpedicionFactura>${xmlEscape(r.fechaExpedicion)}</sf:FechaExpedicionFactura>` +
    `</sf:IDFactura>` +
    `<sf:NombreRazonEmisor>${xmlEscape(r.emisorNombre)}</sf:NombreRazonEmisor>` +
    `<sf:TipoFactura>${xmlEscape(r.tipoFactura)}</sf:TipoFactura>` +
    `<sf:DescripcionOperacion>${xmlEscape(r.descripcion)}</sf:DescripcionOperacion>` +
    destinatarios +
    `<sf:Desglose><sf:DetalleDesglose>` +
    `<sf:ClaveRegimen>01</sf:ClaveRegimen>` +
    `<sf:CalificacionOperacion>S1</sf:CalificacionOperacion>` +
    `<sf:TipoImpositivo>${xmlEscape(r.tipoImpositivo)}</sf:TipoImpositivo>` +
    `<sf:BaseImponibleOimporteNoSujeto>${xmlEscape(r.baseImponible)}</sf:BaseImponibleOimporteNoSujeto>` +
    `<sf:CuotaRepercutida>${xmlEscape(r.cuotaRepercutida)}</sf:CuotaRepercutida>` +
    `</sf:DetalleDesglose></sf:Desglose>` +
    `<sf:CuotaTotal>${xmlEscape(r.cuotaTotal)}</sf:CuotaTotal>` +
    `<sf:ImporteTotal>${xmlEscape(r.importeTotal)}</sf:ImporteTotal>` +
    encadenamiento +
    `<sf:SistemaInformatico>` +
    `<sf:NombreRazon>${xmlEscape(SISTEMA_INFORMATICO.nombreRazon)}</sf:NombreRazon>` +
    (SISTEMA_INFORMATICO.nif ? `<sf:NIF>${xmlEscape(SISTEMA_INFORMATICO.nif)}</sf:NIF>` : "") +
    `<sf:NombreSistemaInformatico>${xmlEscape(SISTEMA_INFORMATICO.nombreSistema)}</sf:NombreSistemaInformatico>` +
    `<sf:IdSistemaInformatico>${xmlEscape(SISTEMA_INFORMATICO.idSistema)}</sf:IdSistemaInformatico>` +
    `<sf:Version>${xmlEscape(SISTEMA_INFORMATICO.version)}</sf:Version>` +
    `<sf:NumeroInstalacion>${xmlEscape(SISTEMA_INFORMATICO.numeroInstalacion)}</sf:NumeroInstalacion>` +
    `</sf:SistemaInformatico>` +
    `<sf:FechaHoraHusoGenRegistro>${xmlEscape(r.fechaHoraHusoGen)}</sf:FechaHoraHusoGenRegistro>` +
    `<sf:TipoHuella>01</sf:TipoHuella>` +
    `<sf:Huella>${xmlEscape(r.huella)}</sf:Huella>` +
    `</sf:RegistroAlta>`
  );
}

function buildSoapEnvelope(registroAltaXml: string, cabeceraNif: string, cabeceraNombre: string): string {
  const NS_SUM = "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd";
  const NS_SF = "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd";
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ` +
    `xmlns:sum="${NS_SUM}" xmlns:sf="${NS_SF}">` +
    `<soapenv:Header/>` +
    `<soapenv:Body>` +
    `<sum:RegFactuSistemaFacturacion>` +
    `<sum:Cabecera>` +
    `<sf:ObligadoEmision>` +
    `<sf:NombreRazon>${xmlEscape(cabeceraNombre)}</sf:NombreRazon>` +
    `<sf:NIF>${xmlEscape(cabeceraNif)}</sf:NIF>` +
    `</sf:ObligadoEmision>` +
    `</sum:Cabecera>` +
    `<sum:RegistroFactura>${registroAltaXml}</sum:RegistroFactura>` +
    `</sum:RegFactuSistemaFacturacion>` +
    `</soapenv:Body>` +
    `</soapenv:Envelope>`
  );
}

// Extrae CSV / estado de la respuesta SOAP de la AEAT.
function parseAeatResponse(xml: string): { ok: boolean; csv?: string; estado?: string; errorCode?: string; errorMessage?: string } {
  const csv = xml.match(/<[^>]*CSV>([^<]+)<\/[^>]*CSV>/i)?.[1];
  const estado = xml.match(/<[^>]*EstadoRegistro>([^<]+)<\/[^>]*EstadoRegistro>/i)?.[1]
    || xml.match(/<[^>]*EstadoEnvio>([^<]+)<\/[^>]*EstadoEnvio>/i)?.[1];
  const errorCode = xml.match(/<[^>]*CodigoErrorRegistro>([^<]+)<\/[^>]*CodigoErrorRegistro>/i)?.[1];
  const errorMessage = xml.match(/<[^>]*DescripcionErrorRegistro>([^<]+)<\/[^>]*DescripcionErrorRegistro>/i)?.[1]
    || xml.match(/<faultstring>([^<]+)<\/faultstring>/i)?.[1];
  const ok = !!csv && !errorCode && (!estado || /Correct/i.test(estado));
  return { ok, csv, estado, errorCode, errorMessage };
}

// ─── Handler ───────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const service = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);

    const { data: { user }, error: authError } = await anon.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return json({ error: "No autorizado" }, 401);

    const { invoice_id } = await req.json();
    if (!invoice_id) return json({ error: "invoice_id requerido" }, 400);

    // Factura + cliente
    const { data: invoice, error: invErr } = await service
      .from("invoices")
      .select("*, business_clients(name, tax_id)")
      .eq("id", invoice_id)
      .single();
    if (invErr || !invoice) return json({ error: "Factura no encontrada" }, 404);

    // Comprobación de acceso a la cuenta
    const { data: accountId } = await service.rpc("get_user_account_id", { _user_id: user.id });
    if (accountId !== invoice.account_id) return json({ error: "Sin acceso a esta factura" }, 403);

    if (invoice.type !== "INVOICE") return json({ error: "Sólo las facturas pueden registrarse en VERI*FACTU" }, 400);
    if (invoice.verifactu_status === "SENT") return json({ error: "Esta factura ya está registrada en la AEAT", csv: invoice.verifactu_csv }, 409);

    // Datos de cuenta + ajustes
    const [{ data: account }, { data: settings }] = await Promise.all([
      service.from("accounts").select("name, tax_id").eq("id", invoice.account_id).single(),
      service.from("account_settings").select("verifactu_enabled, verifactu_env, verifactu_nif").eq("account_id", invoice.account_id).single(),
    ]);

    if (!settings?.verifactu_enabled) {
      return json({ error: "VERI*FACTU no está activado. Actívalo en Ajustes → VERI*FACTU." }, 400);
    }

    const env: VerifactuEnv = settings.verifactu_env === "prod" ? "prod" : "sandbox";
    const emisorNif = (settings.verifactu_nif || account?.tax_id || "").trim().toUpperCase();
    const emisorNombre = account?.name || "Empresa";
    if (!emisorNif) return json({ error: "Falta el NIF del emisor (Ajustes → Mi Empresa / VERI*FACTU)." }, 400);

    // Encadenamiento: huella del último registro SENT de la cuenta
    const { data: prev } = await service
      .from("invoices")
      .select("verifactu_huella, invoice_number, issue_date")
      .eq("account_id", invoice.account_id)
      .eq("verifactu_status", "SENT")
      .not("verifactu_huella", "is", null)
      .order("verifactu_registered_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const primerRegistro = !prev?.verifactu_huella;
    const huellaAnterior = prev?.verifactu_huella || "";

    // Cálculo de campos
    const numSerie = invoice.invoice_number || invoice.id.slice(0, 8).toUpperCase();
    const fechaExpedicion = toDdMmYyyy(invoice.issue_date);
    const tipoFactura = "F1";
    const cuotaTotal = money(invoice.amount_vat);
    const importeTotal = money(invoice.amount_total);
    const fhg = fechaHoraHusoGen();

    const huella = await calcularHuella({
      idEmisor: emisorNif,
      numSerie,
      fechaExpedicion,
      tipoFactura,
      cuotaTotal,
      importeTotal,
      huellaAnterior,
      fechaHoraHusoGen: fhg,
    });

    const registroXml = buildRegistroAltaXml({
      emisorNif,
      emisorNombre,
      numSerie,
      fechaExpedicion,
      tipoFactura,
      descripcion: invoice.concept || "Operacion",
      destinatarioNif: invoice.business_clients?.tax_id || undefined,
      destinatarioNombre: invoice.business_clients?.name || undefined,
      baseImponible: money(invoice.amount_net),
      tipoImpositivo: money(invoice.vat_percentage),
      cuotaRepercutida: money(invoice.amount_vat),
      cuotaTotal,
      importeTotal,
      huella,
      huellaAnterior,
      primerRegistro,
      fechaHoraHusoGen: fhg,
      numAnteriorSerie: prev?.invoice_number || undefined,
      numAnteriorFecha: prev ? toDdMmYyyy(prev.issue_date) : undefined,
    });

    const soap = buildSoapEnvelope(registroXml, emisorNif, emisorNombre);

    // URL del QR (incorpora la huella en numserie según especificación futura;
    // por ahora se mantiene el número de serie + parámetros estándar).
    const qrParams = new URLSearchParams({
      nif: emisorNif,
      numserie: numSerie,
      fecha: fechaExpedicion,
      importe: importeTotal,
    });
    const qrUrl = `${QR_BASE_URLS[env]}?${qrParams.toString()}`;

    // ── Envío a la AEAT (requiere certificado de cliente) ──
    const certPem = Deno.env.get("VERIFACTU_CERT");
    const keyPem = Deno.env.get("VERIFACTU_KEY");

    if (!certPem || !keyPem) {
      // Sin certificado: dejamos la factura PREPARED (huella ya encadenada).
      await service.from("invoices").update({
        verifactu_status: "PREPARED",
        verifactu_huella: huella,
        verifactu_huella_anterior: huellaAnterior || null,
        verifactu_xml: soap,
        verifactu_qr_url: qrUrl,
      }).eq("id", invoice_id);

      await service.from("verifactu_events").insert({
        account_id: invoice.account_id,
        invoice_id,
        action: "ALTA",
        status: "PREPARED",
        env,
        huella,
        request_xml: soap,
        error_message: "Certificado no configurado (VERIFACTU_CERT / VERIFACTU_KEY). Registro preparado pero no enviado.",
      });

      return json({
        status: "PREPARED",
        huella,
        message: "Registro preparado y encadenado. Configura el certificado de cliente (secrets VERIFACTU_CERT y VERIFACTU_KEY) para enviarlo a la AEAT.",
      });
    }

    // Cliente HTTP con TLS mutuo
    let responseXml = "";
    let httpOk = false;
    try {
      // @ts-ignore — Deno.createHttpClient admite certificado de cliente
      const client = Deno.createHttpClient({ cert: certPem, key: keyPem });
      const resp = await fetch(REGISTRO_ENDPOINTS[env], {
        method: "POST",
        // @ts-ignore — opción client de Deno
        client,
        headers: { "Content-Type": "text/xml; charset=utf-8", "SOAPAction": "" },
        body: soap,
      });
      responseXml = await resp.text();
      httpOk = resp.ok;
    } catch (e: any) {
      await service.from("invoices").update({
        verifactu_status: "ERROR",
        verifactu_huella: huella,
        verifactu_huella_anterior: huellaAnterior || null,
        verifactu_xml: soap,
        verifactu_qr_url: qrUrl,
      }).eq("id", invoice_id);
      await service.from("verifactu_events").insert({
        account_id: invoice.account_id, invoice_id, action: "ALTA", status: "ERROR", env,
        huella, request_xml: soap, error_message: `Error de conexión con la AEAT: ${e?.message || e}`,
      });
      return json({ status: "ERROR", error: `Error de conexión con la AEAT: ${e?.message || e}` }, 502);
    }

    const parsed = parseAeatResponse(responseXml);
    const finalStatus = parsed.ok && httpOk ? "SENT" : "ERROR";

    await service.from("invoices").update({
      verifactu_status: finalStatus,
      verifactu_huella: huella,
      verifactu_huella_anterior: huellaAnterior || null,
      verifactu_csv: parsed.csv || null,
      verifactu_registered_at: finalStatus === "SENT" ? new Date().toISOString() : null,
      verifactu_xml: soap,
      verifactu_qr_url: qrUrl,
    }).eq("id", invoice_id);

    await service.from("verifactu_events").insert({
      account_id: invoice.account_id, invoice_id, action: "ALTA", status: finalStatus, env,
      huella, csv: parsed.csv || null, request_xml: soap, response_xml: responseXml,
      error_code: parsed.errorCode || null, error_message: parsed.errorMessage || null,
    });

    if (finalStatus !== "SENT") {
      return json({ status: "ERROR", error: parsed.errorMessage || "La AEAT rechazó el registro", code: parsed.errorCode }, 400);
    }

    return json({ status: "SENT", csv: parsed.csv, huella });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
