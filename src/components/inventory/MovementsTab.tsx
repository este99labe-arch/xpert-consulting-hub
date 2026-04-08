import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Download, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Product, StockMovement, movementTypeLabels, movementTypeIcons } from "./types";
import PaginationControls from "@/components/shared/PaginationControls";
import { useServerPagination } from "@/hooks/use-server-pagination";

interface MovementsTabProps {
  accountId: string;
  products: Product[];
  isManager: boolean;
  onNewMovement: () => void;
}

const MovementsTab = ({ accountId, products, isManager, onNewMovement }: MovementsTabProps) => {
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [productFilter, setProductFilter] = useState("ALL");

  const pagination = useServerPagination();

  // Server-side paginated query
  const { data: movementResult } = useQuery({
    queryKey: ["stock-movements-paginated", accountId, pagination.currentPage, pagination.pageSize, typeFilter, productFilter],
    queryFn: async () => {
      let query = supabase
        .from("stock_movements")
        .select("*, products(name, sku)", { count: "exact" })
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });

      if (typeFilter !== "ALL") query = query.eq("type", typeFilter);
      if (productFilter !== "ALL") query = query.eq("product_id", productFilter);

      query = query.range(pagination.rangeFrom, pagination.rangeTo);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: (data || []) as StockMovement[], count: count || 0 };
    },
    enabled: !!accountId,
  });

  useEffect(() => {
    if (movementResult) pagination.setTotalItems(movementResult.count);
  }, [movementResult?.count]);

  const movements = movementResult?.data || [];

  const exportCSV = async () => {
    // Fetch all movements for export (no pagination)
    const { data: allMovements } = await supabase
      .from("stock_movements")
      .select("*, products(name, sku)")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(10000);

    const header = "Fecha,Producto,SKU,Tipo,Cantidad,Razón,Notas\n";
    const rows = (allMovements || []).map((m: any) => `"${format(new Date(m.created_at), "dd/MM/yyyy HH:mm")}","${m.products?.name || ""}","${m.products?.sku || ""}","${movementTypeLabels[m.type]}",${m.quantity},"${m.reason}","${m.notes || ""}"`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "movimientos.csv"; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); pagination.resetPage(); }}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los tipos</SelectItem>
            <SelectItem value="IN">Entrada</SelectItem>
            <SelectItem value="OUT">Salida</SelectItem>
            <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
          </SelectContent>
        </Select>
        <Select value={productFilter} onValueChange={v => { setProductFilter(v); pagination.resetPage(); }}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los productos</SelectItem>
            {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {isManager && (
          <>
            <Button size="sm" onClick={onNewMovement}><Plus className="h-4 w-4 mr-1" />Registrar Movimiento</Button>
            <Button size="sm" variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />CSV</Button>
          </>
        )}
      </div>
      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {movements.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">Sin movimientos</Card>
        ) : (
          movements.map(m => {
            const Icon = movementTypeIcons[m.type] || RotateCcw;
            return (
              <Card key={m.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{m.products?.name}</span>
                  <div className="flex items-center gap-1">
                    <Icon className={`h-4 w-4 ${m.type === "IN" ? "text-green-600" : m.type === "OUT" ? "text-destructive" : "text-muted-foreground"}`} />
                    <span className="text-sm">{movementTypeLabels[m.type]}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{format(new Date(m.created_at), "dd/MM/yyyy HH:mm", { locale: es })}</span>
                  <span className="font-mono font-medium text-foreground">{m.type === "OUT" ? `-${m.quantity}` : m.quantity}</span>
                </div>
                <div className="text-xs text-muted-foreground capitalize">{m.reason}</div>
                {m.notes && <p className="text-xs text-muted-foreground truncate">{m.notes}</p>}
              </Card>
            );
          })
        )}
        {movements.length > 0 && (
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
              <TableHead>Fecha</TableHead><TableHead>Producto</TableHead><TableHead>Tipo</TableHead>
              <TableHead className="text-right">Cantidad</TableHead><TableHead>Razón</TableHead><TableHead>Notas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin movimientos</TableCell></TableRow>
            )}
            {movements.map(m => {
              const Icon = movementTypeIcons[m.type] || RotateCcw;
              return (
                <TableRow key={m.id}>
                  <TableCell className="text-sm">{format(new Date(m.created_at), "dd/MM/yyyy HH:mm", { locale: es })}</TableCell>
                  <TableCell>{m.products?.name} <span className="text-xs text-muted-foreground">({m.products?.sku})</span></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Icon className={`h-4 w-4 ${m.type === "IN" ? "text-green-600" : m.type === "OUT" ? "text-destructive" : "text-muted-foreground"}`} />
                      {movementTypeLabels[m.type]}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">{m.type === "OUT" ? `-${m.quantity}` : m.quantity}</TableCell>
                  <TableCell className="capitalize">{m.reason}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{m.notes}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {movements.length > 0 && (
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

export default MovementsTab;
