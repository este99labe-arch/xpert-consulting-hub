import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, Download, BadgeEuro, Mail, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtEUR } from "@/lib/format";
import { INVOICE_STATUS_LABELS } from "@/lib/invoiceStatus";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "success" | "softDestructive" | "warning" | "info" | "muted"> = {
  PAID: "success",
  OVERDUE: "softDestructive",
  PARTIALLY_PAID: "warning",
  SENT: "info",
  DRAFT: "muted",
  CANCELLED: "muted",
  ACCEPTED: "success",
  REJECTED: "softDestructive",
  INVOICED: "info",
};

const PAYMENT_LABELS: Record<string, string> = {
  TRANSFER: "Transferencia",
  CASH: "Efectivo",
  CARD: "Tarjeta",
  DIRECT_DEBIT: "Domiciliación",
  OTHER: "Otro",
};

interface Props {
  invoice: any;
  onBack: () => void;
  onEdit: () => void;
  onExport: () => void;
  onSendEmail?: () => void;
  onMarkPaid?: () => void;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[.06em] text-faint">{label}</p>
    <div className="mt-1.5 text-xs leading-[1.6] text-foreground">{children}</div>
  </div>
);

/**
 * Detalle de factura a página completa.
 *
 * Sustituye al diálogo de edición como forma de *ver* una factura: un modal
 * obliga a cerrarlo para consultar cualquier otra cosa y no deja sitio para
 * el contexto (cliente, avisos, trazabilidad). Editar sigue abriendo el
 * diálogo, que para eso está.
 */
