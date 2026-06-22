import { MoreHorizontal, Eye, Download, Pencil, Trash2, Mail, CalendarClock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  onPreview: () => void;
  onExport: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSendEmail?: () => void;
  onReminder?: () => void;
  onRegisterVerifactu?: () => void;
  verifactuStatus?: string;
}

const InvoiceActionsMenu = ({ onPreview, onExport, onEdit, onDelete, onSendEmail, onReminder, onRegisterVerifactu, verifactuStatus }: Props) => {
  const isRegistered = verifactuStatus === "SENT";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
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
