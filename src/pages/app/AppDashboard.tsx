import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { format, subDays, subMonths, startOfDay, startOfMonth, parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

import StatCard from "@/components/shared/StatCard";
import { fmtEUR as EUR } from "@/lib/format";
import CashFeatureCard from "@/components/dashboard/CashFeatureCard";
import CustomDashboard from "@/components/dashboard/CustomDashboard";
import RevenueChart from "@/components/dashboard/RevenueChart";
import InvoiceStatusChart from "@/components/dashboard/InvoiceStatusChart";
import LowStockAlerts from "@/components/dashboard/LowStockAlerts";
import TopClients from "@/components/dashboard/TopClients";
import RecentActivity from "@/components/dashboard/RecentActivity";
import QuickActions from "@/components/dashboard/QuickActions";
import TodayAttendanceWidget from "@/components/dashboard/TodayAttendanceWidget";
import RemindersWidget from "@/components/dashboard/RemindersWidget";
import UpcomingDuesWidget from "@/components/dashboard/UpcomingDuesWidget";
import AttentionWidget from "@/components/dashboard/AttentionWidget";
import EmployeeDashboard from "@/components/dashboard/EmployeeDashboard";

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">{children}</h2>
);

type Period = "7d" | "30d" | "90d" | "year";
const periodDays: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90, year: 365 };

/** Variación frente al periodo anterior. Sin base previa no hay porcentaje
 *  que enseñar: "+100 %" sobre cero engaña más que informar. */
