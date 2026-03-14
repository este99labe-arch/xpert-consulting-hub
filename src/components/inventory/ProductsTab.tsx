import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Download } from "lucide-react";
import { Product } from "./types";
import PaginationControls from "@/components/shared/PaginationControls";
import { usePagination } from "@/hooks/use-pagination";

interface ProductsTabProps {
  products: Product[];
  isManager: boolean;
  onNewProduct: () => void;
  onEditProduct: (p: Product) => void;
  onToggleActive: (p: Product) => void;
}

const ProductsTab = ({ products, isManager, onNewProduct, onEditProduct, onToggleActive }: ProductsTabProps) => {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const categories = useMemo(() => [...new Set(products.map(p => p.category))], [products]);

  const filtered = useMemo(() => products.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false;
    if (catFilter !== "ALL" && p.category !== catFilter) return false;
    if (statusFilter === "ACTIVE" && !p.is_active) return false;
    if (statusFilter === "INACTIVE" && p.is_active) return false;
    return true;
  }), [products, search, catFilter, statusFilter]);

  const pagination = usePagination(filtered);

  const exportCSV = () => {
    const header = "Nombre,SKU,Categoría,Unidad,Stock Actual,Stock Mínimo,Precio Coste,Precio Venta,Activo\n";
    const rows = products.map(p => `"${p.name}","${p.sku}","${p.category}","${p.unit}",${p.current_stock},${p.min_stock},${p.cost_price},${p.sale_price},${p.is_active ? "Sí" : "No"}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "productos.csv"; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre o SKU..." className="pl-8" value={search} onChange={e => { setSearch(e.target.value); pagination.resetPage(); }} />
        </div>
        <Select value={catFilter} onValueChange={v => { setCatFilter(v); pagination.resetPage(); }}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las categorías</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); pagination.resetPage(); }}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="ACTIVE">Activos</SelectItem>
            <SelectItem value="INACTIVE">Inactivos</SelectItem>
          </SelectContent>
        </Select>
        {isManager && (
          <>
            <Button size="sm" onClick={onNewProduct}><Plus className="h-4 w-4 mr-1" />Nuevo Producto</Button>
            <Button size="sm" variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />CSV</Button>
          </>
        )}
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead><TableHead>SKU</TableHead><TableHead>Categoría</TableHead>
              <TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Mín.</TableHead>
              <TableHead className="text-right">Coste</TableHead><TableHead className="text-right">Venta</TableHead>
              <TableHead>Estado</TableHead>{isManager && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No se encontraron productos</TableCell></TableRow>
            )}
            {pagination.paginatedItems.map(p => {
              const isLow = p.is_active && p.current_stock <= p.min_stock;
              const isWarning = p.is_active && !isLow && p.current_stock < p.min_stock * 1.5;
              return (
                <TableRow key={p.id} className={isLow ? "bg-destructive/5" : isWarning ? "bg-yellow-50 dark:bg-yellow-950/20" : ""}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell>{p.category}</TableCell>
                  <TableCell className="text-right">
                    <span className={isLow ? "text-destructive font-bold" : isWarning ? "text-yellow-600 dark:text-yellow-400 font-semibold" : ""}>{p.current_stock} {p.unit}</span>
                  </TableCell>
                  <TableCell className="text-right">{p.min_stock} {p.unit}</TableCell>
                  <TableCell className="text-right">{p.cost_price.toFixed(2)} €</TableCell>
                  <TableCell className="text-right">{p.sale_price.toFixed(2)} €</TableCell>
                  <TableCell><Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Activo" : "Inactivo"}</Badge></TableCell>
                  {isManager && (
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => onEditProduct(p)}>Editar</Button>
                      <Button variant="ghost" size="sm" onClick={() => onToggleActive(p)}>{p.is_active ? "Desactivar" : "Activar"}</Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filtered.length > 0 && (
          <div className="px-4 pb-4">
            <PaginationControls
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              pageSize={pagination.pageSize}
              startIndex={pagination.startIndex}
              endIndex={pagination.endIndex}
              onPageChange={pagination.setCurrentPage}
              onPageSizeChange={pagination.setPageSize}
              pageSizeOptions={pagination.pageSizeOptions}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsTab;
