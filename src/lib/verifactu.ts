/**
 * VERI*FACTU — Utilidades para construir el QR tributario AEAT
 *
 * Especificación: el QR de las facturas verificables debe incluir una URL
 * apuntando al servicio de verificación de la AEAT. La URL debe componerse
 * con los siguientes parámetros obligatorios codificados (URL-encoded):
 *
 *   - nif       NIF del emisor (8 dígitos + letra, o letra + 7 dígitos + control)
 *   - numserie  Número/serie de la factura (1-60 chars; en futuro incluirá huella/hash)
 *   - fecha     Fecha de expedición en formato dd-mm-yyyy
 *   - importe   Importe total con 2 decimales (formato 0.00, hasta 12 dígitos antes del punto)
 *
 * Parámetros opcionales:
 *   - idioma    es | ca | eu | gl | va | en
 *   - formato   NUNCA incluir "json" en la URL del QR de la factura (sólo M2M)
 *
 * Entornos:
 *   - sandbox  prepro7.aeat.es (pruebas, por defecto)
 *   - prod     www2.agenciatributaria.gob.es (producción real)
 *
 * Cuando se active la integración real con la AEAT, basta con cambiar
 * VERIFACTU_ENV a "prod" (o sobrescribirlo desde la UI/configuración).
 */

export type VerifactuEnv = "sandbox" | "prod";

/**
 * Entorno por defecto. Cambiar a "prod" cuando se active la integración real
 * con la AEAT. El módulo está preparado para alternar simplemente con esta variable.
 */
export const VERIFACTU_ENV: VerifactuEnv = "sandbox";

const VERIFACTU_BASE_URLS: Record<VerifactuEnv, string> = {
  sandbox: "https://prepro7.aeat.es/wlpl/TIKE-CONT/ValidarQR",
  prod: "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR",
};

export type VerifactuLang = "es" | "ca" | "eu" | "gl" | "va" | "en";

export interface VerifactuQRParams {
  /** NIF del emisor */
  nif: string;
  /** Número/serie de la factura. En el futuro incluirá la huella/hash de la cadena. */
  numserie: string;
  /** Fecha de expedición — admite Date, ISO yyyy-mm-dd o dd-mm-yyyy */
  fecha: string | Date;
  /** Importe total */
  importe: number | string;
  /** Idioma opcional para la respuesta del servicio AEAT */
  idioma?: VerifactuLang;
  /** Entorno (por defecto VERIFACTU_ENV) */
  env?: VerifactuEnv;
}

// ─── Códigos de error AEAT ─────────────────────────────────
export const VERIFACTU_ERROR_MESSAGES: Record<string, string> = {
  // 1xxx: parámetros obligatorios ausentes
  "1001": "Falta el parámetro obligatorio 'nif' (NIF del emisor).",
  "1002": "Falta el parámetro obligatorio 'numserie' (número/serie de la factura).",
  "1003": "Falta el parámetro obligatorio 'fecha' (fecha de expedición).",
  "1004": "Falta el parámetro obligatorio 'importe'.",
  // 2xxx: validaciones de formato
  "2001": "El NIF indicado no es válido.",
  "2002": "El número de serie tiene un formato incorrecto.",
  "2003": "El número de serie excede la longitud permitida (máx. 60 caracteres).",
  "2004": "La fecha tiene un formato incorrecto. Se espera dd-mm-yyyy.",
  "2005": "El importe tiene un formato incorrecto (debe ser 0.00 con punto decimal).",
  "2006": "El importe excede la longitud permitida.",
  // 3xxx: errores técnicos AEAT
  "3001": "Error técnico en los sistemas de la AEAT. Por favor, reintente más tarde.",
  "3002": "Se ha superado el límite de intentos diarios. Inténtelo de nuevo mañana.",
};

export class VerifactuValidationError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || VERIFACTU_ERROR_MESSAGES[code] || `Error VERI*FACTU ${code}`);
    this.code = code;
    this.name = "VerifactuValidationError";
  }
}

// ─── Helpers de validación ─────────────────────────────────
const NIF_REGEX = /^([A-HJNP-SUVW]\d{7}[0-9A-J]|\d{8}[A-Z]|[XYZ]\d{7}[A-Z])$/i;

function normalizeFecha(fecha: string | Date): string {
  if (fecha instanceof Date) {
    const dd = String(fecha.getDate()).padStart(2, "0");
    const mm = String(fecha.getMonth() + 1).padStart(2, "0");
    const yyyy = fecha.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  // ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const [y, m, d] = fecha.split("-");
    return `${d}-${m}-${y}`;
  }
  // ya en dd-mm-yyyy
  if (/^\d{2}-\d{2}-\d{4}$/.test(fecha)) return fecha;
  // dd/mm/yyyy
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) return fecha.replace(/\//g, "-");
  throw new VerifactuValidationError("2004");
}

function normalizeImporte(importe: number | string): string {
  const num = typeof importe === "number" ? importe : parseFloat(String(importe).replace(",", "."));
  if (!isFinite(num)) throw new VerifactuValidationError("2005");
  const str = num.toFixed(2);
  // longitud: hasta 12 dígitos enteros + "." + 2 decimales = 15
  if (str.length > 15) throw new VerifactuValidationError("2006");
  return str;
}

/**
 * Construye la URL del QR tributario VERI*FACTU para una factura.
 * Lanza VerifactuValidationError con código AEAT si los parámetros no son válidos.
 */
export function buildVerifactuQRUrl(params: VerifactuQRParams): string {
  const { nif, numserie, fecha, importe, idioma, env } = params;

  if (!nif || !nif.trim()) throw new VerifactuValidationError("1001");
  if (!numserie || !String(numserie).trim()) throw new VerifactuValidationError("1002");
  if (fecha === undefined || fecha === null || fecha === "") throw new VerifactuValidationError("1003");
  if (importe === undefined || importe === null || importe === "") throw new VerifactuValidationError("1004");

  const cleanNif = nif.trim().toUpperCase();
  if (!NIF_REGEX.test(cleanNif)) throw new VerifactuValidationError("2001");

  const cleanSerie = String(numserie).trim();
  if (!/^[A-Za-z0-9\-_/.]+$/.test(cleanSerie)) throw new VerifactuValidationError("2002");
  if (cleanSerie.length > 60) throw new VerifactuValidationError("2003");

  const fechaStr = normalizeFecha(fecha);
  const importeStr = normalizeImporte(importe);

  const base = VERIFACTU_BASE_URLS[env || VERIFACTU_ENV];
  const qs = new URLSearchParams();
  qs.set("nif", cleanNif);
  qs.set("numserie", cleanSerie);
  qs.set("fecha", fechaStr);
  qs.set("importe", importeStr);
  if (idioma) qs.set("idioma", idioma);
  // NOTA: NUNCA añadir formato=json a la URL del QR de la factura.

  return `${base}?${qs.toString()}`;
}

/**
 * Construye la URL de forma segura, devolviendo `{ url, error }` en lugar de lanzar.
 * Útil para componentes UI que quieran mostrar el error en pantalla.
 */
export function tryBuildVerifactuQRUrl(
  params: VerifactuQRParams
): { url: string | null; error: { code: string; message: string } | null } {
  try {
    return { url: buildVerifactuQRUrl(params), error: null };
  } catch (e: any) {
    if (e instanceof VerifactuValidationError) {
      return { url: null, error: { code: e.code, message: e.message } };
    }
    return { url: null, error: { code: "0000", message: e?.message || "Error desconocido" } };
  }
}
