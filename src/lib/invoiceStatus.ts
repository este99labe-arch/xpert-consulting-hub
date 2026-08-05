import { supabase } from "@/integrations/supabase/client";

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador", SENT: "Enviada", PAID: "Pagada", PARTIALLY_PAID: "Pago parcial",
  OVERDUE: "Vencida", CANCELLED: "Cancelada",
  ACCEPTED: "Aceptado", REJECTED: "Rechazado", INVOICED: "Facturado",
};

/**
 * Marca una factura como pagada registrando el COBRO del saldo pendiente.
 *
 * No basta con cambiar el estado: el asiento de tesorería lo genera el trigger
 * sobre invoice_payments. Si solo se tocara el estado, la factura figuraría
 * pagada pero el dinero nunca entraría en la cuenta de tesorería y el KPI de
 * disponible en banco quedaría descuadrado.
 */
export const markInvoicePaid = async (
  invoice: { id: string; amount_total: number | string; payment_method?: string | null },
  accountId: string,
  userId: string,
) => {
  const { data: pays } = await supabase
    .from("invoice_payments").select("amount").eq("invoice_id", invoice.id);
  const paid = (pays || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const remaining = +(Number(invoice.amount_total || 0) - paid).toFixed(2);

  if (remaining > 0.01) {
    const method = invoice.payment_method === "DIRECT_DEBIT"
      ? "TRANSFER"
      : (invoice.payment_method || "TRANSFER");
    const { error } = await supabase.from("invoice_payments").insert({
      invoice_id: invoice.id, account_id: accountId, amount: remaining,
      payment_date: new Date().toISOString().slice(0, 10),
      method, notes: "Saldo total", created_by: userId,
    } as any);
    if (error) throw error;
  }

  const { error } = await supabase.from("invoices")
    .update({ status: "PAID", paid_at: new Date().toISOString() })
    .eq("id", invoice.id);
  if (error) throw error;
};

/**
 * Reabre una factura pagada: elimina los cobros —lo que revierte su asiento
 * por el trigger— y la devuelve a "Enviada".
 */
export const reopenInvoice = async (invoiceId: string) => {
  const { error: delErr } = await supabase
    .from("invoice_payments").delete().eq("invoice_id", invoiceId);
  if (delErr) throw delErr;

  const { error } = await supabase.from("invoices")
    .update({ status: "SENT", paid_at: null }).eq("id", invoiceId);
  if (error) throw error;
};

/**
 * Convierte un presupuesto aceptado en factura: crea la factura con sus
 * importes y marca el presupuesto como "Facturado".
 */
export const convertQuoteToInvoice = async (quote: any) => {
  const { error: invErr } = await supabase.from("invoices").insert({
    account_id: quote.account_id, client_id: quote.client_id,
    type: "INVOICE", status: "DRAFT", concept: quote.concept,
    issue_date: new Date().toISOString().slice(0, 10),
    amount_net: quote.amount_net, vat_percentage: quote.vat_percentage,
    amount_vat: quote.amount_vat, amount_total: quote.amount_total,
    irpf_percentage: quote.irpf_percentage || 0,
    irpf_amount: quote.irpf_amount || 0,
    attachment_path: quote.attachment_path, attachment_name: quote.attachment_name,
  } as any);
  if (invErr) throw invErr;

  const { error } = await supabase.from("invoices")
    .update({ status: "INVOICED" }).eq("id", quote.id);
  if (error) throw error;
};

/** Cambio de estado simple (no toca cobros ni contabilidad). */
export const setInvoiceStatus = async (invoiceId: string, status: string) => {
  const { error } = await supabase.from("invoices").update({ status }).eq("id", invoiceId);
  if (error) throw error;
};
