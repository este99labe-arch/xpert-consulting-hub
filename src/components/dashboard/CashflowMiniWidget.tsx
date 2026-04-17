import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { startOfMonth, endOfMonth, format, parseISO, differenceInDays } from "date-fns";

const EUR = (n: number) => Number(n).toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const CashflowMiniWidget = () => {
  const { accountId } = useAuth();
  const now = new Date();
  const start = format(startOfMonth(now), "yyyy-MM-dd");
  const end = format(endOfMonth(now), "yyyy-MM-dd");

  const { data: invoices = [] } = useQuery({
    queryKey: ["cashflow-mini", accountId, start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("amount_total, status, issue_date")
        .eq("account_id", accountId!)
        .eq("type", "INVOICE")
        .gte("issue_date", start)
        .lte("issue_date", end);
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const { collected, pending, overdue, total } = useMemo(() => {
    let collected = 0, pending = 0, overdue = 0;
    for (const i of invoices as any[]) {
      const amt = Number(i.amount_total);
      if (i.status === "PAID") collected += amt;
      else if (i.status === "SENT" && differenceInDays(now, parseISO(i.issue_date)) > 30) overdue += amt;
      else pending += amt;
    }
    return { collected, pending, overdue, total: collected + pending + overdue };
  }, [invoices]);

  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          Tesorería del mes
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="space-y-1">
          <p className="text-2xl font-bold tracking-tight">{EUR(total)}</p>
          <p className="text-xs text-muted-foreground">Facturado en {format(now, "MMMM")}</p>
        </div>
        <div className="space-y-2">
          <div className="flex w-full h-2 rounded-full overflow-hidden bg-muted">
            <div className="bg-[hsl(var(--success))]" style={{ width: `${pct(collected)}%` }} />
            <div className="bg-[hsl(var(--warning))]" style={{ width: `${pct(pending)}%` }} />
            <div className="bg-destructive" style={{ width: `${pct(overdue)}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[hsl(var(--success))]" />Cobrado</div>
              <p className="font-semibold mt-0.5">{EUR(collected)}</p>
            </div>
            <div>
              <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[hsl(var(--warning))]" />Pendiente</div>
              <p className="font-semibold mt-0.5">{EUR(pending)}</p>
            </div>
            <div>
              <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive" />Vencido</div>
              <p className="font-semibold mt-0.5">{EUR(overdue)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CashflowMiniWidget;
