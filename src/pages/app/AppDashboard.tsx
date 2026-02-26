import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingDown, BarChart3, Users } from "lucide-react";

const AppDashboard = () => {
  const kpis = [
    { label: "Total Ventas", value: "—", icon: DollarSign },
    { label: "Total Gastos", value: "—", icon: TrendingDown },
    { label: "Balance", value: "—", icon: BarChart3 },
    { label: "Empleados Activos", value: "—", icon: Users },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-muted-foreground">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1">Disponible en Phase 2</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AppDashboard;
