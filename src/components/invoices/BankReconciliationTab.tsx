import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import PaginationControls from "@/components/shared/PaginationControls";
import { useServerPagination } from "@/hooks/use-server-pagination";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Upload, Trash2, Link2, Unlink, Search, FileSpreadsheet,
  CheckCircle2, Clock, TrendingUp, Percent, AlertTriangle, X,
} from "lucide-react";

// ── CSV Parser ──────────────────────────────────────────────────────
function parseCSV(text: string, skipRows = 0): Record<string, string>[] {
  const allLines = text.split(/\r?\n/);
  const lines = allLines.slice(skipRows).filter((l) => l.trim());
  if (lines.length < 2) return [];
  // detect separator
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.replace(/"/g, "").trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const vals = line.split(sep).map((v) => v.replace(/"/g, "").trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = vals[i] || ""));
    return obj;
  });
}

function getRawLines(text: string): string[] {
  return text.split(/\r?\n/);
}

function normalizeAmount(raw: string): number | null {
  if (!raw) return null;
  // handle "1.234,56" (ES) and "1,234.56" (EN)
  let cleaned = raw.replace(/[^\d.,-]/g, "");
  if (cleaned.includes(",") && cleaned.includes(".")) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(",")) {
    cleaned = cleaned.replace(",", ".");
  }
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function normalizeDate(raw: string): string | null {
  if (!raw) return null;
  // DD/MM/YYYY
  const dmy = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  // YYYY-MM-DD
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return raw;
  return null;
}

// ── Column mapping heuristics ───────────────────────────────────────
function guessColumn(headers: string[], keywords: string[]): string | undefined {
  return headers.find((h) => keywords.some((k) => h.includes(k)));
}

