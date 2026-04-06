import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { FileText, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

const INVOICE_STATUSES = ["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"] as const;

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  PARTIALLY_PAID: "Pago parcial",
  PAID: "Pagada",
  OVERDUE: "Vencida",
  CANCELLED: "Cancelada",
};

const statusColumnColors: Record<string, string> = {
  DRAFT: "border-t-muted-foreground",
  SENT: "border-t-primary",
  PARTIALLY_PAID: "border-t-amber-500",
  PAID: "border-t-green-500",
  OVERDUE: "border-t-destructive",
  CANCELLED: "border-t-muted",
};

interface Props {
  invoices: any[];
  onPreview: (inv: any) => void;
}

const InvoiceKanbanView = ({ invoices, onPreview }: Props) => {
  const queryClient = useQueryClient();
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const columns = INVOICE_STATUSES.map((status) => ({
    key: status,
    label: statusLabels[status],
    items: invoices.filter((inv) => inv.status === status),
  }));

  const handleDragStart = (e: React.DragEvent, invoiceId: string) => {
    e.dataTransfer.setData("text/plain", invoiceId);
    setDraggingId(invoiceId);
  };

  const handleDragOver = (e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    setDragOverColumn(columnKey);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    setDraggingId(null);
    const invoiceId = e.dataTransfer.getData("text/plain");
    if (!invoiceId) return;

    const invoice = invoices.find((i) => i.id === invoiceId);
    if (!invoice || invoice.status === newStatus) return;

    try {
      const updateData: any = { status: newStatus };
      if (newStatus === "PAID" && !invoice.paid_at) {
        updateData.paid_at = new Date().toISOString();
      } else if (newStatus !== "PAID") {
        updateData.paid_at = null;
      }

      const { error } = await supabase
        .from("invoices")
        .update(updateData)
        .eq("id", invoiceId);
      if (error) throw error;

      toast({ title: "Estado actualizado", description: `${invoice.invoice_number || ""} → ${statusLabels[newStatus]}` });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDragEnd = () => {
    setDragOverColumn(null);
    setDraggingId(null);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[400px]">
      {columns.map((col) => (
        <div
          key={col.key}
          className={cn(
            "flex-shrink-0 w-[220px] lg:w-[240px] rounded-lg border border-t-4 bg-muted/30 transition-colors",
            statusColumnColors[col.key],
            dragOverColumn === col.key && "bg-accent/40 ring-2 ring-primary/30"
          )}
          onDragOver={(e) => handleDragOver(e, col.key)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, col.key)}
        >
          <div className="p-3 border-b">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">{col.label}</span>
              <Badge variant="secondary" className="text-xs">{col.items.length}</Badge>
            </div>
          </div>
          <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
            {col.items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Sin documentos</p>
            ) : (
              col.items.map((inv: any) => (
                <Card
                  key={inv.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, inv.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onPreview(inv)}
                  className={cn(
                    "p-3 cursor-pointer hover:shadow-md transition-shadow border-l-4",
                    inv.type === "INVOICE"
                      ? "border-l-primary bg-card"
                      : "border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/10",
                    draggingId === inv.id && "opacity-50 ring-2 ring-primary"
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {inv.type === "INVOICE" ? (
                      <FileText className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    ) : (
                      <Receipt className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                    )}
                    <span className="font-mono text-xs font-semibold truncate">
                      {inv.invoice_number || inv.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-foreground truncate mb-1">
                    {inv.business_clients?.name || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mb-2">
                    {inv.concept || "—"}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(inv.issue_date), "dd MMM", { locale: es })}
                    </span>
                    <span className="font-mono text-xs font-bold text-foreground">
                      €{Number(inv.amount_total).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default InvoiceKanbanView;