const pct = (curr: number, prev: number): string => {
  if (!prev) return "Sin periodo anterior";
  const v = ((curr - prev) / Math.abs(prev)) * 100;
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)} % vs. periodo anterior`;
};

const greetingForHour = (h: number) =>
  h < 12 ? "Buenos días" : h < 20 ? "Buenas tardes" : "Buenas noches";

// Vencida = pendiente de cobro y pasada su fecha de vencimiento
// (si no tiene due_date, se usa la heurística antigua de 30 días desde emisión)
const isInvoiceOverdue = (i: any, now: Date): boolean => {
  if (i.type !== "INVOICE" || !["SENT", "PARTIALLY_PAID"].includes(i.status)) return false;
  if (i.due_date) return i.due_date < format(now, "yyyy-MM-dd");
  return differenceInDays(now, parseISO(i.issue_date)) > 30;
};

const ManagerDashboard = () => {
  const { accountId, user } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("30d");
  const [chartPeriod, setChartPeriod] = useState("30d");

  const { data: invoices = [] } = useQuery({
    queryKey: ["dashboard-invoices", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, type, status, amount_total, issue_date, due_date, created_at, client_id, business_clients(name)")
        .eq("account_id", accountId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const { data: activeClientsCount = 0 } = useQuery({
    queryKey: ["dashboard-active-clients", accountId],
    queryFn: async () => {
      const [acctRes, clientsRes] = await Promise.all([
        supabase.from("accounts").select("name, tax_id").eq("id", accountId!).single(),
        supabase.from("business_clients").select("name, tax_id").eq("account_id", accountId!).eq("status", "ACTIVE"),
      ]);
      if (clientsRes.error) throw clientsRes.error;
      const acct = acctRes.data;
      const rows = clientsRes.data || [];
      const external = rows.filter((c: any) => {
        if (!acct) return true;
        const isSelf = c.name === acct.name && (c.tax_id === acct.tax_id || c.tax_id === "PROPIA");
        return !isSelf;
      });
      return external.length;
    },
    enabled: !!accountId,
  });

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

  // Team presence today
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const { data: presence } = useQuery({
    queryKey: ["dashboard-presence", accountId, todayStr],
    queryFn: async () => {
      const [recsRes, usersRes] = await Promise.all([
        supabase.from("attendance_records").select("user_id").eq("account_id", accountId!).eq("work_date", todayStr),
        supabase.from("user_accounts").select("user_id").eq("account_id", accountId!).eq("is_active", true),
      ]);
      const present = new Set((recsRes.data || []).map((r: any) => r.user_id)).size;
      const total = (usersRes.data || []).length;
      return { present, total };
    },
    enabled: !!accountId,
  });

  // Pending approvals (leave + delete + profile changes)
  const { data: pendingApprovals = 0 } = useQuery({
    queryKey: ["dashboard-pending-approvals", accountId],
    queryFn: async () => {
      const [a, b, c, d] = await Promise.all([
        supabase.from("leave_requests").select("id", { head: true, count: "exact" }).eq("account_id", accountId!).eq("status", "PENDING"),
        supabase.from("invoice_delete_requests").select("id", { head: true, count: "exact" }).eq("account_id", accountId!).eq("status", "PENDING"),
        supabase.from("profile_change_requests").select("id", { head: true, count: "exact" }).eq("account_id", accountId!).eq("status", "PENDING"),
        supabase.from("attendance_delete_requests").select("id", { head: true, count: "exact" }).eq("account_id", accountId!).eq("status", "PENDING"),
      ]);
      return (a.count || 0) + (b.count || 0) + (c.count || 0) + (d.count || 0);
    },
    enabled: !!accountId,
  });

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

  const calc = (list: any[]) => {
    const income = list.filter((i: any) => i.type === "INVOICE").reduce((s: number, i: any) => s + Number(i.amount_total), 0);
    const expense = list.filter((i: any) => i.type === "EXPENSE").reduce((s: number, i: any) => s + Number(i.amount_total), 0);
    const pending = list.filter((i: any) => i.status === "DRAFT" || i.status === "SENT").length;
    const overdue = list.filter((i: any) => isInvoiceOverdue(i, now)).length;
    const clients = new Set(list.map((i: any) => i.client_id)).size;
    return { income, expense, pending, overdue, clients };
  };

  const curr = calc(currentInvoices);
  const prev = calc(prevInvoices);

  const chartData = useMemo(() => {
    if (chartPeriod === "7d") {
      return Array.from({ length: 7 }, (_, i) => {
        const day = startOfDay(subDays(now, 6 - i));
        const dayStr = format(day, "yyyy-MM-dd");
        const inc = invoices.filter((inv: any) => inv.type === "INVOICE" && inv.issue_date === dayStr).reduce((s: number, inv: any) => s + Number(inv.amount_total), 0);
        const exp = invoices.filter((inv: any) => inv.type === "EXPENSE" && inv.issue_date === dayStr).reduce((s: number, inv: any) => s + Number(inv.amount_total), 0);
        return { label: format(day, "EEE", { locale: es }), income: inc, expense: exp };
      });
    }
    if (chartPeriod === "30d") {
      return Array.from({ length: 30 }, (_, i) => {
        const day = startOfDay(subDays(now, 29 - i));
        const dayStr = format(day, "yyyy-MM-dd");
        const inc = invoices.filter((inv: any) => inv.type === "INVOICE" && inv.issue_date === dayStr).reduce((s: number, inv: any) => s + Number(inv.amount_total), 0);
        const exp = invoices.filter((inv: any) => inv.type === "EXPENSE" && inv.issue_date === dayStr).reduce((s: number, inv: any) => s + Number(inv.amount_total), 0);
        return { label: format(day, "dd", { locale: es }), income: inc, expense: exp };
      });
    }
    return Array.from({ length: 12 }, (_, i) => {
      const month = startOfMonth(subMonths(now, 11 - i));
      const monthStr = format(month, "yyyy-MM");
      const inc = invoices.filter((inv: any) => inv.type === "INVOICE" && inv.issue_date.startsWith(monthStr)).reduce((s: number, inv: any) => s + Number(inv.amount_total), 0);
      const exp = invoices.filter((inv: any) => inv.type === "EXPENSE" && inv.issue_date.startsWith(monthStr)).reduce((s: number, inv: any) => s + Number(inv.amount_total), 0);
      return { label: format(month, "MMM", { locale: es }), income: inc, expense: exp };
    });
  }, [invoices, chartPeriod]);

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

  const topClients = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>();
    currentInvoices
      .filter((i: any) => i.type === "INVOICE")
      .forEach((i: any) => {
        const name = (i as any).business_clients?.name || "—";
        const existing = map.get(i.client_id) || { name, total: 0 };
        existing.total += Number(i.amount_total);
        map.set(i.client_id, existing);
      });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [currentInvoices]);

  const recent = invoices.slice(0, 8);

  /* Saldo acumulado de los últimos doce meses: ingresos menos gastos mes a
     mes, arrastrando el acumulado. Alimenta el área de la tarjeta de caja. */
  const cashTrend = useMemo(() => {
    let running = 0;
    return Array.from({ length: 12 }, (_, i) => {
      const month = startOfMonth(subMonths(now, 11 - i));
      const key = format(month, "yyyy-MM");
      const net = invoices
        .filter((inv: any) => inv.issue_date?.startsWith(key))
        .reduce(
          (s: number, inv: any) =>
            s + (inv.type === "INVOICE" ? Number(inv.amount_total) : -Number(inv.amount_total)),
          0,
        );
      running += net;
      return { label: format(month, "MMM", { locale: es }), value: running };
    });
  }, [invoices]);

  /* Gasto medio de los últimos seis meses, para estimar el runway. */
  const monthlyBurn = useMemo(() => {
    const total = invoices
      .filter((inv: any) => inv.type === "EXPENSE" && inv.issue_date >= format(subMonths(now, 6), "yyyy-MM-dd"))
      .reduce((s: number, inv: any) => s + Number(inv.amount_total), 0);
    return total / 6;
  }, [invoices]);

  // Global overdue (all periods) for the "needs attention" widget
  const overdueInvoices = useMemo(() =>
    invoices.filter((i: any) => isInvoiceOverdue(i, now)),
    [invoices]
  );
  const overdueAmountAll = overdueInvoices.reduce((s: number, i: any) => s + Number(i.amount_total), 0);

  const userName = user?.email?.split("@")[0] || "";
  const displayName = userName ? userName.charAt(0).toUpperCase() + userName.slice(1) : "";
  const greeting = greetingForHour(now.getHours());
  const todayLabel = format(now, "EEEE, d 'de' MMMM", { locale: es });

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 pb-1 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-[17px] font-semibold tracking-[-.01em] text-foreground">
            {greeting}{displayName ? `, ${displayName}` : ""} 👋
          </h1>
          <p className="text-[11.5px] text-muted-foreground first-letter:uppercase">
            {todayLabel} · Resumen ejecutivo
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <QuickActions />
          <ToggleGroup type="single" value={period} onValueChange={(v) => v && setPeriod(v as Period)} size="sm" className="bg-muted rounded-lg p-0.5">
            <ToggleGroupItem value="7d" className="text-xs px-3 h-7 rounded-md data-[state=on]:bg-background data-[state=on]:">7d</ToggleGroupItem>
            <ToggleGroupItem value="30d" className="text-xs px-3 h-7 rounded-md data-[state=on]:bg-background data-[state=on]:">30d</ToggleGroupItem>
            <ToggleGroupItem value="90d" className="text-xs px-3 h-7 rounded-md data-[state=on]:bg-background data-[state=on]:">90d</ToggleGroupItem>
            <ToggleGroupItem value="year" className="text-xs px-3 h-7 rounded-md data-[state=on]:bg-background data-[state=on]:">Año</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* ── Fila 1: caja protagonista · ingresos y gastos · atención ── */}
      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        {accountId && (
          <CashFeatureCard accountId={accountId} trend={cashTrend} monthlyBurn={monthlyBurn} />
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <StatCard
            label="Ingresos"
            value={EUR(curr.income)}
            tone="default"
            hint={pct(curr.income, prev.income)}
            onClick={() => navigate("/app/invoices?type=INVOICE")}
          />
          <StatCard
            label="Gastos"
            value={EUR(curr.expense)}
            tone="default"
            hint={pct(curr.expense, prev.expense)}
            onClick={() => navigate("/app/invoices?type=EXPENSE")}
          />
          <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <AttentionWidget
              overdueCount={overdueInvoices.length}
              overdueAmount={overdueAmountAll}
              lowStockCount={lowStockProducts.length}
              pendingApprovals={pendingApprovals as number}
            />
          </div>
        </div>
      </div>

      {/* ── Fila 2: evolución · próximos vencimientos ── */}
      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <RevenueChart data={chartData} period={chartPeriod} onPeriodChange={setChartPeriod} />
        <UpcomingDuesWidget />
      </div>

      {/* Panel personalizable por usuario. El dossier lo daba por widget
          duplicado, pero es una funcionalidad propia con configuración
          guardada en dashboard_configs, así que se conserva. */}
      <CustomDashboard />

      {/* ── Finanzas ── */}
      <div className="space-y-3">
        <SectionLabel>Finanzas</SectionLabel>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <InvoiceStatusChart data={statusData} />
          <TopClients clients={topClients} />
          <LowStockAlerts products={lowStockProducts} />
        </div>
      </div>

      {/* ── Clientes y equipo ── */}
      <div className="space-y-3">
        <SectionLabel>Clientes y equipo</SectionLabel>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <TodayAttendanceWidget />
          <RemindersWidget />
        </div>
      </div>

      {/* ── Operativa ── */}
      <div className="space-y-3">
        <SectionLabel>Operativa</SectionLabel>
        <RecentActivity invoices={recent} />
      </div>
    </div>
  );
};

const AppDashboard = () => {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (role === "EMPLOYEE") return <EmployeeDashboard />;
  return <ManagerDashboard />;
};

export default AppDashboard;
