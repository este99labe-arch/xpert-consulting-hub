import {
  MoreHorizontal, Eye, Download, Pencil, Trash2, Mail, CalendarClock, ShieldCheck,
  RefreshCw, Check, BadgeEuro, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador", SENT: "Enviada", PAID: "Pagada", PARTIALLY_PAID: "Pago parcial",
  OVERDUE: "Vencida", CANCELLED: "Cancelada",
  ACCEPTED: "Aceptado", REJECTED: "Rechazado", INVOICED: "Facturado",
};

// PAID no se fija a mano: se alcanza registrando el cobro, que es lo que
// genera el asiento de tesorería.
const INVOICE_STATUSES = ["DRAFT", "SENT", "OVERDUE", "CANCELLED"];
const QUOTE_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "CANCELLED"];

interface Props {
  onPreview: () => void;
  onExport: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSendEmail?: () => void;
  onReminder?: () => void;
  onRegisterVerifactu?: () => void;
  verifactuStatus?: string;
  /** Estado actual, para marcarlo en el submenú. */
  status?: string;
  isQuote?: boolean;
  onChangeStatus?: (status: string) => void;
  /** Registra el cobro pendiente y deja la factura pagada. */
  onMarkPaid?: () => void;
  onReopen?: () => void;
  /** Solo presupuestos: genera la factura y marca el presupuesto como facturado. */
  onConvertToInvoice?: () => void;
}

const InvoiceActionsMenu = ({
  onPreview, onExport, onEdit, onDelete, onSendEmail, onReminder, onRegisterVerifactu,
  verifactuStatus, status, isQuote, onChangeStatus, onMarkPaid, onReopen, onConvertToInvoice,
}: Props) => {
  const isRegistered = verifactuStatus === "SENT";
  const statuses = isQuote ? QUOTE_STATUSES : INVOICE_STATUSES;
  const showStatus = !!onChangeStatus && !!status;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {showStatus && (
          <>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <RefreshCw className="h-4 w-4 mr-2" />
                Cambiar estado
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {statuses.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => s !== status && onChangeStatus!(s)}
                    disabled={s === status}
                  >
                    <Check className={`h-4 w-4 mr-2 ${s === status ? "opacity-100 text-primary" : "opacity-0"}`} />
                    {STATUS_LABELS[s] ?? s}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Cobrar no es un cambio de estado más: registra el pago y por eso
                va como acción propia, fuera del submenú. */}
            {onMarkPaid && status !== "PAID" && (
              <DropdownMenuItem onClick={onMarkPaid}>
                <BadgeEuro className="h-4 w-4 mr-2 text-[hsl(var(--success))]" />
                Marcar como pagada
              </DropdownMenuItem>
            )}
            {onConvertToInvoice && status !== "INVOICED" && (
              <DropdownMenuItem onClick={onConvertToInvoice}>
                <FileText className="h-4 w-4 mr-2 text-primary" />
                Convertir en factura
              </DropdownMenuItem>
            )}
            {onReopen && status === "PAID" && (
              <DropdownMenuItem onClick={onReopen}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reabrir factura
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={onPreview}>
          <Eye className="h-4 w-4 mr-2" />
          Vista previa
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExport}>
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </DropdownMenuItem>
        {onSendEmail && (
          <DropdownMenuItem onClick={onSendEmail}>
            <Mail className="h-4 w-4 mr-2" />
            Enviar por email
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" />
          Editar
        </DropdownMenuItem>
        {onRegisterVerifactu && (
          <DropdownMenuItem onClick={onRegisterVerifactu} disabled={isRegistered}>
            <ShieldCheck className={`h-4 w-4 mr-2 ${isRegistered ? "text-[hsl(var(--success))]" : ""}`} />
            {isRegistered ? "Registrada en AEAT" : "Registrar en AEAT"}
          </DropdownMenuItem>
        )}
        {onReminder && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onReminder}>
              <CalendarClock className="h-4 w-4 mr-2" />
              Crear recordatorio
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default InvoiceActionsMenu;
