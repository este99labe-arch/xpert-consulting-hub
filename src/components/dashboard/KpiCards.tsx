import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp, TrendingDown, BarChart3, DollarSign, FileText, Users,
  ArrowUpRight, ArrowDownRight,
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
  onKpiClick?: (kpiKey: string) => void;
}

const EUR = (n: number) =>
  n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

const pctChange = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

const ChangeIndicator = ({ current, previous }: { current: number; previous: number }) => {
  const pct = pctChange(current, previous);
  if (pct === 0) return <span className="text-xs text-muted-foreground">Sin cambios</span>;
  const positive = pct > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct)}%
    </span>
  );
};

const KpiCards = (props: KpiCardsProps) => {
  const kpis = [
    {
      key: "income",
      label: "Ingresos",
      value: EUR(props.income),
      icon: TrendingUp,
      color: "text-[hsl(var(--success))]",
      bg: "bg-[hsl(var(--success))]/10",
      change: <ChangeIndicator current={props.income} previous={props.prevIncome} />,
    },
    {
      key: "expense",
      label: "Gastos",
      value: EUR(props.expense),
      icon: TrendingDown,
      color: "text-destructive",
      bg: "bg-destructive/10",
      change: <ChangeIndicator current={props.expense} previous={props.prevExpense} />,
    },
    {
      key: "balance",
      label: "Balance",
      value: EUR(props.balance),
      icon: BarChart3,
      color: props.balance >= 0 ? "text-[hsl(var(--success))]" : "text-destructive",
      bg: "bg-primary/10",
      change: null,
    },
    {
      key: "pending",
      label: "Pendientes",
      value: String(props.pendingCount),
      icon: FileText,
      color: "text-[hsl(var(--warning))]",
      bg: "bg-[hsl(var(--warning))]/10",
      change: <ChangeIndicator current={props.pendingCount} previous={props.prevPendingCount} />,
    },
    {
      key: "overdue",
      label: "Vencidas",
      value: String(props.overdueCount),
      icon: DollarSign,
      color: "text-destructive",
      bg: "bg-destructive/10",
      change: <ChangeIndicator current={props.overdueCount} previous={props.prevOverdueCount} />,
    },
    {
      key: "clients",
      label: "Clientes Activos",
      value: String(props.activeClients),
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10",
      change: <ChangeIndicator current={props.activeClients} previous={props.prevActiveClients} />,
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">{kpi.label}</span>
              <button
                type="button"
                onClick={() => props.onKpiClick?.(kpi.key)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.bg} hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer`}
                title={`Ver detalle de ${kpi.label}`}
              >
                <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
              </button>
            </div>
            <p className={`text-xl font-bold tracking-tight ${kpi.color}`}>{kpi.value}</p>
            {kpi.change && <div className="mt-1">{kpi.change}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default KpiCards;
