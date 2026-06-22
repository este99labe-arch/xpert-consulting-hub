/**
 * VERI*FACTU — Cliente de envío de registros de facturación a la AEAT
 *
 * La lógica real (firma/huella encadenada, construcción del XML y envío SOAP
 * con TLS mutuo) vive en la edge function `verifactu_submit`, porque requiere
 * el certificado de cliente y NUNCA debe ejecutarse en el navegador.
 *
 * Este módulo es un simple cliente que invoca dicha función.
 */

import { supabase } from "@/integrations/supabase/client";

export type VerifactuStatus = "NONE" | "PREPARED" | "SENT" | "ERROR";

export interface VerifactuSubmitResult {
  status: VerifactuStatus;
  csv?: string;
  huella?: string;
  message?: string;
  error?: string;
  code?: string;
}

/**
 * Registra (alta) una factura en la AEAT vía VERI*FACTU.
 *
 * Devuelve:
 *   - status "SENT"     → registrada (incluye `csv`)
 *   - status "PREPARED" → XML y huella generados pero sin certificado configurado
 *   - status "ERROR"    → rechazada o error de conexión (incluye `error`)
 */
export async function registrarFacturaVerifactu(invoiceId: string): Promise<VerifactuSubmitResult> {
  const { data, error } = await supabase.functions.invoke("verifactu_submit", {
    body: { invoice_id: invoiceId },
  });

  // supabase.functions.invoke devuelve error en respuestas no 2xx; intentamos
  // extraer el mensaje del cuerpo de la respuesta.
  if (error) {
    let serverMessage: string | undefined = (data as any)?.error;
    try {
      const ctx: any = (error as any).context;
      if (ctx?.body) {
        const text = typeof ctx.body === "string" ? ctx.body : await new Response(ctx.body).text();
        const parsed = JSON.parse(text);
        serverMessage = parsed?.error || serverMessage;
      }
    } catch {
      /* ignore */
    }
    return { status: "ERROR", error: serverMessage || error.message || "Error al registrar en la AEAT" };
  }

  return data as VerifactuSubmitResult;
}
