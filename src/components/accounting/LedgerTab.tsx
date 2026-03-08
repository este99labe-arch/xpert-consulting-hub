import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download } from "lucide-react";
import { format, startOfYear, endOfYear } from "date-fns";
import { ChartAccount, JournalEntryLine, EUR } from "./types";

interface LedgerTabProps {
  chartAccounts: ChartAccount[];
  allLines: JournalEntryLine[];
}

const LedgerTab = ({ chartAccounts, allLines }: LedgerTabProps) => {
  const [ledgerAccountId, setLedgerAccountId] = useState("");
  const [ledgerDateFrom, setLedgerDateFrom] = useState(format(startOfYear(new Date()), "yyyy-MM-dd"));
  const [ledgerDateTo, setLedgerDateTo] = useState(format(endOfYear(new Date()), "yyyy-MM-dd"));

  const ledgerLines = useMemo(() => {
    if (!ledgerAccountId) return [];
    return allLines
      .filter(l => l.chart_account_id === ledgerAccountId && l.journal_entries?.status === "POSTED")
      .filter(l => {
        const d = l.journal_entries?.date || "";
        return d >= ledgerDateFrom && d <= ledgerDateTo;
      })
      .sort((a, b) => (a.journal_entries?.date || "").localeCompare(b.journal_entries?.date || ""));
  }, [allLines, ledgerAccountId, ledgerDateFrom, ledgerDateTo]);

  const ledgerWithBalance = useMemo(() => {
    let balance = 0;
    return ledgerLines.map(l => {
      balance += Number(l.debit) - Number(l.credit);
      return { ...l, balance };
    });
  }, [ledgerLines]);

  const exportCSV = () => {
    const acc = chartAccounts.find(c => c.id === ledgerAccountId);
    const header = "Fecha,Nº Asiento,Descripción,Debe,Haber,Saldo\n";
    const rows = ledgerWithBalance.map(l =>
      `"${l.journal_entries?.date}","${l.journal_entries?.entry_number}","${l.journal_entries?.description}",${l.debit},${l.credit},${l.balance}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `libro_mayor_${acc?.code || ""}.csv`; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={ledgerAccountId} onValueChange={setLedgerAccountId}>
          <SelectTrigger className="w-[300px]"><SelectValue placeholder="Seleccionar cuenta..." /></SelectTrigger>
          <SelectContent>
            {chartAccounts.filter(c => c.is_active).map(c => (
              <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" className="w-[160px]" value={ledgerDateFrom} onChange={e => setLedgerDateFrom(e.target.value)} />
        <Input type="date" className="w-[160px]" value={ledgerDateTo} onChange={e => setLedgerDateTo(e.target.value)} />
        {ledgerAccountId && (
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-1 h-4 w-4" /> CSV
          </Button>
        )}
      </div>

      {ledgerAccountId ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Fecha</TableHead>
                <TableHead className="w-32">Nº Asiento</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right w-28">Debe</TableHead>
                <TableHead className="text-right w-28">Haber</TableHead>
                <TableHead className="text-right w-32">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgerWithBalance.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin movimientos</TableCell></TableRow>
              ) : ledgerWithBalance.map(l => (
                <TableRow key={l.id}>
                  <TableCell>{l.journal_entries?.date ? format(new Date(l.journal_entries.date), "dd/MM/yyyy") : ""}</TableCell>
                  <TableCell className="font-mono text-sm">{l.journal_entries?.entry_number}</TableCell>
                  <TableCell className="max-w-[250px] truncate">{l.journal_entries?.description}</TableCell>
                  <TableCell className="text-right font-mono">{Number(l.debit) > 0 ? EUR(Number(l.debit)) : ""}</TableCell>
                  <TableCell className="text-right font-mono">{Number(l.credit) > 0 ? EUR(Number(l.credit)) : ""}</TableCell>
                  <TableCell className={`text-right font-mono font-medium ${l.balance >= 0 ? "" : "text-destructive"}`}>{EUR(l.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Selecciona una cuenta para ver su libro mayor</CardContent></Card>
      )}
    </div>
  );
};

export default LedgerTab;
