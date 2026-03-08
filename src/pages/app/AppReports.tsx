import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3, FileText, Clock, Package, TrendingUp, TrendingDown, Download, Printer, Loader2,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";
import MasterAccountSelector from "@/components/shared/MasterAccountSelector";

const EUR = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

// ─── P&L REPORT ─────────────────────────────────────────
const PLReport = ({ accountId }: { accountId: string }) => {
  const now = new Date();
  const [period, setPeriod] = useState("month");
  const [year, setYear] = useState(now.getFullYear().toString());
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3).toString());
  const [month, setMonth] = useState((now.getMonth() + 1).toString());

  const dateRange = useMemo(() => {
    const y = parseInt(year);
    if (period === "year") return { from: startOfYear(new Date(y, 0)), to: endOfYear(new Date(y, 0)) };
    if (period === "quarter") {
      const q = parseInt(quarter);
      const qStart = new Date(y, (q - 1) * 3, 1);
      return { from: startOfQuarter(qStart), to: endOfQuarter(qStart) };
    }
    const m = parseInt(month) - 1;
    return { from: startOfMonth(new Date(y, m)), to: endOfMonth(new Date(y, m)) };
  }, [period, year, quarter, month]);

  const { data: chartAccounts = [] } = useQuery({
    queryKey: ["report-chart-accounts", accountId],
    queryFn: async () => {
      const { data } = await supabase.from("chart_of_accounts").select("*").eq("account_id", accountId);
      return data || [];
    },
    enabled: !!accountId,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["report-entries", accountId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("journal_entries")
        .select("id, date, status")
        .eq("account_id", accountId)
        .eq("status", "POSTED")
        .gte("date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("date", format(dateRange.to, "yyyy-MM-dd"));
      return data || [];
    },
    enabled: !!accountId,
  });

  const entryIds = entries.map((e: any) => e.id);

  const { data: lines = [] } = useQuery({
    queryKey: ["report-entry-lines", entryIds],
    queryFn: async () => {
      if (entryIds.length === 0) return [];
      const { data } = await supabase
        .from("journal_entry_lines")
        .select("*")
        .in("entry_id", entryIds);
      return data || [];
    },
    enabled: entryIds.length > 0,
  });

  const plData = useMemo(() => {
    const incomeAccounts = chartAccounts.filter((a: any) => a.type === "INCOME");
    const expenseAccounts = chartAccounts.filter((a: any) => a.type === "EXPENSE");

    const getTotal = (accounts: any[]) =>
      accounts.map((acc: any) => {
        const accLines = lines.filter((l: any) => l.chart_account_id === acc.id);
        const total = accLines.reduce((sum: number, l: any) => sum + (Number(l.credit) - Number(l.debit)), 0);
        return { ...acc, total: Math.abs(total) };
      }).filter((a: any) => a.total > 0);

    const income = getTotal(incomeAccounts);
    const expenses = getTotal(expenseAccounts);
    const totalIncome = income.reduce((s: number, a: any) => s + a.total, 0);
    const totalExpense = expenses.reduce((s: number, a: any) => s + a.total, 0);

    return { income, expenses, totalIncome, totalExpense, result: totalIncome - totalExpense };
  }, [chartAccounts, lines]);

  const exportCSV = () => {
    const rows = [
      ["Tipo", "Código", "Cuenta", "Importe"],
      ...plData.income.map((a: any) => ["Ingreso", a.code, a.name, a.total.toFixed(2)]),
      ["", "", "TOTAL INGRESOS", plData.totalIncome.toFixed(2)],
      ...plData.expenses.map((a: any) => ["Gasto", a.code, a.name, a.total.toFixed(2)]),
      ["", "", "TOTAL GASTOS", plData.totalExpense.toFixed(2)],
      ["", "", "RESULTADO", plData.result.toFixed(2)],
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PyG_${format(dateRange.from, "yyyy-MM-dd")}_${format(dateRange.to, "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Mensual</SelectItem>
            <SelectItem value="quarter">Trimestral</SelectItem>
            <SelectItem value="year">Anual</SelectItem>
          </SelectContent>
        </Select>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[0, 1, 2].map((i) => {
              const y = (now.getFullYear() - i).toString();
              return <SelectItem key={y} value={y}>{y}</SelectItem>;
            })}
          </SelectContent>
        </Select>
        {period === "quarter" && (
          <Select value={quarter} onValueChange={setQuarter}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["1", "2", "3", "4"].map((q) => (
                <SelectItem key={q} value={q}>T{q}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {period === "month" && (
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>
                  {format(new Date(2024, i), "MMMM", { locale: es })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1" /> Imprimir
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3 print:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4 text-green-600" /> Ingresos
            </div>
            <p className="text-2xl font-bold text-green-600">{EUR(plData.totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingDown className="h-4 w-4 text-red-600" /> Gastos
            </div>
            <p className="text-2xl font-bold text-red-600">{EUR(plData.totalExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground mb-1">Resultado</div>
            <p className={`text-2xl font-bold ${plData.result >= 0 ? "text-green-600" : "text-destructive"}`}>
              {EUR(plData.result)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Ingresos</CardTitle></CardHeader>
          <CardContent>
            {plData.income.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Cuenta</TableHead><TableHead className="text-right">Importe</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {plData.income.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm">{a.code} — {a.name}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{EUR(a.total)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{EUR(plData.totalIncome)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Gastos</CardTitle></CardHeader>
          <CardContent>
            {plData.expenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Cuenta</TableHead><TableHead className="text-right">Importe</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {plData.expenses.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm">{a.code} — {a.name}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{EUR(a.total)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{EUR(plData.totalExpense)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// ─── ATTENDANCE REPORT ──────────────────────────────────
const AttendanceReport = ({ accountId }: { accountId: string }) => {
  const now = new Date();
  const [month, setMonth] = useState((now.getMonth() + 1).toString());
  const [year, setYear] = useState(now.getFullYear().toString());

  const dateRange = useMemo(() => {
    const m = parseInt(month) - 1;
    const y = parseInt(year);
    return { from: startOfMonth(new Date(y, m)), to: endOfMonth(new Date(y, m)) };
  }, [month, year]);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["report-attendance", accountId, dateRange.from.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("account_id", accountId)
        .gte("work_date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("work_date", format(dateRange.to, "yyyy-MM-dd"));
      return data || [];
    },
    enabled: !!accountId,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["report-employees", accountId],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_profiles")
        .select("user_id, first_name, last_name")
        .eq("account_id", accountId);
      return data || [];
    },
    enabled: !!accountId,
  });

  const summary = useMemo(() => {
    return employees.map((emp: any) => {
      const empRecords = records.filter((r: any) => r.user_id === emp.user_id);
      let totalMinutes = 0;
      empRecords.forEach((r: any) => {
        if (r.check_in && r.check_out) {
          totalMinutes += differenceInMinutes(new Date(r.check_out), new Date(r.check_in));
        }
      });
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return {
        name: `${emp.first_name} ${emp.last_name}`,
        days: empRecords.length,
        totalHours: `${hours}h ${mins}m`,
        avgHours: empRecords.length > 0 ? (totalMinutes / empRecords.length / 60).toFixed(1) + "h" : "—",
      };
    });
  }, [employees, records]);

  const exportCSV = () => {
    const rows = [
      ["Empleado", "Días fichados", "Total horas", "Media diaria"],
      ...summary.map((s) => [s.name, s.days.toString(), s.totalHours, s.avgHours]),
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Asistencia_${year}-${month.padStart(2, "0")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => (
              <SelectItem key={i + 1} value={(i + 1).toString()}>
                {format(new Date(2024, i), "MMMM", { locale: es })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[0, 1, 2].map((i) => {
              const y = (now.getFullYear() - i).toString();
              return <SelectItem key={y} value={y}>{y}</SelectItem>;
            })}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : summary.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Sin datos de asistencia</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead className="text-center">Días</TableHead>
                  <TableHead className="text-right">Total horas</TableHead>
                  <TableHead className="text-right">Media/día</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-center">{s.days}</TableCell>
                    <TableCell className="text-right">{s.totalHours}</TableCell>
                    <TableCell className="text-right">{s.avgHours}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ─── INVENTORY VALUATION REPORT ─────────────────────────
const InventoryReport = ({ accountId }: { accountId: string }) => {
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["report-products", accountId],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: !!accountId,
  });

  const totalValue = products.reduce((s: number, p: any) => s + Number(p.current_stock) * Number(p.cost_price), 0);
  const totalSaleValue = products.reduce((s: number, p: any) => s + Number(p.current_stock) * Number(p.sale_price), 0);
  const lowStockCount = products.filter((p: any) => Number(p.current_stock) < Number(p.min_stock)).length;

  const exportCSV = () => {
    const rows = [
      ["SKU", "Producto", "Stock", "Coste unit.", "Precio venta", "Valor coste", "Valor venta"],
      ...products.map((p: any) => [
        p.sku, p.name, p.current_stock,
        Number(p.cost_price).toFixed(2), Number(p.sale_price).toFixed(2),
        (Number(p.current_stock) * Number(p.cost_price)).toFixed(2),
        (Number(p.current_stock) * Number(p.sale_price)).toFixed(2),
      ]),
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Inventario_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground mb-1">Valor a coste</div>
            <p className="text-2xl font-bold">{EUR(totalValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground mb-1">Valor a PVP</div>
            <p className="text-2xl font-bold">{EUR(totalSaleValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground mb-1">Productos bajo mínimo</div>
            <p className={`text-2xl font-bold ${lowStockCount > 0 ? "text-destructive" : ""}`}>
              {lowStockCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Coste unit.</TableHead>
                  <TableHead className="text-right">Valor coste</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p: any) => {
                  const isLow = Number(p.current_stock) < Number(p.min_stock);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs font-mono">{p.sku}</TableCell>
                      <TableCell className="font-medium text-sm">{p.name}</TableCell>
                      <TableCell className="text-center">
                        <span className={isLow ? "text-destructive font-bold" : ""}>
                          {p.current_stock}
                        </span>
                        {isLow && <Badge variant="destructive" className="ml-2 text-[10px]">Bajo</Badge>}
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">{EUR(Number(p.cost_price))}</TableCell>
                      <TableCell className="text-right font-medium">
                        {EUR(Number(p.current_stock) * Number(p.cost_price))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ─── INVOICE SUMMARY REPORT ─────────────────────────────
const InvoiceSummaryReport = ({ accountId }: { accountId: string }) => {
  const now = new Date();
  const [period, setPeriod] = useState("month");
  const [year, setYear] = useState(now.getFullYear().toString());
  const [month, setMonth] = useState((now.getMonth() + 1).toString());

  const dateRange = useMemo(() => {
    const y = parseInt(year);
    if (period === "year") return { from: startOfYear(new Date(y, 0)), to: endOfYear(new Date(y, 0)) };
    const m = parseInt(month) - 1;
    return { from: startOfMonth(new Date(y, m)), to: endOfMonth(new Date(y, m)) };
  }, [period, year, month]);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["report-invoices", accountId, dateRange.from.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("*, business_clients(name)")
        .eq("account_id", accountId)
        .gte("issue_date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("issue_date", format(dateRange.to, "yyyy-MM-dd"))
        .order("issue_date", { ascending: false });
      return data || [];
    },
    enabled: !!accountId,
  });

  const stats = useMemo(() => {
    const inc = invoices.filter((i: any) => i.type === "INVOICE");
    const exp = invoices.filter((i: any) => i.type === "EXPENSE");
    const byStatus: Record<string, number> = {};
    invoices.forEach((i: any) => { byStatus[i.status] = (byStatus[i.status] || 0) + 1; });

    const byClient: Record<string, { name: string; total: number; count: number }> = {};
    inc.forEach((i: any) => {
      const name = (i as any).business_clients?.name || "Desconocido";
      if (!byClient[i.client_id]) byClient[i.client_id] = { name, total: 0, count: 0 };
      byClient[i.client_id].total += Number(i.amount_total);
      byClient[i.client_id].count += 1;
    });

    return {
      totalIncome: inc.reduce((s: number, i: any) => s + Number(i.amount_total), 0),
      totalExpense: exp.reduce((s: number, i: any) => s + Number(i.amount_total), 0),
      invoiceCount: inc.length,
      expenseCount: exp.length,
      byStatus,
      topClients: Object.values(byClient).sort((a, b) => b.total - a.total).slice(0, 5),
    };
  }, [invoices]);

  const statusLabels: Record<string, string> = {
    DRAFT: "Borrador", SENT: "Enviada", PAID: "Pagada", CANCELLED: "Anulada",
  };

  const exportCSV = () => {
    const rows = [
      ["Nº", "Tipo", "Cliente", "Fecha", "Neto", "IVA", "Total", "Estado"],
      ...invoices.map((i: any) => [
        i.invoice_number || "", i.type, (i as any).business_clients?.name || "",
        i.issue_date, Number(i.amount_net).toFixed(2),
        Number(i.amount_vat).toFixed(2), Number(i.amount_total).toFixed(2), i.status,
      ]),
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Facturas_${format(dateRange.from, "yyyy-MM-dd")}_${format(dateRange.to, "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Mensual</SelectItem>
            <SelectItem value="year">Anual</SelectItem>
          </SelectContent>
        </Select>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[0, 1, 2].map((i) => {
              const y = (now.getFullYear() - i).toString();
              return <SelectItem key={y} value={y}>{y}</SelectItem>;
            })}
          </SelectContent>
        </Select>
        {period === "month" && (
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>
                  {format(new Date(2024, i), "MMMM", { locale: es })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground mb-1">Facturado</div>
            <p className="text-xl font-bold text-green-600">{EUR(stats.totalIncome)}</p>
            <p className="text-xs text-muted-foreground">{stats.invoiceCount} facturas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground mb-1">Gastos</div>
            <p className="text-xl font-bold text-red-600">{EUR(stats.totalExpense)}</p>
            <p className="text-xs text-muted-foreground">{stats.expenseCount} gastos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground mb-1">Balance</div>
            <p className={`text-xl font-bold ${stats.totalIncome - stats.totalExpense >= 0 ? "text-green-600" : "text-destructive"}`}>
              {EUR(stats.totalIncome - stats.totalExpense)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground mb-1">Por estado</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(stats.byStatus).map(([status, count]) => (
                <Badge key={status} variant="secondary" className="text-xs">
                  {statusLabels[status] || status}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {stats.topClients.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Top clientes por facturación</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-center">Facturas</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.topClients.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-center">{c.count}</TableCell>
                    <TableCell className="text-right font-medium">{EUR(c.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ─── MAIN REPORTS PAGE ──────────────────────────────────
const AppReports = () => {
  const { accountId, role } = useAuth();
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const effectiveAccountId = selectedAccount || accountId;

  if (role === "MASTER_ADMIN" && !effectiveAccountId) {
    return <MasterAccountSelector onSelect={setSelectedAccount} />;
  }

  if (!effectiveAccountId) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> Informes
        </h1>
        {role === "MASTER_ADMIN" && selectedAccount && (
          <Button variant="outline" size="sm" onClick={() => setSelectedAccount(null)}>
            Cambiar cuenta
          </Button>
        )}
      </div>

      <Tabs defaultValue="pl" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="pl" className="gap-2">
            <TrendingUp className="h-4 w-4" /> PyG
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-2">
            <FileText className="h-4 w-4" /> Facturación
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2">
            <Clock className="h-4 w-4" /> Asistencia
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2">
            <Package className="h-4 w-4" /> Inventario
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pl">
          <PLReport accountId={effectiveAccountId} />
        </TabsContent>
        <TabsContent value="invoices">
          <InvoiceSummaryReport accountId={effectiveAccountId} />
        </TabsContent>
        <TabsContent value="attendance">
          <AttendanceReport accountId={effectiveAccountId} />
        </TabsContent>
        <TabsContent value="inventory">
          <InventoryReport accountId={effectiveAccountId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AppReports;
