import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingCart } from "lucide-react";
import { Product } from "./types";

interface AlertsTabProps {
  lowStockProducts: Product[];
  isManager: boolean;
  onQuickOrder: (p: Product) => void;
}

const AlertsTab = ({ lowStockProducts, isManager, onQuickOrder }: AlertsTabProps) => {
  if (lowStockProducts.length === 0) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground">No hay productos con stock bajo 🎉</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead><TableHead>SKU</TableHead>
              <TableHead className="text-right">Stock Actual</TableHead><TableHead className="text-right">Stock Mínimo</TableHead>
              <TableHead className="text-right">Déficit</TableHead>{isManager && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lowStockProducts.sort((a, b) => (a.current_stock - a.min_stock) - (b.current_stock - b.min_stock)).map(p => (
              <TableRow key={p.id} className="bg-destructive/5">
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                <TableCell className="text-right text-destructive font-bold">{p.current_stock} {p.unit}</TableCell>
                <TableCell className="text-right">{p.min_stock} {p.unit}</TableCell>
                <TableCell className="text-right text-destructive font-bold">{p.current_stock - p.min_stock} {p.unit}</TableCell>
                {isManager && (
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => onQuickOrder(p)}>
                      <ShoppingCart className="h-4 w-4 mr-1" />Pedir
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AlertsTab;
