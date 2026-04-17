import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2, CheckCircle, Sparkles, Users, Boxes, TrendingUp, ExternalLink, AlertTriangle, Activity,
} from "lucide-react";
import { format, subMonths, startOfMonth, parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";

const EUR0 = (n: number) => Number(n).toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const MasterDashboard = () => {
  const navigate = useNavigate();

  const { data: accounts = [] } = useQuery({
    queryKey: ["master-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, name, is_active, type, created_at")
        .eq("type", "CLIENT")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: accountModules = [] } = useQuery({
    queryKey: ["master-account-modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_modules")
        .select("account_id, is_enabled, service_modules(code, name)")
        .eq("is_enabled", true);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["master-invoices-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("account_id, type, status, amount_total, issue_date")
        .eq("type", "INVOICE")
        .gte("issue_date", format(subMonths(new Date(), 12), "yyyy-MM-dd"));
      if (error) throw error;
      return data || [];
    },
  });

  const { data: usersCount = 0 } = useQuery({
    queryKey: ["master-users-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("user_accounts")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);
      if (error) throw error;
      return count || 0;
    },
  });

  // KPIs
  const total = accounts.length;
  const active = accounts.filter((a: any) => a.is_active).length;
  const monthAgo = subMonths(new Date(), 1);
  const newThisMonth = accounts.filter((a: any) => parseISO(a.created_at) >= startOfMonth(new Date())).length;
  const modulesActive = accountModules.length;
  const monthStart = startOfMonth(new Date());
  const networkRevenue = (invoices as any[])
    .filter((i) => i.status === "PAID" && parseISO(i.issue_date) >= monthStart)
    .reduce((acc, i) => acc + Number(i.amount_total), 0);

  // Account growth (last 6 months)
  const growth = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const m = startOfMonth(subMonths(new Date(), 5 - i));
      const count = accounts.filter((a: any) => parseISO(a.created_at) <= new Date(m.getFullYear(), m.getMonth() + 1, 0)).length;
      return { month: format(m, "MMM", { locale: es }), count };
    });
  }, [accounts]);

  // Module distribution
  const moduleDist = useMemo(() => {
    const map = new Map<string, number>();
    (accountModules as any[]).forEach((am) => {
      const name = am.service_modules?.name;
      if (!name) return;
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [accountModules]);

  // Top accounts by activity (current month)
  const topAccounts = useMemo(() => {
    const map = new Map<string, number>();
    (invoices as any[]).filter((i) => parseISO(i.issue_date) >= monthStart).forEach((i) => {
      map.set(i.account_id, (map.get(i.account_id) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([id, count]) => ({ id, count, name: accounts.find((a: any) => a.id === id)?.name || "—" }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [invoices, accounts]);

  // Inactive (no invoices in 30 days)
  const churnRisk = useMemo(() => {
    const recent = new Set(
      (invoices as any[]).filter((i) => differenceInDays(new Date(), parseISO(i.issue_date)) <= 30).map((i) => i.account_id)
    );
    return accounts.filter((a: any) => a.is_active && !recent.has(a.id)).slice(0, 5);
  }, [invoices, accounts]);

  const kpis = [
    { label: "Cuentas totales", value: total, icon: Building2, color: "text-primary", bg: "bg-primary/10" },
    { label: "Cuentas activas", value: active, icon: CheckCircle, color: "text-[hsl(var(--success))]", bg: "bg-[hsl(var(--success))]/10" },
    { label: "Nuevas este mes", value: newThisMonth, icon: Sparkles, color: "text-[hsl(var(--warning))]", bg: "bg-[hsl(var(--warning))]/10" },
    { label: "Usuarios activos", value: usersCount, icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { label: "Módulos activados", value: modulesActive, icon: Boxes, color: "text-primary", bg: "bg-primary/10" },
    { label: "Ingresos red (mes)", value: EUR0(networkRevenue), icon: TrendingUp, color: "text-[hsl(var(--success))]", bg: "bg-[hsl(var(--success))]/10" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Panel Admin</h1>
          <p className="text-sm text-muted-foreground">Resumen ejecutivo de la red XpertConsulting</p>
        </div>
        <Button onClick={() => navigate("/master/clients")} variant="outline" size="sm">
          Gestionar cuentas <ExternalLink className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">{k.label}</span>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${k.bg}`}>
                  <k.icon className={`h-3.5 w-3.5 ${k.color}`} />
                </div>
              </div>
              <p className={`text-xl font-bold tracking-tight ${k.color}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />Crecimiento de cuentas (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={growth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Boxes className="h-4 w-4 text-primary" />Distribución de módulos activos</CardTitle>
          </CardHeader>
          <CardContent>
            {moduleDist.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={moduleDist} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={100} />
                  <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top accounts + churn risk */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Cuentas más activas (mes)</CardTitle>
          </CardHeader>
          <CardContent>
            {topAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin actividad este mes</p>
            ) : (
              <div className="space-y-2">
                {topAccounts.map((a, idx) => (
                  <div key={a.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-muted-foreground w-5">#{idx + 1}</span>
                      <span className="text-sm font-medium truncate">{a.name}</span>
                    </div>
                    <Badge variant="secondary" className="shrink-0">{a.count} facturas</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />Riesgo de inactividad</CardTitle>
          </CardHeader>
          <CardContent>
            {churnRisk.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Toda la red ha tenido actividad reciente 🎉</p>
            ) : (
              <div className="space-y-2">
                {churnRisk.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-2 rounded-md border border-[hsl(var(--warning))]/20 bg-[hsl(var(--warning))]/5">
                    <span className="text-sm font-medium truncate">{a.name}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">Sin actividad 30d</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent accounts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />Últimas cuentas creadas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {accounts.slice(0, 5).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{format(parseISO(a.created_at), "dd MMM yyyy", { locale: es })}</p>
                </div>
                <Badge variant={a.is_active ? "default" : "secondary"}>{a.is_active ? "Activa" : "Inactiva"}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MasterDashboard;
