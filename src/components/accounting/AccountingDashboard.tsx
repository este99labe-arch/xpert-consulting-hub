import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Calculator, TrendingUp, TrendingDown } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--accent))", "#f59e0b", "#8b5cf6", "#06b6d4"];
const EUR = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

interface AccountingDashboardProps {
  totalIncome: number;
  totalExpense: number;
  vatCollected: number;
  vatPaid: number;
  monthlyData: { month: string; ingresos: number; gastos: number }[];
  pieData: { name: string; value: number }[];
}

const AccountingDashboard = ({
  totalIncome, totalExpense, vatCollected, vatPaid, monthlyData, pieData,
}: AccountingDashboardProps) => (
  <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-2xl font-bold truncate">{EUR(totalIncome)}</p>
              <p className="text-xs text-muted-foreground">Ingresos totales</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <TrendingDown className="h-8 w-8 shrink-0 text-destructive" />
            <div className="min-w-0">
              <p className="text-2xl font-bold truncate">{EUR(totalExpense)}</p>
              <p className="text-xs text-muted-foreground">Gastos totales</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-8 w-8 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className={`text-2xl font-bold truncate ${totalIncome - totalExpense >= 0 ? "" : "text-destructive"}`}>
                {EUR(totalIncome - totalExpense)}
              </p>
              <p className="text-xs text-muted-foreground">Resultado neto</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Calculator className="h-8 w-8 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className={`text-2xl font-bold truncate ${vatCollected - vatPaid >= 0 ? "text-destructive" : ""}`}>
                {EUR(vatCollected - vatPaid)}
              </p>
              <p className="text-xs text-muted-foreground">IVA a {vatCollected - vatPaid >= 0 ? "liquidar" : "compensar"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="overflow-hidden">
        <CardHeader><CardTitle className="text-base">Evolución mensual</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 11 }} />
                <YAxis className="text-xs" tick={{ fontSize: 11 }} width={60} />
                <Tooltip formatter={(v: number) => EUR(v)} />
                <Bar dataKey="ingresos" fill="hsl(var(--primary))" name="Ingresos" radius={[2, 2, 0, 0]} />
                <Bar dataKey="gastos" fill="hsl(var(--destructive))" name="Gastos" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card className="overflow-hidden">
        <CardHeader><CardTitle className="text-base">Distribución de gastos</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => {
                      const short = name.length > 15 ? name.slice(0, 15) + "…" : name;
                      return `${short} ${(percent * 100).toFixed(0)}%`;
                    }}
                    labelLine={{ strokeWidth: 1 }}
                  >
                    {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => EUR(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">Sin datos de gastos</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);

export default AccountingDashboard;