// ── Component ───────────────────────────────────────────────────────
const BankReconciliationTab = () => {
  const { accountId, user, role } = useAuth();
  const queryClient = useQueryClient();
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";
  const fileRef = useRef<HTMLInputElement>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [reconFilter, setReconFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL"); // INVOICE | EXPENSE
  const [fileFilter, setFileFilter] = useState<string>("ALL");

  // UI state
  const [uploading, setUploading] = useState(false);
  const [deleteFile, setDeleteFile] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [matchDialog, setMatchDialog] = useState<any>(null);
  const [matchSearch, setMatchSearch] = useState("");
  const [matchingId, setMatchingId] = useState<string | null>(null);
  const [unmatchDialog, setUnmatchDialog] = useState<any>(null);

  // CSV preview state
  const [csvPreview, setCsvPreview] = useState<{ rows: Record<string, string>[]; fileName: string } | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const pagination = useServerPagination();

  // ── Queries ─────────────────────────────────────────────────────────
  // Bank transactions with their matches
  const { data: txResult, isLoading } = useQuery({
    queryKey: ["bank-transactions", accountId, pagination.currentPage, pagination.pageSize, debouncedSearch, reconFilter, fileFilter],
    queryFn: async () => {
      if (!accountId) return { data: [], count: 0 };
      let query = supabase
        .from("bank_transactions")
        .select("*, reconciliation_matches(id, invoice_id, match_type, confidence, invoices:invoice_id(invoice_number, concept, amount_total, type, status, business_clients(name)))", { count: "exact" })
        .eq("account_id", accountId)
        .order("transaction_date", { ascending: false });

      if (debouncedSearch) {
        query = query.or(`description.ilike.%${debouncedSearch}%,reference.ilike.%${debouncedSearch}%`);
      }
      if (reconFilter === "RECONCILED") query = query.eq("is_reconciled", true);
      if (reconFilter === "PENDING") query = query.eq("is_reconciled", false);
      if (fileFilter !== "ALL") query = query.eq("source_file", fileFilter);

      query = query.range(pagination.rangeFrom, pagination.rangeTo);
      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    enabled: !!accountId,
  });

  useEffect(() => {
    if (txResult) pagination.setTotalItems(txResult.count);
  }, [txResult?.count]);

  const transactions = txResult?.data || [];

  // Source files list
  const { data: sourceFiles = [] } = useQuery({
    queryKey: ["bank-source-files", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("bank_transactions")
        .select("source_file")
        .eq("account_id", accountId)
        .not("source_file", "is", null);
      if (error) throw error;
      const unique = [...new Set((data || []).map((d: any) => d.source_file).filter(Boolean))];
      return unique as string[];
    },
    enabled: !!accountId,
  });

  // KPIs
  const { data: kpis } = useQuery({
    queryKey: ["bank-reconciliation-kpis", accountId],
    queryFn: async () => {
      if (!accountId) return null;
      const { data: allTx, error: e1 } = await supabase
        .from("bank_transactions")
        .select("amount, is_reconciled")
        .eq("account_id", accountId);
      if (e1) throw e1;
      const rows = allTx || [];
      const total = rows.length;
      const reconciled = rows.filter((r: any) => r.is_reconciled).length;
      const reconciledAmount = rows.filter((r: any) => r.is_reconciled).reduce((s: number, r: any) => s + Math.abs(Number(r.amount)), 0);
      const pendingAmount = rows.filter((r: any) => !r.is_reconciled).reduce((s: number, r: any) => s + Math.abs(Number(r.amount)), 0);
      return {
        total,
        reconciled,
        pending: total - reconciled,
        percentReconciled: total > 0 ? Math.round((reconciled / total) * 100) : 0,
        reconciledAmount,
        pendingAmount,
      };
    },
    enabled: !!accountId,
  });

  // Invoices for manual matching
  const { data: matchableInvoices = [] } = useQuery({
    queryKey: ["matchable-invoices", accountId, matchSearch, matchDialog?.amount],
    queryFn: async () => {
      if (!accountId || !matchDialog) return [];
      let query = supabase
        .from("invoices")
        .select("id, invoice_number, concept, amount_total, type, status, issue_date, paid_at, business_clients(name)")
        .eq("account_id", accountId)
        .neq("type", "QUOTE")
        .order("issue_date", { ascending: false })
        .limit(50);

      if (matchSearch) {
        query = query.or(`concept.ilike.%${matchSearch}%,invoice_number.ilike.%${matchSearch}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId && !!matchDialog,
  });

  // ── Handlers ────────────────────────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length === 0) {
      toast({ title: "Error", description: "El CSV no contiene datos válidos", variant: "destructive" });
      return;
    }
    const headers = Object.keys(rows[0]);
    const mapping: Record<string, string> = {
      date: guessColumn(headers, ["fecha", "date", "f.operación", "f.valor", "fecha operación", "fecha valor"]) || "",
      valueDate: guessColumn(headers, ["f.valor", "fecha valor", "value_date", "value date"]) || "",
      description: guessColumn(headers, ["concepto", "descripción", "description", "movimiento", "detalle"]) || "",
      amount: guessColumn(headers, ["importe", "amount", "cantidad", "monto"]) || "",
      balance: guessColumn(headers, ["saldo", "balance", "disponible"]) || "",
      reference: guessColumn(headers, ["referencia", "reference", "ref"]) || "",
    };
    setColumnMapping(mapping);
    setCsvPreview({ rows, fileName: file.name });
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleConfirmImport = async () => {
    if (!csvPreview || !accountId || !user) return;
    setUploading(true);
    try {
      const { rows, fileName } = csvPreview;
      const mapped = rows
        .map((row) => {
          const dateRaw = columnMapping.date ? row[columnMapping.date] : "";
          const txDate = normalizeDate(dateRaw);
          const amountRaw = columnMapping.amount ? row[columnMapping.amount] : "";
          const amt = normalizeAmount(amountRaw);
          if (!txDate || amt === null) return null;
          return {
            account_id: accountId,
            transaction_date: txDate,
            value_date: columnMapping.valueDate ? normalizeDate(row[columnMapping.valueDate]) : null,
            description: columnMapping.description ? row[columnMapping.description] : "",
            amount: amt,
            balance: columnMapping.balance ? normalizeAmount(row[columnMapping.balance]) : null,
            reference: columnMapping.reference ? row[columnMapping.reference] : null,
            source_file: fileName,
            uploaded_by: user.id,
          };
        })
        .filter(Boolean);

      if (mapped.length === 0) {
        toast({ title: "Error", description: "No se pudieron procesar transacciones válidas del CSV", variant: "destructive" });
        setUploading(false);
        return;
      }

      const { error } = await supabase.from("bank_transactions").insert(mapped as any);
      if (error) throw error;

      toast({ title: "CSV importado", description: `${mapped.length} transacciones importadas de "${fileName}"` });
      setCsvPreview(null);
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bank-source-files"] });
      queryClient.invalidateQueries({ queryKey: ["bank-reconciliation-kpis"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async () => {
    if (!deleteFile || !accountId) return;
    setDeleting(true);
    try {
      // Delete matches first, then transactions
      const { data: txIds } = await supabase
        .from("bank_transactions")
        .select("id")
        .eq("account_id", accountId)
        .eq("source_file", deleteFile);

      if (txIds && txIds.length > 0) {
        const ids = txIds.map((t: any) => t.id);
        await supabase.from("reconciliation_matches").delete().in("bank_transaction_id", ids);
      }

      const { error } = await supabase
        .from("bank_transactions")
        .delete()
        .eq("account_id", accountId)
        .eq("source_file", deleteFile);
      if (error) throw error;

      toast({ title: "Archivo eliminado", description: `Todas las transacciones de "${deleteFile}" han sido eliminadas` });
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bank-source-files"] });
      queryClient.invalidateQueries({ queryKey: ["bank-reconciliation-kpis"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteFile(null);
    }
  };

  const handleAutoMatch = async () => {
    if (!accountId || !user) return;
    try {
      // Get unreconciled transactions
      const { data: unrecon } = await supabase
        .from("bank_transactions")
        .select("id, amount, transaction_date")
        .eq("account_id", accountId)
        .eq("is_reconciled", false);

      if (!unrecon || unrecon.length === 0) {
        toast({ title: "Sin transacciones pendientes", description: "No hay transacciones sin conciliar" });
        return;
      }

      // Get paid invoices/expenses
      const { data: paidInvoices } = await supabase
        .from("invoices")
        .select("id, amount_total, paid_at, type, invoice_number")
        .eq("account_id", accountId)
        .eq("status", "PAID")
        .neq("type", "QUOTE");

      if (!paidInvoices || paidInvoices.length === 0) {
        toast({ title: "Sin facturas pagadas", description: "No hay facturas pagadas para conciliar" });
        return;
      }

      // Get already matched invoice IDs
      const { data: existingMatches } = await supabase
        .from("reconciliation_matches")
        .select("invoice_id")
        .eq("account_id", accountId);

      const matchedInvoiceIds = new Set((existingMatches || []).map((m: any) => m.invoice_id));

      let matchCount = 0;
      const newMatches: any[] = [];
      const reconTxIds: string[] = [];

      for (const tx of unrecon) {
        const txAmount = Math.abs(Number(tx.amount));
        // Find matching invoice by amount (within 0.01 tolerance)
        const match = paidInvoices.find((inv) => {
          if (matchedInvoiceIds.has(inv.id)) return false;
          const invAmount = Math.abs(Number(inv.amount_total));
          return Math.abs(txAmount - invAmount) < 0.02;
        });

        if (match) {
          newMatches.push({
            account_id: accountId,
            bank_transaction_id: tx.id,
            invoice_id: match.id,
            match_type: "AUTO",
            confidence: 90,
            matched_by: user.id,
          });
          reconTxIds.push(tx.id);
          matchedInvoiceIds.add(match.id);
          matchCount++;
        }
      }

      if (newMatches.length > 0) {
        const { error: e1 } = await supabase.from("reconciliation_matches").insert(newMatches);
        if (e1) throw e1;
        const { error: e2 } = await supabase
          .from("bank_transactions")
          .update({ is_reconciled: true })
          .in("id", reconTxIds);
        if (e2) throw e2;
      }

      toast({
        title: "Conciliación automática",
        description: matchCount > 0
          ? `${matchCount} transacciones conciliadas automáticamente`
          : "No se encontraron coincidencias automáticas",
      });
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bank-reconciliation-kpis"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleManualMatch = async (invoiceId: string) => {
    if (!matchDialog || !accountId || !user) return;
    setMatchingId(invoiceId);
    try {
      const { error: e1 } = await supabase.from("reconciliation_matches").insert({
        account_id: accountId,
        bank_transaction_id: matchDialog.id,
        invoice_id: invoiceId,
        match_type: "MANUAL",
        confidence: 100,
        matched_by: user.id,
      } as any);
      if (e1) throw e1;

      const { error: e2 } = await supabase
        .from("bank_transactions")
        .update({ is_reconciled: true })
        .eq("id", matchDialog.id);
      if (e2) throw e2;

      toast({ title: "Conciliación manual realizada" });
      setMatchDialog(null);
      setMatchSearch("");
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bank-reconciliation-kpis"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setMatchingId(null);
    }
  };

  const handleUnmatch = async () => {
    if (!unmatchDialog || !accountId) return;
    try {
      const matchId = unmatchDialog.reconciliation_matches?.[0]?.id;
      if (matchId) {
        const { error: e1 } = await supabase.from("reconciliation_matches").delete().eq("id", matchId);
        if (e1) throw e1;
      }
      const { error: e2 } = await supabase
        .from("bank_transactions")
        .update({ is_reconciled: false })
        .eq("id", unmatchDialog.id);
      if (e2) throw e2;

      toast({ title: "Conciliación deshecha" });
      setUnmatchDialog(null);
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bank-reconciliation-kpis"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const fmtAmount = (n: number) =>
    `€${Math.abs(n).toLocaleString("es-ES", { minimumFractionDigits: 2 })}`;

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">% Conciliado</CardTitle>
            <Percent className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{kpis?.percentReconciled ?? 0}%</p>
            <p className="text-xs text-muted-foreground mt-1">{kpis?.reconciled ?? 0} de {kpis?.total ?? 0} transacciones</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Importe conciliado</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{fmtAmount(kpis?.reconciledAmount ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Importe pendiente</CardTitle>
            <Clock className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{fmtAmount(kpis?.pendingAmount ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{kpis?.pending ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">transacciones sin conciliar</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="file"
          accept=".csv"
          ref={fileRef}
          className="hidden"
          onChange={handleFileSelect}
        />
        {isManager && (
          <>
            <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="h-4 w-4 mr-2" /> Importar CSV
            </Button>
            <Button variant="secondary" onClick={handleAutoMatch}>
              <Link2 className="h-4 w-4 mr-2" /> Conciliación automática
            </Button>
          </>
        )}

        {/* Source files badges */}
        {sourceFiles.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {sourceFiles.map((f) => (
              <Badge key={f} variant="outline" className="gap-1 py-1">
                <FileSpreadsheet className="h-3 w-3" />
                <span className="text-xs max-w-[120px] truncate">{f}</span>
                {isManager && (
                  <button onClick={() => setDeleteFile(f)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descripción o referencia..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); pagination.resetPage(); }}
            className="pl-9"
          />
        </div>
        <Select value={reconFilter} onValueChange={(v) => { setReconFilter(v); pagination.resetPage(); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas</SelectItem>
            <SelectItem value="RECONCILED">Conciliadas</SelectItem>
            <SelectItem value="PENDING">Pendientes</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fileFilter} onValueChange={(v) => { setFileFilter(v); pagination.resetPage(); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Archivo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los archivos</SelectItem>
            {sourceFiles.map((f) => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Importe</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Factura vinculada</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : transactions.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No hay transacciones bancarias. Importa un CSV para empezar.
                </TableCell></TableRow>
              ) : (
                transactions.map((tx: any) => {
                  const match = tx.reconciliation_matches?.[0];
                  const inv = match?.invoices;
                  const isIncome = Number(tx.amount) > 0;
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(parseISO(tx.transaction_date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[250px] truncate text-sm" title={tx.description}>
                          {tx.description || "—"}
                        </div>
                        {tx.reference && (
                          <div className="text-xs text-muted-foreground">Ref: {tx.reference}</div>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm ${isIncome ? "text-primary" : "text-destructive"}`}>
                        {isIncome ? "+" : ""}{fmtAmount(Number(tx.amount))}
                      </TableCell>
                      <TableCell>
                        {tx.is_reconciled ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Conciliada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">
                            <Clock className="h-3 w-3 mr-1" /> Pendiente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {inv ? (
                          <div className="text-sm">
                            <span className="font-mono font-medium">{inv.invoice_number}</span>
                            <span className="text-xs text-muted-foreground ml-1">
                              ({inv.type === "INVOICE" ? "Factura" : "Gasto"})
                            </span>
                            <div className="text-xs text-muted-foreground">{inv.business_clients?.name}</div>
                            <Badge variant="outline" className="text-xs mt-0.5">
                              {match.match_type === "AUTO" ? "Auto" : "Manual"}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isManager && (
                          <div className="flex gap-1 justify-end">
                            {tx.is_reconciled ? (
                              <Button size="sm" variant="ghost" onClick={() => setUnmatchDialog(tx)}>
                                <Unlink className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => { setMatchDialog(tx); setMatchSearch(""); }}>
                                <Link2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PaginationControls
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        pageSize={pagination.pageSize}
        startIndex={pagination.startIndex}
        endIndex={pagination.endIndex}
        onPageChange={pagination.setCurrentPage}
        onPageSizeChange={pagination.setPageSize}
        pageSizeOptions={pagination.pageSizeOptions}
      />

      {/* ── CSV Preview / Column Mapping Dialog ── */}
      <Dialog open={!!csvPreview} onOpenChange={() => setCsvPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mapear columnas del CSV</DialogTitle>
            <DialogDescription>
              Archivo: {csvPreview?.fileName} · {csvPreview?.rows.length} filas detectadas
            </DialogDescription>
          </DialogHeader>
          {csvPreview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "date", label: "Fecha transacción *", required: true },
                  { key: "valueDate", label: "Fecha valor" },
                  { key: "description", label: "Descripción" },
                  { key: "amount", label: "Importe *", required: true },
                  { key: "balance", label: "Saldo" },
                  { key: "reference", label: "Referencia" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-sm font-medium text-foreground">{label}</label>
                    <Select
                      value={columnMapping[key] || "__none__"}
                      onValueChange={(v) =>
                        setColumnMapping((prev) => ({ ...prev, [key]: v === "__none__" ? "" : v }))
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Sin asignar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sin asignar</SelectItem>
                        {Object.keys(csvPreview.rows[0]).filter((h) => h.trim() !== "").map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              {/* Preview rows */}
              <div className="border rounded-md overflow-auto max-h-[200px]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted">
                      {Object.keys(csvPreview.rows[0]).map((h) => (
                        <th key={h} className="p-2 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="p-2 whitespace-nowrap">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCsvPreview(null)}>Cancelar</Button>
            <Button
              onClick={handleConfirmImport}
              disabled={uploading || !columnMapping.date || !columnMapping.amount}
            >
              {uploading ? "Importando..." : `Importar ${csvPreview?.rows.length} transacciones`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manual Match Dialog ── */}
      <Dialog open={!!matchDialog} onOpenChange={() => setMatchDialog(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Conciliación manual</DialogTitle>
            <DialogDescription>
              Transacción: {matchDialog?.description} · {matchDialog && fmtAmount(Number(matchDialog.amount))}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar factura..."
                value={matchSearch}
                onChange={(e) => setMatchSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-[300px] overflow-auto space-y-2">
              {matchableInvoices.map((inv: any) => {
                const amountDiff = Math.abs(Math.abs(Number(matchDialog?.amount)) - Number(inv.amount_total));
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleManualMatch(inv.id)}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{inv.invoice_number}</span>
                        <Badge variant="outline" className="text-xs">
                          {inv.type === "INVOICE" ? "Factura" : "Gasto"}
                        </Badge>
                        <Badge variant={inv.status === "PAID" ? "default" : "secondary"} className="text-xs">
                          {inv.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {inv.business_clients?.name} · {inv.concept}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold">{fmtAmount(Number(inv.amount_total))}</div>
                      {amountDiff < 0.02 ? (
                        <span className="text-xs text-green-600">✓ Importe coincide</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Dif: {fmtAmount(amountDiff)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {matchableInvoices.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No se encontraron facturas</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Unmatch Confirmation ── */}
      <AlertDialog open={!!unmatchDialog} onOpenChange={() => setUnmatchDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Deshacer conciliación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la vinculación entre esta transacción bancaria y la factura asociada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnmatch}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete File Confirmation ── */}
      <AlertDialog open={!!deleteFile} onOpenChange={() => setDeleteFile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar archivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán todas las transacciones y conciliaciones del archivo &ldquo;{deleteFile}&rdquo;. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFile} disabled={deleting}>
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BankReconciliationTab;
