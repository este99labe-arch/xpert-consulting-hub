import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableRow,
} from "@/components/ui/table";
import { Download } from "lucide-react";
import { ChartAccount, JournalEntryLine, EUR } from "./types";

interface PLTabProps {
  chartAccounts: ChartAccount[];
  postedLines: JournalEntryLine[];
}

const PLTab = ({ chartAccounts, postedLines }: PLTabProps) => {
  const [plPeriod, setPlPeriod] = useState("YEAR");
  const [plYear, setPlYear] = useState(String(new Date().getFullYear()));
  const [plQuarter, setPlQuarter] = useState(String(Math.ceil((new Date().getMonth() + 1) / 3)));

  const plDateRange = useMemo(() => {
    const y = Number(plYear);
    if (plPeriod === "YEAR") return { from: `${y}-01-01`, to: `${y}-12-31` };
    const q = Number(plQuarter);
    const from = `${y}-${String((q - 1) * 3 + 1).padStart(2, "0")}-01`;
    const endDates: Record<number, string> = { 1: `${y}-03-31`, 2: `${y}-06-30`, 3: `${y}-09-30`, 4: `${y}-12-31` };
    return { from, to: endDates[q] || `${y}-12-31` };
  }, [plPeriod, plYear, plQuarter]);

  const plData = useMemo(() => {
    const inRange = postedLines.filter(l => {
      const d = l.journal_entries?.date || "";
      return d >= plDateRange.from && d <= plDateRange.to;
    });
    const incomeAccounts = chartAccounts.filter(c => c.type === "INCOME");
    const expenseAccounts = chartAccounts.filter(c => c.type === "EXPENSE");
    const incomeBreakdown = incomeAccounts.map(ca => {
      const total = inRange.filter(l => l.chart_account_id === ca.id).reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0);
      return { code: ca.code, name: ca.name, total };
    }).filter(x => x.total !== 0);
    const expenseBreakdown = expenseAccounts.map(ca => {
      const total = inRange.filter(l => l.chart_account_id === ca.id).reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
      return { code: ca.code, name: ca.name, total };
    }).filter(x => x.total !== 0);
    const totalInc = incomeBreakdown.reduce((s, x) => s + x.total, 0);
    const totalExp = expenseBreakdown.reduce((s, x) => s + x.total, 0);
    return { incomeBreakdown, expenseBreakdown, totalIncome: totalInc, totalExpense: totalExp, result: totalInc - totalExp };
  }, [postedLines, chartAccounts, plDateRange]);

  const exportCSV = () => {
    let csv = "Tipo,Código,Cuenta,Importe\n";
    plData.incomeBreakdown.forEach(r => { csv += `Ingreso,${r.code},"${r.name}",${r.total}\n`; });
    csv += `Ingreso,,TOTAL INGRESOS,${plData.totalIncome}\n`;
    plData.expenseBreakdown.forEach(r => { csv += `Gasto,${r.code},"${r.name}",${r.total}\n`; });
    csv += `Gasto,,TOTAL GASTOS,${plData.totalExpense}\n`;
    csv += `,,RESULTADO,${plData.result}\n`;
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "cuenta_resultados.csv"; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={plPeriod} onValueChange={setPlPeriod}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="YEAR">Anual</SelectItem>
            <SelectItem value="QUARTER">Trimestral</SelectItem>
          </SelectContent>
        </Select>
        <Select value={plYear} onValueChange={setPlYear}>
          <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        {plPeriod === "QUARTER" && (
          <Select value={plQuarter} onValueChange={setPlQuarter}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">T1</SelectItem>
              <SelectItem value="2">T2</SelectItem>
              <SelectItem value="3">T3</SelectItem>
              <SelectItem value="4">T4</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="mr-1 h-4 w-4" /> CSV
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base text-primary">Ingresos</CardTitle>
          </CardHeader>
          <Table>
            <TableBody>
              {plData.incomeBreakdown.map(r => (
                <TableRow key={r.code}>
                  <TableCell className="font-mono w-16">{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right font-mono">{EUR(r.total)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold border-t-2">
                <TableCell colSpan={2}>TOTAL INGRESOS</TableCell>
                <TableCell className="text-right font-mono text-primary">{EUR(plData.totalIncome)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base text-destructive">Gastos</CardTitle>
          </CardHeader>
          <Table>
            <TableBody>
              {plData.expenseBreakdown.map(r => (
                <TableRow key={r.code}>
                  <TableCell className="font-mono w-16">{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right font-mono">{EUR(r.total)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold border-t-2">
                <TableCell colSpan={2}>TOTAL GASTOS</TableCell>
                <TableCell className="text-right font-mono text-destructive">{EUR(plData.totalExpense)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </div>

      <Card>
        <CardContent className="py-6 flex justify-between items-center">
          <span className="text-lg font-bold">Resultado del periodo</span>
          <span className={`text-2xl font-bold font-mono ${plData.result >= 0 ? "" : "text-destructive"}`}>
            {EUR(plData.result)}
          </span>
        </CardContent>
      </Card>
    </div>
  );
};

export default PLTab;
