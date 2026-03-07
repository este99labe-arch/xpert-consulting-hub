import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  PAID: "Pagada",
  OVERDUE: "Vencida",
};

const statusColors: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-primary/10 text-primary",
  PAID: "bg-green-100 text-green-800",
  OVERDUE: "bg-destructive/10 text-destructive",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any | null;
}

const InvoicePreviewDialog = ({ open, onOpenChange, invoice }: Props) => {
  if (!invoice) return null;

  const clientName = invoice.business_clients?.name || "—";
  const clientTaxId = invoice.business_clients?.tax_id || "—";
  const clientEmail = invoice.business_clients?.email || "";
  const typeLabel = invoice.type === "INVOICE" ? "FACTURA" : "GASTO";

  const fmt = (n: number) => `€${Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2 })}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Vista Previa — {typeLabel}</span>
            <Badge variant="secondary" className={statusColors[invoice.status]}>
              {statusLabels[invoice.status] || invoice.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Header info */}
          <div className="flex justify-between text-sm">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">ID</p>
              <p className="font-mono font-semibold">{invoice.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Fecha emisión</p>
              <p className="font-semibold">{format(new Date(invoice.issue_date), "dd MMM yyyy", { locale: es })}</p>
            </div>
          </div>

          <Separator />

          {/* Client */}
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Cliente</p>
            <p className="font-semibold text-foreground">{clientName}</p>
            <p className="text-sm text-muted-foreground">NIF/CIF: {clientTaxId}</p>
            {clientEmail && <p className="text-sm text-muted-foreground">{clientEmail}</p>}
          </div>

          <Separator />

          {/* Concept */}
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Concepto</p>
            <p className="text-foreground">{invoice.concept || "—"}</p>
          </div>

          <Separator />

          {/* Amounts */}
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Base imponible</span>
              <span className="font-mono">{fmt(invoice.amount_net)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">IVA ({invoice.vat_percentage}%)</span>
              <span className="font-mono">{fmt(invoice.amount_vat)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold text-primary">
              <span>Total</span>
              <span className="font-mono">{fmt(invoice.amount_total)}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoicePreviewDialog;
