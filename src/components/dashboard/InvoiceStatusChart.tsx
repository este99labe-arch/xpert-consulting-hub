import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell } from "recharts";

interface StatusData {
  name: string;
  count: number;
  amount: number;
  color: string;
}

interface InvoiceStatusChartProps {
  data: StatusData[];
}

const EUR = (n: number) =>
  n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

const chartConfig = {
  count: { label: "Facturas" },
};

const InvoiceStatusChart = ({ data }: InvoiceStatusChartProps) => {
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Estado de Facturas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="w-[140px] h-[140px] shrink-0">
            <ChartContainer config={chartConfig} className="!aspect-square h-full w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie data={data} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={60} strokeWidth={2} stroke="hsl(var(--card))">
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </div>
          <div className="flex-1 space-y-2">
            {data.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-medium">{d.count}</span>
                  <span className="text-xs text-muted-foreground ml-2">{EUR(d.amount)}</span>
                </div>
              </div>
            ))}
            {total === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sin facturas</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default InvoiceStatusChart;
