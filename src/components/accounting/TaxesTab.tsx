import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, BookText, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { EUR } from "./types";

interface TaxesTabProps {
  invoices: any[];
  accountId?: string;
}

const TaxesTab = ({ invoices, accountId }: TaxesTabProps) => {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";
  const [taxYear, setTaxYear] = useState(String(new Date().getFullYear()));
  const [taxQuarter, setTaxQuarter] = useState(String(Math.ceil((new Date().getMonth() + 1) / 3)));

  const taxData = useMemo(() => {
    const y = Number(taxYear);
    const q = Number(taxQuarter);
    const endDates: Record<number, string> = { 1: `${y}-03-31`, 2: `${y}-06-30`, 3: `${y}-09-30`, 4: `${y}-12-31` };
    const from = `${y}-${String((q - 1) * 3 + 1).padStart(2, "0")}-01`;
    const to = endDates[q];
    const qInvoices = invoices.filter((inv: any) => inv.issue_date >= from && inv.issue_date <= to);
    const vatRates = [0, 4, 10, 21];
    const collected: { rate: number; base: number; vat: number }[] = [];
    const paid: { rate: number; base: number; vat: number }[] = [];
    for (const rate of vatRates) {
      const salesAtRate = qInvoices.filter((inv: any) => inv.type === "INVOICE" && Number(inv.vat_percentage) === rate);
      const purchasesAtRate = qInvoices.filter((inv: any) => inv.type === "EXPENSE" && Number(inv.vat_percentage) === rate);
      const sBase = salesAtRate.reduce((s: number, inv: any) => s + Number(inv.amount_net), 0);
      const sVat = salesAtRate.reduce((s: number, inv: any) => s + Number(inv.amount_vat), 0);
      const pBase = purchasesAtRate.reduce((s: number, inv: any) => s + Number(inv.amount_net), 0);
      const pVat = purchasesAtRate.reduce((s: number, inv: any) => s + Number(inv.amount_vat), 0);
      if (sBase > 0 || sVat > 0) collected.push({ rate, base: sBase, vat: sVat });
      if (pBase > 0 || pVat > 0) paid.push({ rate, base: pBase, vat: pVat });
    }
    const totalCollected = collected.reduce((s, r) => s + r.vat, 0);
    const totalPaid = paid.reduce((s, r) => s + r.vat, 0);
    return { collected, paid, totalCollected, totalPaid, result: totalCollected - totalPaid };
  }, [invoices, taxYear, taxQuarter]);

  // Asiento de regularización del IVA del trimestre (modelo 303):
  // cierra 477 (debe) y 472 (haber); la diferencia va a 4750 (a ingresar) o 4700 (a compensar).
  const settle = useMutation({
    mutationFn: async () => {
      if (!accountId || !user) throw new Error("Sesión no válida");
      const y = Number(taxYear); const q = Number(taxQuarter);
      const desc = `Liquidación IVA T${q} ${y}`;
      const { collected, paid, totalCollected, totalPaid } = taxData;
      if (collected.length === 0 && paid.length === 0) throw new Error("No hay IVA en este periodo");

      const { data: existing } = await supabase
        .from("journal_entries").select("id")
        .eq("account_id", accountId).eq("description", desc).maybeSingle();
      if (existing) throw new Error("Ya existe el asiento de liquidación de este trimestre");

      const { data: accs } = await supabase
        .from("chart_of_accounts").select("id, code")
        .eq("account_id", accountId).in("code", ["477", "472", "4750", "4700"]);
      const byCode = new Map((accs || []).map((a: any) => [a.code, a.id]));
      if (!byCode.get("477") || !byCode.get("472")) throw new Error("Faltan las cuentas 477/472 en el plan contable");

      const endDates: Record<number, string> = { 1: `${y}-03-31`, 2: `${y}-06-30`, 3: `${y}-09-30`, 4: `${y}-12-31` };
      const { data: entry, error } = await supabase.from("journal_entries").insert({
        account_id: accountId, date: endDates[q], description: desc,
        status: "POSTED", created_by: user.id,
      }).select("id").single();
      if (error) throw error;

      const lines: any[] = [];
      if (totalCollected > 0) lines.push({ entry_id: entry.id, chart_account_id: byCode.get("477"), debit: totalCollected, credit: 0, description: "Regularización IVA repercutido" });
      if (totalPaid > 0) lines.push({ entry_id: entry.id, chart_account_id: byCode.get("472"), debit: 0, credit: totalPaid, description: "Regularización IVA soportado" });
      const diff = +(totalCollected - totalPaid).toFixed(2);
      if (diff > 0) {
        if (!byCode.get("4750")) throw new Error("Falta la cuenta 4750 en el plan contable");
        lines.push({ entry_id: entry.id, chart_account_id: byCode.get("4750"), debit: 0, credit: diff, description: "H.P. acreedora por IVA (a ingresar)" });
      } else if (diff < 0) {
        if (!byCode.get("4700")) throw new Error("Falta la cuenta 4700 en el plan contable");
        lines.push({ entry_id: entry.id, chart_account_id: byCode.get("4700"), debit: -diff, credit: 0, description: "H.P. deudora por IVA (a compensar)" });
      }
      const { error: lineErr } = await supabase.from("journal_entry_lines").insert(lines);
      if (lineErr) throw lineErr;
    },
    onSuccess: () => {
      toast({ title: "Liquidación contabilizada", description: `Asiento de regularización T${taxQuarter} ${taxYear} creado.` });
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      qc.invalidateQueries({ queryKey: ["journal-entry-lines"] });
    },
    onError: (e: any) => toast({ title: "No se pudo contabilizar", description: e.message, variant: "destructive" }),
  });

  const exportCSV = () => {
    let csv = "Concepto,Tipo IVA,Base Imponible,Cuota IVA\n";
    taxData.collected.forEach(r => { csv += `IVA Repercutido,${r.rate}%,${r.base},${r.vat}\n`; });
    csv += `TOTAL IVA Repercutido,,,${taxData.totalCollected}\n`;
    taxData.paid.forEach(r => { csv += `IVA Soportado,${r.rate}%,${r.base},${r.vat}\n`; });
    csv += `TOTAL IVA Soportado,,,${taxData.totalPaid}\n`;
    csv += `RESULTADO,,,${taxData.result}\n`;
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `iva_T${taxQuarter}_${taxYear}.csv`; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={taxYear} onValueChange={setTaxYear}>
          <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={taxQuarter} onValueChange={setTaxQuarter}>
          <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">T1 (Ene-Mar)</SelectItem>
            <SelectItem value="2">T2 (Abr-Jun)</SelectItem>
            <SelectItem value="3">T3 (Jul-Sep)</SelectItem>
            <SelectItem value="4">T4 (Oct-Dic)</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="mr-1 h-4 w-4" /> CSV (Modelo 303)
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base">IVA Repercutido (Ventas)</CardTitle></CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Base Imponible</TableHead>
                <TableHead className="text-right">Cuota IVA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxData.collected.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sin ventas en este periodo</TableCell></TableRow>
              ) : (
                <>
                  {taxData.collected.map(r => (
                    <TableRow key={r.rate}>
                      <TableCell>{r.rate}%</TableCell>
                      <TableCell className="text-right font-mono">{EUR(r.base)}</TableCell>
                      <TableCell className="text-right font-mono">{EUR(r.vat)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right font-mono">{EUR(taxData.collected.reduce((s, r) => s + r.base, 0))}</TableCell>
                    <TableCell className="text-right font-mono">{EUR(taxData.totalCollected)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </Card>
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base">IVA Soportado (Compras)</CardTitle></CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Base Imponible</TableHead>
                <TableHead className="text-right">Cuota IVA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxData.paid.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sin compras en este periodo</TableCell></TableRow>
              ) : (
                <>
                  {taxData.paid.map(r => (
                    <TableRow key={r.rate}>
                      <TableCell>{r.rate}%</TableCell>
                      <TableCell className="text-right font-mono">{EUR(r.base)}</TableCell>
                      <TableCell className="text-right font-mono">{EUR(r.vat)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right font-mono">{EUR(taxData.paid.reduce((s, r) => s + r.base, 0))}</TableCell>
                    <TableCell className="text-right font-mono">{EUR(taxData.totalPaid)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Card>
        <CardContent className="py-6 flex justify-between items-center">
          <div>
            <span className="text-lg font-bold">Resultado liquidación IVA</span>
            <p className="text-sm text-muted-foreground">
              {taxData.result >= 0 ? "A ingresar en Hacienda" : "A compensar / devolver"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-2xl font-bold font-mono ${taxData.result >= 0 ? "text-destructive" : ""}`}>
              {EUR(Math.abs(taxData.result))}
            </span>
            {isManager && accountId && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => settle.mutate()} disabled={settle.isPending}>
                {settle.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookText className="h-3.5 w-3.5" />}
                Contabilizar liquidación T{taxQuarter} {taxYear}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TaxesTab;
