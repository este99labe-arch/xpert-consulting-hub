import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface Invoice {
  id: string;
  type: string;
  status: string;
  amount_total: number;
  issue_date: string;
  business_clients?: { name: string } | null;
}

interface RecentActivityProps {
  invoices: Invoice[];
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PAID: { label: "Pagada", variant: "default" },
  SENT: { label: "Enviada", variant: "secondary" },
  DRAFT: { label: "Borrador", variant: "outline" },
};

const RecentActivity = ({ invoices }: RecentActivityProps) => {
  const navigate = useNavigate();

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Actividad Reciente
        </CardTitle>
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate("/app/invoices")}>
          Ver todo
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin actividad reciente</p>
        ) : (
          invoices.map((inv) => {
            const st = statusMap[inv.status] || statusMap.DRAFT;
            return (
              <div key={inv.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${inv.type === "INCOME" ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" : "bg-destructive/10 text-destructive"}`}>
                  {inv.type === "INCOME" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{inv.business_clients?.name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{format(parseISO(inv.issue_date), "dd MMM yyyy", { locale: es })}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${inv.type === "INCOME" ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
                    {inv.type === "INCOME" ? "+" : "-"}{Number(inv.amount_total).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                  </p>
                  <Badge variant={st.variant} className="text-[10px] px-1.5 py-0">{st.label}</Badge>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default RecentActivity;
