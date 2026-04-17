import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, ExternalLink } from "lucide-react";
import { addDays, format, parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

const EUR = (n: number) => Number(n).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

const UpcomingDuesWidget = () => {
  const { accountId } = useAuth();
  const navigate = useNavigate();

  const { data: dues = [] } = useQuery({
    queryKey: ["upcoming-dues", accountId],
    queryFn: async () => {
      const today = new Date();
      const limit = addDays(today, 7);
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, amount_total, issue_date, status, business_clients(name)")
        .eq("account_id", accountId!)
        .eq("type", "INVOICE")
        .in("status", ["SENT", "DRAFT"])
        .lte("issue_date", format(limit, "yyyy-MM-dd"))
        .order("issue_date", { ascending: true })
        .limit(6);
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Próximos vencimientos
          </CardTitle>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => navigate("/app/invoices")}>
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {dues.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Sin vencimientos próximos</p>
        ) : (
          <div className="space-y-2">
            {dues.map((d: any) => {
              const days = differenceInDays(parseISO(d.issue_date), new Date());
              const overdue = days < 0;
              return (
                <button
                  key={d.id}
                  onClick={() => navigate("/app/invoices")}
                  className="w-full flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{d.invoice_number || "Sin número"}</p>
                    <p className="text-xs text-muted-foreground truncate">{(d as any).business_clients?.name || "—"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{EUR(d.amount_total)}</p>
                    <Badge variant={overdue ? "destructive" : "outline"} className="text-[10px] h-4 px-1.5">
                      {overdue ? `${Math.abs(days)}d vencida` : days === 0 ? "Hoy" : `En ${days}d`}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UpcomingDuesWidget;
