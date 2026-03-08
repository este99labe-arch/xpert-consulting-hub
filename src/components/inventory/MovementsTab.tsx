import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Download, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Product, StockMovement, movementTypeLabels, movementTypeIcons } from "./types";

interface MovementsTabProps {
  movements: StockMovement[];
  products: Product[];
  isManager: boolean;
  onNewMovement: () => void;
}

const MovementsTab = ({ movements, products, isManager, onNewMovement }: MovementsTabProps) => {
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [productFilter, setProductFilter] = useState("ALL");

  const filtered = useMemo(() => movements.filter(m => {
    if (typeFilter !== "ALL" && m.type !== typeFilter) return false;
    if (productFilter !== "ALL" && m.product_id !== productFilter) return false;
    return true;
  }), [movements, typeFilter, productFilter]);

  const exportCSV = () => {
    const header = "Fecha,Producto,SKU,Tipo,Cantidad,Razón,Notas\n";
    const rows = movements.map(m => `"${format(new Date(m.created_at), "dd/MM/yyyy HH:mm")}","${m.products?.name || ""}","${m.products?.sku || ""}","${movementTypeLabels[m.type]}",${m.quantity},"${m.reason}","${m.notes || ""}"`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "movimientos.csv"; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los tipos</SelectItem>
            <SelectItem value="IN">Entrada</SelectItem>
            <SelectItem value="OUT">Salida</SelectItem>
            <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
          </SelectContent>
        </Select>
        <Select value={productFilter} onValueChange={setProductFilter}>
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
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead><TableHead>Producto</TableHead><TableHead>Tipo</TableHead>
              <TableHead className="text-right">Cantidad</TableHead><TableHead>Razón</TableHead><TableHead>Notas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin movimientos</TableCell></TableRow>
            )}
            {filtered.map(m => {
              const Icon = movementTypeIcons[m.type] || RotateCcw;
              return (
                <TableRow key={m.id}>
                  <TableCell className="text-sm">{format(new Date(m.created_at), "dd/MM/yyyy HH:mm", { locale: es })}</TableCell>
                  <TableCell>{m.products?.name} <span className="text-xs text-muted-foreground">({m.products?.sku})</span></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Icon className={`h-4 w-4 ${m.type === "IN" ? "text-success" : m.type === "OUT" ? "text-destructive" : "text-muted-foreground"}`} />
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
      </div>
    </div>
  );
};

export default MovementsTab;
