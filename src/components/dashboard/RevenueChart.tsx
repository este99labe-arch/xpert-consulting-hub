import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  ToggleGroup, ToggleGroupItem,
} from "@/components/ui/toggle-group";

interface RevenueChartProps {
  data: { label: string; income: number; expense: number }[];
  period: string;
  onPeriodChange: (p: string) => void;
}

const chartConfig = {
  income: { label: "Ingresos", color: "hsl(var(--success))" },
  expense: { label: "Gastos", color: "hsl(var(--destructive))" },
};

const RevenueChart = ({ data, period, onPeriodChange }: RevenueChartProps) => {
  const useArea = period === "7d";

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">Ingresos vs Gastos</CardTitle>
        <ToggleGroup type="single" value={period} onValueChange={(v) => v && onPeriodChange(v)} size="sm" className="bg-muted rounded-lg p-0.5">
          <ToggleGroupItem value="7d" className="text-xs px-3 h-7 rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm">7d</ToggleGroupItem>
          <ToggleGroupItem value="30d" className="text-xs px-3 h-7 rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm">30d</ToggleGroupItem>
          <ToggleGroupItem value="12m" className="text-xs px-3 h-7 rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm">12m</ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        <div className="w-full h-[260px]">
          <ChartContainer config={chartConfig} className="!aspect-auto h-full w-full">
            {useArea ? (
              <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" width={50} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="income" stroke="hsl(var(--success))" fill="url(#incGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="expense" stroke="hsl(var(--destructive))" fill="url(#expGrad)" strokeWidth={2} />
              </AreaChart>
            ) : (
              <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" width={50} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="income" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} barSize={period === "30d" ? 8 : 20} />
                <Bar dataKey="expense" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} barSize={period === "30d" ? 8 : 20} />
              </BarChart>
            )}
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default RevenueChart;
