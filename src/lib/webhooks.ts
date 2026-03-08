import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget webhook dispatch.
 * Calls the dispatch_webhooks edge function in the background.
 */
export async function dispatchWebhook(
  accountId: string,
  event: string,
  payload: Record<string, any>
) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    // Fire and forget — don't await or block the UI
    fetch(`https://${projectId}.supabase.co/functions/v1/dispatch_webhooks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ account_id: accountId, event, payload }),
    }).catch(() => {
      // Silently ignore webhook dispatch errors
    });
  } catch {
    // Silently ignore
  }
}

/** Available webhook event types */
export const WEBHOOK_EVENTS = [
  { value: "invoice.created", label: "Factura creada" },
  { value: "invoice.updated", label: "Factura actualizada" },
  { value: "invoice.deleted", label: "Factura eliminada" },
  { value: "invoice.paid", label: "Factura pagada" },
  { value: "invoice.sent", label: "Factura enviada por email" },
  { value: "stock.low", label: "Stock bajo" },
  { value: "stock.movement", label: "Movimiento de stock" },
  { value: "client.created", label: "Cliente creado" },
  { value: "employee.created", label: "Empleado creado" },
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]["value"];
