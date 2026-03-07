import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import {
  DollarSign, TrendingDown, BarChart3, TrendingUp, FileText, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { format, subDays, parseISO, startOfDay } from "date-fns";
import { es } from "date-fns/locale";

const AppDashboard = () => {
  const { accountId } = useAuth();
  const [chartMetric, setChartMetric] = useState<"income" | "expense" | "balance">("income");

  const { data: invoices = [] } = useQuery({
    queryKey: ["dashboard-invoices", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, type, status, amount_total, issue_date, created_at, client_id, business_clients(name)")
        .eq("account_id", accountId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  // KPIs
  const income = invoices.filter((i: any) => i.type === "INCOME").reduce((s: number, i: any) => s + Number(i.amount_total), 0);
  const expense = invoices.filter((i: any) => i.type === "EXPENSE").reduce((s: number, i: any) => s + Number(i.amount_total), 0);
  const balance = income - expense;
  const paid = invoices.filter((i: any) => i.status === "PAID").reduce((s: number, i: any) => s + Number(i.amount_total), 0);

  const kpis = [
    { label: "Ingresos", value: income, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { label: "Gastos", value: expense, icon: TrendingDown, color: "text-red-500", bg: "bg-red-500/10" },
    { label: "Balance", value: balance, icon: BarChart3, color: balance >= 0 ? "text-emerald-600" : "text-red-500", bg: "bg-primary/10" },
    { label: "Cobrado", value: paid, icon: DollarSign, color: "text-primary", bg: "bg-primary/10" },
  ];

  // Chart data — last 7 days
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const day = startOfDay(subDays(new Date(), 6 - i));
    const dayStr = format(day, "yyyy-MM-dd");
    const dayIncome = invoices.filter((inv: any) => inv.type === "INCOME" && inv.issue_date === dayStr).reduce((s: number, inv: any) => s + Number(inv.amount_total), 0);
    const dayExpense = invoices.filter((inv: any) => inv.type === "EXPENSE" && inv.issue_date === dayStr).reduce((s: number, inv: any) => s + Number(inv.amount_total), 0);
    return {
      date: format(day, "EEE", { locale: es }),
      income: dayIncome,
      expense: dayExpense,
      balance: dayIncome - dayExpense,
    };
  });

  const metricLabels: Record<string, string> = { income: "Ingresos", expense: "Gastos", balance: "Balance" };
  const metricColors: Record<string, string> = { income: "hsl(var(--primary))", expense: "hsl(0 72% 51%)", balance: "hsl(160 60% 45%)" };

  const chartConfig = {
    [chartMetric]: { label: metricLabels[chartMetric], color: metricColors[chartMetric] },
  };

  // Recent invoices (last 5)
  const recent = invoices.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">{kpi.label}</span>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${kpi.bg}`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold tracking-tight ${kpi.color}`}>
                {kpi.value.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Chart */}
        <Card className="lg:col-span-3 border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Últimos 7 días</CardTitle>
            <Select value={chartMetric} onValueChange={(v) => setChartMetric(v as any)}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Ingresos</SelectItem>
                <SelectItem value="expense">Gastos</SelectItem>
                <SelectItem value="balance">Balance</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={metricColors[chartMetric]} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={metricColors[chartMetric]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey={chartMetric}
                  stroke={metricColors[chartMetric]}
                  fill="url(#chartGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin actividad reciente</p>
            ) : (
              recent.map((inv: any) => (
                <div key={inv.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${inv.type === "INCOME" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500"}`}>
                    {inv.type === "INCOME" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{(inv as any).business_clients?.name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{format(parseISO(inv.issue_date), "dd MMM yyyy", { locale: es })}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${inv.type === "INCOME" ? "text-emerald-600" : "text-red-500"}`}>
                      {inv.type === "INCOME" ? "+" : "-"}{Number(inv.amount_total).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                    </p>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {inv.status === "PAID" ? "Pagada" : inv.status === "SENT" ? "Enviada" : "Borrador"}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AppDashboard;