const InvoiceDetailView = ({ invoice, onBack, onEdit, onExport, onSendEmail, onMarkPaid }: Props) => {
  const { accountId } = useAuth();

  const { data: lines = [] } = useQuery({
    queryKey: ["invoice-lines", invoice.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_lines").select("*").eq("invoice_id", invoice.id).order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: account } = useQuery({
    queryKey: ["my-account", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts").select("name, tax_id, address").eq("id", accountId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["invoice-payments", invoice.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_payments").select("*").eq("invoice_id", invoice.id).order("payment_date");
      if (error) throw error;
      return data || [];
    },
  });

  /* Métricas del cliente: facturado en 12 meses y días medios de cobro.
     Ambas salen de facturas ya existentes, no de ningún dato nuevo. */
  const { data: clientStats } = useQuery({
    queryKey: ["client-invoice-stats", invoice.client_id],
    queryFn: async () => {
      const since = format(new Date(Date.now() - 365 * 864e5), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("invoices")
        .select("amount_total, issue_date, paid_at, type")
        .eq("client_id", invoice.client_id!)
        .gte("issue_date", since);
      if (error) throw error;
      const rows = (data || []).filter((r: any) => r.type === "INVOICE");
      const billed = rows.reduce((s: number, r: any) => s + Number(r.amount_total || 0), 0);
      const paid = rows.filter((r: any) => r.paid_at);
      const avgDays = paid.length
        ? Math.round(
            paid.reduce(
              (s: number, r: any) => s + differenceInCalendarDays(parseISO(r.paid_at), parseISO(r.issue_date)),
              0,
            ) / paid.length,
          )
        : null;
      return { billed, avgDays };
    },
    enabled: !!invoice.client_id,
  });

  /** Línea de tiempo a partir de los hechos que la factura ya registra. */
  const timeline = useMemo(() => {
    const events: { title: string; at: string; detail?: string }[] = [];
    if (invoice.created_at) {
      events.push({ title: "Factura creada", at: invoice.created_at });
    }
    if (invoice.status !== "DRAFT" && invoice.issue_date) {
      events.push({
        title: "Emitida",
        at: `${invoice.issue_date}T00:00:00`,
        detail: invoice.business_clients?.email || undefined,
      });
    }
    if (invoice.verifactu_registered_at) {
      events.push({ title: "Registrada en la AEAT", at: invoice.verifactu_registered_at, detail: "VERI*FACTU" });
    }
    for (const p of payments as any[]) {
      events.push({
        title: `Cobro de ${fmtEUR(p.amount)}`,
        at: `${p.payment_date}T00:00:00`,
        detail: PAYMENT_LABELS[p.method] || p.method,
      });
    }
    if (invoice.paid_at) events.push({ title: "Marcada como pagada", at: invoice.paid_at });
    // El más reciente arriba
    return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [invoice, payments]);

  const overdueDays =
    invoice.due_date && !["PAID", "CANCELLED", "DRAFT"].includes(invoice.status)
      ? differenceInCalendarDays(new Date(), parseISO(invoice.due_date))
      : 0;

  const paidAmount = (payments as any[]).reduce((s, p) => s + Number(p.amount || 0), 0);
  const client = invoice.business_clients;
  const clientInitials = (client?.name || "—").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-4">
      {/* ── Barra superior ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/[.16]"
        >
          <ChevronLeft className="h-3.5 w-3.5 stroke-[1.8]" />
          Facturas
        </button>
        <span className="text-faint">/</span>
        <span className="tnum text-xs font-semibold text-foreground">
          {invoice.invoice_number || invoice.id.slice(0, 8).toUpperCase()}
        </span>
        <Badge variant={STATUS_VARIANT[invoice.status] ?? "muted"}>
          {INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}
          {overdueDays > 0 && ` · ${overdueDays} días`}
        </Badge>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" onClick={onExport}>
            <Download /> Descargar PDF
          </Button>
          <Button variant="secondary" onClick={onEdit}>
            <Pencil /> Editar
          </Button>
          {onMarkPaid && invoice.status !== "PAID" && (
            <Button variant="secondary" onClick={onMarkPaid}>
              <BadgeEuro /> Marcar cobrada
            </Button>
          )}
          {onSendEmail && (
            <Button onClick={onSendEmail}>
              <Mail /> Enviar recordatorio
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_330px]">
        {/* ── Documento ────────────────────────────────────────── */}
        <Card className="px-6 py-6 lg:px-[26px]">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-[15px] font-semibold text-foreground">{account?.name || "—"}</p>
              {account?.tax_id && <p className="tnum mt-1 text-[11px] text-muted-foreground">{account.tax_id}</p>}
              {account?.address && <p className="mt-0.5 text-[11px] text-muted-foreground">{account.address}</p>}
            </div>
            <div className="text-right">
              <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[.06em] text-faint">
                {invoice.type === "EXPENSE" ? "Gasto" : invoice.type === "QUOTE" ? "Presupuesto" : "Factura"}
              </p>
              <p className="tnum mt-1 text-[22px] font-semibold tracking-[-.02em] text-figure">
                {invoice.invoice_number || invoice.id.slice(0, 8).toUpperCase()}
              </p>
              <p className="tnum mt-1 text-[11px] text-muted-foreground">
                Emitida {format(parseISO(invoice.issue_date), "d MMM", { locale: es })}
                {invoice.due_date && ` · vence ${format(parseISO(invoice.due_date), "d MMM", { locale: es })}`}
              </p>
            </div>
          </div>

          <div className="my-6 border-t border-border" />

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Facturar a">
              <p className="font-medium">{client?.name || "Sin cliente asignado"}</p>
              {(client?.tax_id || client?.email) && (
                <p className="tnum mt-0.5 text-[11px] text-muted-foreground">
                  {[client?.tax_id, client?.email].filter(Boolean).join(" · ")}
                </p>
              )}
              {client?.address && <p className="mt-0.5 text-[11px] text-muted-foreground">{client.address}</p>}
            </Field>
            <Field label="Forma de pago">
              <p className="font-medium">
                {PAYMENT_LABELS[invoice.payment_method] || invoice.payment_method || "—"}
                {invoice.due_date && invoice.issue_date && (
                  <span className="tnum">
                    {" · "}
                    {differenceInCalendarDays(parseISO(invoice.due_date), parseISO(invoice.issue_date))} días
                  </span>
                )}
              </p>
            </Field>
          </div>

          {/* Líneas */}
          <div className="mt-6 overflow-hidden rounded-control border border-border">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3.5 py-2.5 text-left font-mono text-[9.5px] font-semibold uppercase tracking-[.06em] text-faint">
                    Concepto
                  </th>
                  <th className="w-16 px-3.5 py-2.5 text-right font-mono text-[9.5px] font-semibold uppercase tracking-[.06em] text-faint">
                    Cant.
                  </th>
                  <th className="w-24 px-3.5 py-2.5 text-right font-mono text-[9.5px] font-semibold uppercase tracking-[.06em] text-faint">
                    Precio
                  </th>
                  <th className="w-16 px-3.5 py-2.5 text-right font-mono text-[9.5px] font-semibold uppercase tracking-[.06em] text-faint">
                    IVA
                  </th>
                  <th className="w-28 px-3.5 py-2.5 text-right font-mono text-[9.5px] font-semibold uppercase tracking-[.06em] text-faint">
                    Importe
                  </th>
                </tr>
              </thead>
              <tbody>
                {(lines.length ? lines : [{ id: "x", description: invoice.concept, quantity: 1, unit_price: invoice.amount_net }]).map(
                  (l: any) => (
                    <tr key={l.id} className="border-t border-border-subtle">
                      <td className="px-3.5 py-2.5 text-xs text-foreground">{l.description || "—"}</td>
                      <td className="tnum px-3.5 py-2.5 text-right text-xs text-muted-foreground">{Number(l.quantity)}</td>
                      <td className="tnum px-3.5 py-2.5 text-right text-xs text-muted-foreground">
                        {Number(l.unit_price).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="tnum px-3.5 py-2.5 text-right text-xs text-muted-foreground">
                        {Number(invoice.vat_percentage || 0)}%
                      </td>
                      <td className="tnum px-3.5 py-2.5 text-right text-xs text-figure">
                        {(Number(l.quantity) * Number(l.unit_price)).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>

          {/* Totales */}
          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-[260px] space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-[11.5px] text-muted-foreground">Base imponible</span>
                <span className="tnum text-xs text-foreground">{fmtEUR(invoice.amount_net)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11.5px] text-muted-foreground">IVA {Number(invoice.vat_percentage || 0)}%</span>
                <span className="tnum text-xs text-foreground">{fmtEUR(invoice.amount_vat)}</span>
              </div>
              {Number(invoice.irpf_amount) > 0 && (
                <div className="flex items-baseline justify-between">
                  <span className="text-[11.5px] text-muted-foreground">
                    Retención IRPF {Number(invoice.irpf_percentage || 0)}%
                  </span>
                  <span className="tnum text-xs text-destructive-text">−{fmtEUR(invoice.irpf_amount)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-border pt-3">
                <span className="text-xs font-semibold text-foreground">Total</span>
                <span className="tnum text-[24px] font-semibold tracking-[-.02em] text-figure">
                  {fmtEUR(invoice.amount_total)}
                </span>
              </div>
              {paidAmount > 0 && paidAmount < Number(invoice.amount_total) && (
                <div className="flex items-baseline justify-between">
                  <span className="text-[11.5px] text-muted-foreground">Pendiente</span>
                  <span className="tnum text-xs text-warning-text">
                    {fmtEUR(Number(invoice.amount_total) - paidAmount)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* ── Contexto ─────────────────────────────────────────── */}
        <div className="space-y-4">
          {overdueDays > 0 && (
            <Card tone="alert" className="px-[18px] py-4">
              <p className="text-xs font-semibold text-destructive-text">Vencida hace {overdueDays} días</p>
              <p className="mt-1.5 text-[11.5px] leading-[1.6] text-muted-foreground">
                Vencía el {format(parseISO(invoice.due_date), "d 'de' MMMM", { locale: es })}
                {paidAmount > 0 && ` · cobrado ${fmtEUR(paidAmount)} de ${fmtEUR(invoice.amount_total)}`}.
              </p>
              {onSendEmail && (
                <div className="mt-4 flex gap-2">
                  <Button variant="destructive" onClick={onSendEmail}>
                    Enviar recordatorio
                  </Button>
                </div>
              )}
            </Card>
          )}

          <Card className="px-[18px] py-4">
            <p className="text-[12.5px] font-semibold text-foreground">Cliente</p>
            <div className="mt-3 flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--border-strong))] text-[11px] font-semibold text-accent-foreground">
                {clientInitials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-foreground">{client?.name || "—"}</p>
                {client?.tax_id && <p className="tnum text-[10.5px] text-muted-foreground">{client.tax_id}</p>}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10.5px] text-muted-foreground">Facturado 12 m</p>
                <p className="tnum mt-0.5 text-sm font-semibold text-figure">
                  {clientStats ? fmtEUR(clientStats.billed) : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10.5px] text-muted-foreground">Pago medio</p>
                <p
                  className={cn(
                    "tnum mt-0.5 text-sm font-semibold",
                    clientStats?.avgDays != null && clientStats.avgDays > 45 ? "text-destructive-text" : "text-figure",
                  )}
                >
                  {clientStats?.avgDays != null ? `${clientStats.avgDays} días` : "—"}
                </p>
              </div>
            </div>
          </Card>

          <Card className="px-[18px] py-4">
            <p className="text-[12.5px] font-semibold text-foreground">Trazabilidad</p>
            <ol className="mt-3.5 space-y-0">
              {timeline.map((e, i) => (
                <li key={`${e.title}-${e.at}`} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < timeline.length - 1 && (
                    <span className="absolute left-[3px] top-3 h-full w-px bg-border" aria-hidden />
                  )}
                  <span
                    className={cn(
                      "relative mt-1 h-[7px] w-[7px] shrink-0 rounded-full",
                      i === 0 ? "bg-accent-foreground" : "bg-border-strong",
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-[11.5px] font-medium text-foreground">{e.title}</p>
                    <p className="tnum mt-0.5 text-[10.5px] text-muted-foreground">
                      {format(new Date(e.at), "d MMM HH:mm", { locale: es })}
                      {e.detail && <span className="text-faint"> · {e.detail}</span>}
                    </p>
                  </div>
                </li>
              ))}
              {timeline.length === 0 && (
                <li className="text-[11.5px] text-muted-foreground">Sin movimientos registrados.</li>
              )}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetailView;
