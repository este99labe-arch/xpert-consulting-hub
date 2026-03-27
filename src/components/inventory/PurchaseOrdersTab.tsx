import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PurchaseOrder, statusLabels, statusColors } from "./types";
import PaginationControls from "@/components/shared/PaginationControls";
import { usePagination } from "@/hooks/use-pagination";

const nextStatus: Record<string, string> = { DRAFT: "PENDING", PENDING: "ORDERED", ORDERED: "RECEIVED" };

interface PurchaseOrdersTabProps {
  orders: PurchaseOrder[];
  isManager: boolean;
  onNewOrder: () => void;
  onUpdateStatus: (order: PurchaseOrder, newStatus: string) => void;
}

const PurchaseOrdersTab = ({ orders, isManager, onNewOrder, onUpdateStatus }: PurchaseOrdersTabProps) => {
  const pagination = usePagination(orders);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {isManager && (
          <Button size="sm" onClick={onNewOrder}><Plus className="h-4 w-4 mr-1" />Nueva Orden</Button>
        )}
      </div>
      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {orders.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">Sin órdenes de compra</Card>
        ) : (
          pagination.paginatedItems.map(o => (
            <Card key={o.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{o.products?.name}</span>
                <Badge className={statusColors[o.status]}>{statusLabels[o.status]}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">{o.products?.sku} · Qty: <span className="font-mono">{o.quantity}</span></div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{format(new Date(o.created_at), "dd/MM/yyyy", { locale: es })}</span>
                <span>{o.estimated_date ? format(new Date(o.estimated_date), "dd/MM/yyyy") : "—"}</span>
              </div>
              {o.notes && <p className="text-xs text-muted-foreground truncate">{o.notes}</p>}
              {isManager && o.status !== "RECEIVED" && (
                <Button size="sm" variant="outline" className="w-full" onClick={() => onUpdateStatus(o, nextStatus[o.status])}>
                  → {statusLabels[nextStatus[o.status]]}
                </Button>
              )}
            </Card>
          ))
        )}
        {orders.length > 0 && (
          <PaginationControls
            currentPage={pagination.currentPage} totalPages={pagination.totalPages}
            totalItems={pagination.totalItems} pageSize={pagination.pageSize}
            startIndex={pagination.startIndex} endIndex={pagination.endIndex}
            onPageChange={pagination.setCurrentPage} onPageSizeChange={pagination.setPageSize}
            pageSizeOptions={pagination.pageSizeOptions}
          />
        )}
      </div>

      {/* Desktop table */}
      <div className="rounded-md border hidden md:block">
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
            {pagination.paginatedItems.map(o => (
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
        {orders.length > 0 && (
          <div className="px-4 pb-4">
            <PaginationControls
              currentPage={pagination.currentPage} totalPages={pagination.totalPages}
              totalItems={pagination.totalItems} pageSize={pagination.pageSize}
              startIndex={pagination.startIndex} endIndex={pagination.endIndex}
              onPageChange={pagination.setCurrentPage} onPageSizeChange={pagination.setPageSize}
              pageSizeOptions={pagination.pageSizeOptions}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PurchaseOrdersTab;
