import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { format, subDays, subMonths, startOfDay, startOfMonth, parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

import KpiCards from "@/components/dashboard/KpiCards";
import RevenueChart from "@/components/dashboard/RevenueChart";
import InvoiceStatusChart from "@/components/dashboard/InvoiceStatusChart";
import LowStockAlerts from "@/components/dashboard/LowStockAlerts";
import TopClients from "@/components/dashboard/TopClients";
import RecentActivity from "@/components/dashboard/RecentActivity";
import QuickActions from "@/components/dashboard/QuickActions";
import TodayAttendanceWidget from "@/components/dashboard/TodayAttendanceWidget";

type Period = "7d" | "30d" | "90d" | "year";

const periodDays: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90, year: 365 };

const AppDashboard = () => {
  const { accountId } = useAuth();
  const [period, setPeriod] = useState<Period>("30d");
  const [chartPeriod, setChartPeriod] = useState("30d");

  // Fetch invoices
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

  // Fetch low stock products
  const { data: lowStockProducts = [] } = useQuery({
    queryKey: ["dashboard-low-stock", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, current_stock, min_stock")
        .eq("account_id", accountId!)
        .eq("is_active", true);
      if (error) throw error;
      return (data || []).filter((p: any) => p.current_stock < p.min_stock).sort((a: any, b: any) => (a.current_stock - a.min_stock) - (b.current_stock - b.min_stock));
    },
    enabled: !!accountId,
  });

  // Period filtering
  const now = new Date();
  const days = periodDays[period];
  const periodStart = startOfDay(subDays(now, days));
  const prevPeriodStart = startOfDay(subDays(now, days * 2));

  const currentInvoices = useMemo(() =>
    invoices.filter((i: any) => parseISO(i.issue_date) >= periodStart),
    [invoices, periodStart]
  );
  const prevInvoices = useMemo(() =>
    invoices.filter((i: any) => {
      const d = parseISO(i.issue_date);
      return d >= prevPeriodStart && d < periodStart;
    }),
    [invoices, prevPeriodStart, periodStart]
  );

  // KPI calculations
  const calc = (list: any[]) => {
    const income = list.filter((i: any) => i.type === "INCOME").reduce((s: number, i: any) => s + Number(i.amount_total), 0);
    const expense = list.filter((i: any) => i.type === "EXPENSE").reduce((s: number, i: any) => s + Number(i.amount_total), 0);
    const pending = list.filter((i: any) => i.status === "DRAFT" || i.status === "SENT").length;
    const overdue = list.filter((i: any) => i.status === "SENT" && differenceInDays(now, parseISO(i.issue_date)) > 30).length;
    const clients = new Set(list.map((i: any) => i.client_id)).size;
    return { income, expense, pending, overdue, clients };
  };

  const curr = calc(currentInvoices);
  const prev = calc(prevInvoices);

  // Chart data
  const chartData = useMemo(() => {
    if (chartPeriod === "7d") {
      return Array.from({ length: 7 }, (_, i) => {
        const day = startOfDay(subDays(now, 6 - i));
        const dayStr = format(day, "yyyy-MM-dd");
        const inc = invoices.filter((inv: any) => inv.type === "INCOME" && inv.issue_date === dayStr).reduce((s: number, inv: any) => s + Number(inv.amount_total), 0);
        const exp = invoices.filter((inv: any) => inv.type === "EXPENSE" && inv.issue_date === dayStr).reduce((s: number, inv: any) => s + Number(inv.amount_total), 0);
        return { label: format(day, "EEE", { locale: es }), income: inc, expense: exp };
      });
    }
    if (chartPeriod === "30d") {
      return Array.from({ length: 30 }, (_, i) => {
        const day = startOfDay(subDays(now, 29 - i));
        const dayStr = format(day, "yyyy-MM-dd");
        const inc = invoices.filter((inv: any) => inv.type === "INCOME" && inv.issue_date === dayStr).reduce((s: number, inv: any) => s + Number(inv.amount_total), 0);
        const exp = invoices.filter((inv: any) => inv.type === "EXPENSE" && inv.issue_date === dayStr).reduce((s: number, inv: any) => s + Number(inv.amount_total), 0);
        return { label: format(day, "dd", { locale: es }), income: inc, expense: exp };
      });
    }
    // 12m
    return Array.from({ length: 12 }, (_, i) => {
      const month = startOfMonth(subMonths(now, 11 - i));
      const monthStr = format(month, "yyyy-MM");
      const inc = invoices.filter((inv: any) => inv.type === "INCOME" && inv.issue_date.startsWith(monthStr)).reduce((s: number, inv: any) => s + Number(inv.amount_total), 0);
      const exp = invoices.filter((inv: any) => inv.type === "EXPENSE" && inv.issue_date.startsWith(monthStr)).reduce((s: number, inv: any) => s + Number(inv.amount_total), 0);
      return { label: format(month, "MMM", { locale: es }), income: inc, expense: exp };
    });
  }, [invoices, chartPeriod]);

  // Status donut
  const statusData = useMemo(() => {
    const statuses = [
      { key: "DRAFT", name: "Borrador", color: "hsl(var(--muted-foreground))" },
      { key: "SENT", name: "Enviada", color: "hsl(var(--warning))" },
      { key: "PAID", name: "Pagada", color: "hsl(var(--success))" },
    ];
    return statuses.map((s) => {
      const items = currentInvoices.filter((i: any) => i.status === s.key);
      return { name: s.name, count: items.length, amount: items.reduce((sum: number, i: any) => sum + Number(i.amount_total), 0), color: s.color };
    }).filter((s) => s.count > 0);
  }, [currentInvoices]);

  // Top clients
  const topClients = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>();
    currentInvoices
      .filter((i: any) => i.type === "INCOME")
      .forEach((i: any) => {
        const name = (i as any).business_clients?.name || "—";
        const existing = map.get(i.client_id) || { name, total: 0 };
        existing.total += Number(i.amount_total);
        map.set(i.client_id, existing);
      });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [currentInvoices]);

  // Recent
  const recent = invoices.slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Resumen de tu negocio</p>
        </div>
        <div className="flex items-center gap-3">
          <QuickActions />
          <ToggleGroup type="single" value={period} onValueChange={(v) => v && setPeriod(v as Period)} size="sm" className="bg-muted rounded-lg p-0.5">
            <ToggleGroupItem value="7d" className="text-xs px-3 h-7 rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm">7d</ToggleGroupItem>
            <ToggleGroupItem value="30d" className="text-xs px-3 h-7 rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm">30d</ToggleGroupItem>
            <ToggleGroupItem value="90d" className="text-xs px-3 h-7 rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm">90d</ToggleGroupItem>
            <ToggleGroupItem value="year" className="text-xs px-3 h-7 rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm">Año</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* KPIs */}
      <KpiCards
        income={curr.income}
        expense={curr.expense}
        balance={curr.income - curr.expense}
        pendingCount={curr.pending}
        overdueCount={curr.overdue}
        activeClients={curr.clients}
        prevIncome={prev.income}
        prevExpense={prev.expense}
        prevPendingCount={prev.pending}
        prevOverdueCount={prev.overdue}
        prevActiveClients={prev.clients}
      />

      {/* Revenue chart + Attendance widget */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RevenueChart data={chartData} period={chartPeriod} onPeriodChange={setChartPeriod} />
        </div>
        <div className="lg:col-span-2 grid gap-6">
          <TodayAttendanceWidget />
          <InvoiceStatusChart data={statusData} />
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RecentActivity invoices={recent} />
        </div>
        <div className="lg:col-span-2 grid gap-6">
          <TopClients clients={topClients} />
          <LowStockAlerts products={lowStockProducts} />
        </div>
      </div>
    </div>
  );
};

export default AppDashboard;
