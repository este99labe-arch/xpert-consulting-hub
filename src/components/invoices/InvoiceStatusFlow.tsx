import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Circle, Ban, Loader2, BadgeEuro, RotateCcw } from "lucide-react";

/**
 * Ciclo de vida de una factura, en orden. El estado se representa como un
 * camino recorrido en vez de como una lista de botones iguales: de un vistazo
 * se ve dónde está la factura y qué falta para cobrarla.
 */
const INVOICE_FLOW = [
  { key: "DRAFT", label: "Borrador", hint: "Sin numerar" },
  { key: "SENT", label: "Enviada", hint: "Pendiente de cobro" },
  { key: "PAID", label: "Pagada", hint: "Cobrada" },
] as const;

const QUOTE_FLOW = [
  { key: "DRAFT", label: "Borrador", hint: "En preparación" },
  { key: "SENT", label: "Enviado", hint: "Pendiente de respuesta" },
  { key: "ACCEPTED", label: "Aceptado", hint: "Listo para facturar" },
  { key: "INVOICED", label: "Facturado", hint: "Convertido" },
] as const;

/** Estados fuera del camino feliz: se muestran aparte, no como un paso más. */
const OFF_FLOW: Record<string, { label: string; tone: string }> = {
  OVERDUE: { label: "Vencida", tone: "text-destructive" },
  PARTIALLY_PAID: { label: "Pago parcial", tone: "text-[hsl(var(--warning))]" },
  CANCELLED: { label: "Cancelada", tone: "text-muted-foreground" },
  REJECTED: { label: "Rechazado", tone: "text-destructive" },
};

interface Props {
  current: string;
  isQuote: boolean;
  /** Estado elegido pero aún sin guardar. */
  pending?: string;
  onSelect: (status: string) => void;
  onMarkPaid?: () => void;
  onReopen?: () => void;
  busy?: boolean;
}

const InvoiceStatusFlow = ({
  current, isQuote, pending, onSelect, onMarkPaid, onReopen, busy,
}: Props) => {
  const flow = isQuote ? QUOTE_FLOW : INVOICE_FLOW;
  const shown = pending || current;
  const idx = flow.findIndex((s) => s.key === shown);
  const off = OFF_FLOW[shown];

  return (
    <div className="space-y-4">
      {/* Camino de estados */}
      <div className="flex items-stretch gap-1">
        {flow.map((step, i) => {
          const done = idx >= 0 && i < idx;
          const active = i === idx;
          // Solo se puede avanzar al paso siguiente o retroceder a uno pasado.
          const selectable = !active && (i <= idx + 1 || idx < 0);
          const isPaidStep = step.key === "PAID";

          return (
            <button
              key={step.key}
              type="button"
              disabled={!selectable || busy || (isPaidStep && !!onMarkPaid)}
              onClick={() => {
                if (isPaidStep && onMarkPaid) return onMarkPaid();
                onSelect(step.key);
              }}
              className={cn(
                "group relative flex flex-1 flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all",
                active && "border-primary bg-primary/10 shadow-sm",
                done && "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5",
                !active && !done && "border-border bg-card",
                selectable && !busy && "hover:border-primary/50 hover:bg-accent cursor-pointer",
                !selectable && !active && "opacity-50",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                  active && "bg-primary text-primary-foreground",
                  done && "bg-[hsl(var(--success))] text-white",
                  !active && !done && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={cn("text-sm font-medium", active && "text-primary")}>{step.label}</span>
              <span className="text-[11px] leading-tight text-muted-foreground">{step.hint}</span>
              {active && (
                <span className="absolute -top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  ACTUAL
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Estado fuera del camino habitual */}
      {off && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
          <Circle className={cn("h-3 w-3 fill-current", off.tone)} />
          <span className="text-sm">
            Estado actual: <strong className={off.tone}>{off.label}</strong>
          </span>
        </div>
      )}

      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-2">
        {onMarkPaid && current !== "PAID" && (
          <Button size="sm" className="gap-1.5" onClick={onMarkPaid} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeEuro className="h-4 w-4" />}
            Marcar como pagada
          </Button>
        )}
        {onReopen && current === "PAID" && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onReopen} disabled={busy}>
            <RotateCcw className="h-4 w-4" /> Reabrir
          </Button>
        )}
        {current !== "CANCELLED" && shown !== "CANCELLED" && (
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground"
            onClick={() => onSelect("CANCELLED")} disabled={busy}>
            <Ban className="h-4 w-4" /> Cancelar factura
          </Button>
        )}
        {pending && pending !== current && (
          <Button variant="ghost" size="sm" onClick={() => onSelect(current)} disabled={busy}>
            Deshacer cambio
          </Button>
        )}
      </div>

      {onMarkPaid && current !== "PAID" && (
        <p className="text-xs text-muted-foreground">
          Al marcarla como pagada se registra el cobro del saldo pendiente y se contabiliza en tesorería.
        </p>
      )}
    </div>
  );
};

export default InvoiceStatusFlow;
