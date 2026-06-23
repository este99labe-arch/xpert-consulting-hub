import { Card } from "@/components/ui/card";
import {
  TrendingUp, TrendingDown, BarChart3, DollarSign, FileText, Users,
  ArrowUpRight, ArrowDownRight, UserCheck, Bell,
} from "lucide-react";

interface KpiCardsProps {
  income: number;
  expense: number;
  balance: number;
  pendingCount: number;
  overdueCount: number;
  activeClients: number;
  prevIncome: number;
  prevExpense: number;
  prevPendingCount: number;
  prevOverdueCount: number;
  prevActiveClients: number;
  teamPresent?: { present: number; total: number };
  pendingApprovals?: number;
  onKpiClick?: (kpiKey: string) => void;
}

const EUR = (n: number) =>
  n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const pctChange = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

const ChangeIndicator = ({ current, previous, invert }: { current: number; previous: number; invert?: boolean }) => {
  const pct = pctChange(current, previous);
  if (pct === 0) return <span className="text-xs text-muted-foreground">Sin cambios vs. periodo previo</span>;
  const up = pct > 0;
  // For expenses/overdue, an increase is "bad" → red
  const good = invert ? !up : up;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${good ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct)}%
      <span className="font-normal text-muted-foreground">vs. previo</span>
    </span>
  );
};

interface Kpi {
  key: string;
  label: string;
  value: string;
  icon: any;
  color: string;
  bg: string;
  accent: string;
  change: React.ReactNode;
}

const KpiCards = (props: KpiCardsProps) => {
  const baseKpis: Kpi[] = [
    {
      key: "income", label: "Ingresos", value: EUR(props.income), icon: TrendingUp,
      color: "text-[hsl(var(--success))]", bg: "bg-[hsl(var(--success))]/10", accent: "var(--success)",
      change: <ChangeIndicator current={props.income} previous={props.prevIncome} />,
    },
    {
      key: "expense", label: "Gastos", value: EUR(props.expense), icon: TrendingDown,
      color: "text-destructive", bg: "bg-destructive/10", accent: "var(--destructive)",
      change: <ChangeIndicator current={props.expense} previous={props.prevExpense} invert />,
    },
    {
      key: "balance", label: "Balance", value: EUR(props.balance), icon: BarChart3,
      color: props.balance >= 0 ? "text-[hsl(var(--success))]" : "text-destructive",
      bg: "bg-primary/10", accent: "var(--primary)", change: null,
    },
    {
      key: "clients", label: "Clientes activos", value: String(props.activeClients), icon: Users,
      color: "text-primary", bg: "bg-primary/10", accent: "var(--primary)",
      change: <ChangeIndicator current={props.activeClients} previous={props.prevActiveClients} />,
    },
    {
      key: "pending", label: "Facturas pendientes", value: String(props.pendingCount), icon: FileText,
      color: "text-[hsl(var(--warning))]", bg: "bg-[hsl(var(--warning))]/10", accent: "var(--warning)",
      change: <ChangeIndicator current={props.pendingCount} previous={props.prevPendingCount} invert />,
    },
    {
      key: "overdue", label: "Facturas vencidas", value: String(props.overdueCount), icon: DollarSign,
      color: "text-destructive", bg: "bg-destructive/10", accent: "var(--destructive)",
      change: <ChangeIndicator current={props.overdueCount} previous={props.prevOverdueCount} invert />,
    },
  ];

  const extraKpis: Kpi[] = [];
  if (props.teamPresent) {
    extraKpis.push({
      key: "team", label: "Equipo presente", value: `${props.teamPresent.present}/${props.teamPresent.total}`,
      icon: UserCheck, color: "text-primary", bg: "bg-primary/10", accent: "var(--primary)", change: null,
    });
  }
  if (props.pendingApprovals !== undefined) {
    extraKpis.push({
      key: "approvals", label: "Solicitudes pendientes", value: String(props.pendingApprovals),
      icon: Bell,
      color: props.pendingApprovals > 0 ? "text-[hsl(var(--warning))]" : "text-muted-foreground",
      bg: props.pendingApprovals > 0 ? "bg-[hsl(var(--warning))]/10" : "bg-muted",
      accent: props.pendingApprovals > 0 ? "var(--warning)" : "var(--muted-foreground)",
      change: null,
    });
  }

  const kpis = [...baseKpis, ...extraKpis];

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <Card
          key={kpi.key}
          role="button"
          tabIndex={0}
          onClick={() => props.onKpiClick?.(kpi.key)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); props.onKpiClick?.(kpi.key); } }}
          className="group relative cursor-pointer overflow-hidden border-0 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          title={`Ver detalle de ${kpi.label}`}
        >
          {/* accent strip */}
          <div className="absolute inset-x-0 top-0 h-1 opacity-80" style={{ backgroundColor: `hsl(${kpi.accent})` }} />
          <div className="p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{kpi.label}</span>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.bg} transition-transform group-hover:scale-110`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold tracking-tight tabular-nums ${kpi.color}`}>{kpi.value}</p>
            {kpi.change && <div className="mt-1.5">{kpi.change}</div>}
          </div>
        </Card>
      ))}
    </div>
  );
};

export default KpiCards;
