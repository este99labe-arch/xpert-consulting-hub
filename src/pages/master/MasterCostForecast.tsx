import { fmtEUR0 as EUR0, fmtEUR as EUR } from "@/lib/format";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp, TrendingDown, Wallet, Plus, Trash2, Loader2, Landmark, PiggyBank,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format, startOfMonth, subMonths, addMonths, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const db = supabase as any;

// Considera ingreso el importe facturado (emitido) por la cuenta matriz.
const INCOME_STATUSES = ["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"];

const MasterCostForecast = () => {
  const { accountId } = useAuth();
  const qc = useQueryClient();
  const [monthsBack, setMonthsBack] = useState(6);
  const [monthsFwd, setMonthsFwd] = useState(3);
  const [newConcept, setNewConcept] = useState("");
  const [newAmount, setNewAmount] = useState("");

  // Ingresos reales de XpertConsulting (sus propias facturas emitidas)
  const { data: invoices = [] } = useQuery({
    queryKey: ["master-own-invoices", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("type, status, amount_total, issue_date")
        .eq("account_id", accountId!)
        .gte("issue_date", format(subMonths(new Date(), 24), "yyyy-MM-dd"));
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  // Costes previstos (recurrentes mensuales)
  const { data: costs = [] } = useQuery({
    queryKey: ["master-cost-forecast", accountId],
    queryFn: async () => {
      const { data, error } = await db
        .from("master_cost_forecast")
        .select("*")
        .eq("account_id", accountId!)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!accountId,
  });

  const monthlyCost = useMemo(
    () => costs.filter((c) => c.is_active).reduce((s, c) => s + Number(c.monthly_amount || 0), 0),
    [costs],
  );

  const addCost = useMutation({
    mutationFn: async () => {
      const amount = Number(newAmount.replace(",", "."));
      if (!newConcept.trim() || !(amount >= 0)) throw new Error("Concepto e importe válidos requeridos");
      const { error } = await db.from("master_cost_forecast").insert({
        account_id: accountId, concept: newConcept.trim(), monthly_amount: amount, sort_order: costs.length,
      });
      if (error) throw error;
    },
    onSuccess: () => { setNewConcept(""); setNewAmount(""); qc.invalidateQueries({ queryKey: ["master-cost-forecast", accountId] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateCost = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await db.from("master_cost_forecast").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["master-cost-forecast", accountId] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeCost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("master_cost_forecast").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["master-cost-forecast", accountId] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Serie mensual: ingreso real (pasado) + coste previsto (constante) + beneficio
  const series = useMemo(() => {
    const now = new Date();
    const incomeByMonth = new Map<string, number>();
    (invoices as any[])
      .filter((i) => i.type === "INVOICE" && INCOME_STATUSES.includes(i.status))
      .forEach((i) => {
        const k = format(startOfMonth(parseISO(i.issue_date)), "yyyy-MM");
        incomeByMonth.set(k, (incomeByMonth.get(k) || 0) + Number(i.amount_total || 0));
      });

    const rows: { key: string; label: string; ingreso: number | null; coste: number; beneficio: number | null; futuro: boolean }[] = [];
    for (let i = -monthsBack; i <= monthsFwd; i++) {
      const d = startOfMonth(i < 0 ? subMonths(now, -i) : addMonths(now, i));
      const key = format(d, "yyyy-MM");
      const future = i > 0;
      const ingreso = future ? null : (incomeByMonth.get(key) || 0);
      const beneficio = ingreso === null ? null : ingreso - monthlyCost;
      rows.push({ key, label: format(d, "MMM yy", { locale: es }), ingreso, coste: monthlyCost, beneficio, futuro: future });
    }
    return rows;
  }, [invoices, monthlyCost, monthsBack, monthsFwd]);

  // KPIs sobre los meses con ingreso real
  const kpi = useMemo(() => {
    const real = series.filter((r) => !r.futuro && r.ingreso !== null);
    const withIncome = real.filter((r) => (r.ingreso || 0) > 0);
    const avgIncome = withIncome.length ? withIncome.reduce((s, r) => s + (r.ingreso || 0), 0) / withIncome.length : 0;
    const expectedProfit = avgIncome - monthlyCost;
    const margin = avgIncome > 0 ? (expectedProfit / avgIncome) * 100 : 0;
    return { avgIncome, monthlyCost, expectedProfit, margin };
  }, [series, monthlyCost]);

  const kpis = [
    { label: "Ingreso medio mensual", value: EUR0(kpi.avgIncome), icon: TrendingUp, tone: "text-[hsl(var(--success))]", bg: "bg-[hsl(var(--success))]/10", hint: "Media de meses con facturación" },
    { label: "Coste mensual previsto", value: EUR0(kpi.monthlyCost), icon: TrendingDown, tone: "text-destructive", bg: "bg-destructive/10", hint: "Suma de costes activos" },
    { label: "Beneficio mensual esperado", value: EUR0(kpi.expectedProfit), icon: PiggyBank, tone: kpi.expectedProfit >= 0 ? "text-[hsl(var(--success))]" : "text-destructive", bg: "bg-primary/10", hint: "Ingreso medio − coste previsto" },
    { label: "Margen esperado", value: `${Math.round(kpi.margin)}%`, icon: Wallet, tone: kpi.margin >= 0 ? "text-primary" : "text-destructive", bg: "bg-primary/10", hint: "Beneficio / ingreso" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Previsión de costes vs beneficios</h2>
        <p className="text-sm text-muted-foreground">
          Compara los ingresos reales de XpertConsulting (sus facturas emitidas) con tu coste mensual previsto
          para estimar el beneficio.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{k.label}</span>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${k.bg}`}>
                  <k.icon className={`h-3.5 w-3.5 ${k.tone}`} />
                </div>
              </div>
              <p className={`text-xl font-bold tracking-tight ${k.tone}`}>{k.value}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{k.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráfico ingresos vs coste vs beneficio */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Landmark className="h-4 w-4 text-primary" />Ingresos reales vs coste previsto</CardTitle>
            <CardDescription>Los meses futuros muestran solo la previsión de coste.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(monthsBack)} onValueChange={(v) => setMonthsBack(Number(v))}>
              <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 meses atrás</SelectItem>
                <SelectItem value="6">6 meses atrás</SelectItem>
                <SelectItem value="12">12 meses atrás</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(monthsFwd)} onValueChange={(v) => setMonthsFwd(Number(v))}>
              <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sin previsión</SelectItem>
                <SelectItem value="3">3 meses vista</SelectItem>
                <SelectItem value="6">6 meses vista</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => EUR0(v)} width={70} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                formatter={(v: any, name: any) => [v === null ? "—" : EUR(Number(v)), name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar name="Ingresos" dataKey="ingreso" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Line name="Coste previsto" dataKey="coste" stroke="hsl(var(--destructive))" strokeWidth={2} strokeDasharray="5 4" dot={false} />
              <Line name="Beneficio" dataKey="beneficio" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Editor de costes mensuales */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4 text-primary" />Costes mensuales previstos</CardTitle>
          <CardDescription>Añade tus costes recurrentes (nóminas, hosting, herramientas, OpenAI…). Total: <span className="font-semibold text-foreground">{EUR(monthlyCost)}/mes</span></CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {costs.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Sin costes previstos todavía. Añade el primero abajo.</p>
          )}
          {costs.map((c) => (
            <div key={c.id} className={`flex items-center gap-2 rounded-lg border border-border p-2.5 ${c.is_active ? "" : "opacity-55"}`}>
              <Input
                defaultValue={c.concept}
                onBlur={(e) => { if (e.target.value.trim() && e.target.value !== c.concept) updateCost.mutate({ id: c.id, patch: { concept: e.target.value.trim() } }); }}
                className="h-9 flex-1"
              />
              <div className="relative w-36">
                <Input
                  type="number" step="0.01" defaultValue={Number(c.monthly_amount)}
                  onBlur={(e) => { const v = Number(e.target.value); if (v >= 0 && v !== Number(c.monthly_amount)) updateCost.mutate({ id: c.id, patch: { monthly_amount: v } }); }}
                  className="h-9 pr-7 text-right"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
              </div>
              <Switch checked={c.is_active} onCheckedChange={(v) => updateCost.mutate({ id: c.id, patch: { is_active: v } })} />
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeCost.mutate(c.id)} title="Eliminar">
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}

          <div className="flex items-center gap-2 border-t border-border pt-3">
            <Input placeholder="Concepto (ej. Hosting, Nóminas…)" value={newConcept} onChange={(e) => setNewConcept(e.target.value)} className="h-9 flex-1" onKeyDown={(e) => e.key === "Enter" && addCost.mutate()} />
            <div className="relative w-36">
              <Input type="number" step="0.01" placeholder="0,00" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} className="h-9 pr-7 text-right" onKeyDown={(e) => e.key === "Enter" && addCost.mutate()} />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
            </div>
            <Button onClick={() => addCost.mutate()} disabled={!newConcept.trim() || addCost.isPending} className="gap-1.5">
              {addCost.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Añadir
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MasterCostForecast;
