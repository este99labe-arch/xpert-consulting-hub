import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PurchaseOrder, statusLabels, statusColors } from "./types";

const nextStatus: Record<string, string> = { DRAFT: "PENDING", PENDING: "ORDERED", ORDERED: "RECEIVED" };

interface PurchaseOrdersTabProps {
  orders: PurchaseOrder[];
  isManager: boolean;
  onNewOrder: () => void;
  onUpdateStatus: (order: PurchaseOrder, newStatus: string) => void;
}

const PurchaseOrdersTab = ({ orders, isManager, onNewOrder, onUpdateStatus }: PurchaseOrdersTabProps) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2">
      {isManager && (
        <Button size="sm" onClick={onNewOrder}><Plus className="h-4 w-4 mr-1" />Nueva Orden</Button>
      )}
    </div>
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead><TableHead>Producto</TableHead>
            <TableHead className="text-right">Cantidad</TableHead><TableHead>Estado</TableHead>
            <TableHead>Fecha Est.</TableHead><TableHead>Notas</TableHead>{isManager && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 && (
            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin órdenes de compra</TableCell></TableRow>
          )}
          {orders.map(o => (
            <TableRow key={o.id}>
              <TableCell className="text-sm">{format(new Date(o.created_at), "dd/MM/yyyy", { locale: es })}</TableCell>
              <TableCell>{o.products?.name} <span className="text-xs text-muted-foreground">({o.products?.sku})</span></TableCell>
              <TableCell className="text-right font-mono">{o.quantity}</TableCell>
              <TableCell><Badge className={statusColors[o.status]}>{statusLabels[o.status]}</Badge></TableCell>
              <TableCell className="text-sm">{o.estimated_date ? format(new Date(o.estimated_date), "dd/MM/yyyy") : "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{o.notes}</TableCell>
              {isManager && (
                <TableCell>
                  {o.status !== "RECEIVED" && (
                    <Button size="sm" variant="outline" onClick={() => onUpdateStatus(o, nextStatus[o.status])}>
                      → {statusLabels[nextStatus[o.status]]}
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </div>
);

export default PurchaseOrdersTab;
