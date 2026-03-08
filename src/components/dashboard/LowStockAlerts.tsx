import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Product {
  id: string;
  name: string;
  current_stock: number;
  min_stock: number;
}

interface LowStockAlertsProps {
  products: Product[];
}

const LowStockAlerts = ({ products }: LowStockAlertsProps) => {
  const navigate = useNavigate();
  const top5 = products.slice(0, 5);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />
          Stock Bajo
        </CardTitle>
      </CardHeader>
      <CardContent>
        {top5.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <Package className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Sin alertas de stock</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {top5.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer" onClick={() => navigate("/app/inventory")}>
                <span className="text-sm font-medium truncate max-w-[60%]">{p.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{p.current_stock}/{p.min_stock}</span>
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                    -{p.min_stock - p.current_stock}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LowStockAlerts;
