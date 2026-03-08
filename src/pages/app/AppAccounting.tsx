import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart3, BookOpen, FileText, Calculator, TrendingUp, TrendingDown,
  Search, Plus, Download, Link, Pencil, Trash2, MoreHorizontal, Check, X, Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

// ---- Types ----
interface ChartAccount {
  id: string; account_id: string; code: string; name: string; type: string; parent_id: string | null; is_active: boolean;
}
interface JournalEntry {
  id: string; account_id: string; entry_number: string; date: string; description: string;
  invoice_id: string | null; status: string; created_by: string; created_at: string;
}
interface JournalEntryLine {
  id: string; entry_id: string; chart_account_id: string; debit: number; credit: number; description: string;
  chart_of_accounts?: { code: string; name: string };
  journal_entries?: { entry_number: string; date: string; description: string; status: string; invoice_id: string | null };
}
interface DeleteRequest {
  id: string; account_id: string; entry_id: string; reason: string; requested_by: string;
  status: string; reviewed_by: string | null; reviewed_at: string | null; created_at: string;
  journal_entries?: { entry_number: string; description: string; date: string };
}

const typeLabels: Record<string, string> = {
  ASSET: "Activo", LIABILITY: "Pasivo", EQUITY: "Patrimonio", INCOME: "Ingresos", EXPENSE: "Gastos",
};
const typeColors: Record<string, string> = {
  ASSET: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  LIABILITY: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  EQUITY: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  INCOME: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  EXPENSE: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--accent))", "#f59e0b", "#8b5cf6", "#06b6d4"];
const EUR = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

type EntryFormLine = { chart_account_id: string; debit: string; credit: string };

const AppAccounting = () => {
  const { user, accountId, role } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";
  const isMaster = role === "MASTER_ADMIN";

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const activeAccountId = isMaster ? selectedAccountId : accountId;

  // ---- Master: client accounts ----
  const { data: clientAccounts = [] } = useQuery({
    queryKey: ["client-accounts"],
    queryFn: async () => {
      const { data } = await supabase.from("accounts").select("id, name").eq("type", "CLIENT").eq("is_active", true);
      return data || [];
    },
    enabled: isMaster,
  });

  // ---- Chart of Accounts ----
  const { data: chartAccounts = [] } = useQuery({
    queryKey: ["chart-of-accounts", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("chart_of_accounts").select("*").eq("account_id", activeAccountId!).order("code");
      if (error) throw error;
      return (data || []) as ChartAccount[];
    },
    enabled: !!activeAccountId,
  });

  // ---- Journal Entries ----
  const { data: entries = [] } = useQuery({
    queryKey: ["journal-entries", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("journal_entries").select("*").eq("account_id", activeAccountId!).order("date", { ascending: false });
      if (error) throw error;
      return (data || []) as JournalEntry[];
    },
    enabled: !!activeAccountId,
  });

  // ---- Journal Entry Lines (all, for calculations) ----
  const { data: allLines = [] } = useQuery({
    queryKey: ["journal-entry-lines", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entry_lines")
        .select("*, chart_of_accounts(code, name), journal_entries!inner(entry_number, date, description, status, invoice_id, account_id)")
        .eq("journal_entries.account_id", activeAccountId!)
        .order("id");
      if (error) throw error;
      return (data || []) as JournalEntryLine[];
    },
    enabled: !!activeAccountId,
  });

  // ---- Invoices (for tax tab) ----
  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices-accounting", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*").eq("account_id", activeAccountId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeAccountId,
  });

  // ---- Delete Requests ----
  const { data: deleteRequests = [] } = useQuery({
    queryKey: ["entry-delete-requests", activeAccountId],
    queryFn: async () => {
      const q = supabase
        .from("journal_entry_delete_requests")
        .select("*, journal_entries(entry_number, description, date)")
        .order("created_at", { ascending: false });
      // For non-master, RLS handles scoping. For master viewing a client, filter.
      if (isMaster && activeAccountId) {
        q.eq("account_id", activeAccountId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as DeleteRequest[];
    },
    enabled: !!activeAccountId,
  });

  const pendingDeleteRequests = useMemo(() => deleteRequests.filter(r => r.status === "PENDING"), [deleteRequests]);

  // ===== DASHBOARD KPIs =====
  const postedLines = useMemo(() => allLines.filter(l => l.journal_entries?.status === "POSTED"), [allLines]);

  const totalIncome = useMemo(() => {
    const incomeCodes = chartAccounts.filter(c => c.type === "INCOME").map(c => c.id);
    return postedLines.filter(l => incomeCodes.includes(l.chart_account_id)).reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0);
  }, [postedLines, chartAccounts]);

  const totalExpense = useMemo(() => {
    const expenseCodes = chartAccounts.filter(c => c.type === "EXPENSE").map(c => c.id);
    return postedLines.filter(l => expenseCodes.includes(l.chart_account_id)).reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
  }, [postedLines, chartAccounts]);

  const vatCollected = useMemo(() => {
    const vat477 = chartAccounts.find(c => c.code === "477");
    if (!vat477) return 0;
    return postedLines.filter(l => l.chart_account_id === vat477.id).reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0);
  }, [postedLines, chartAccounts]);

  const vatPaid = useMemo(() => {
    const vat472 = chartAccounts.find(c => c.code === "472");
    if (!vat472) return 0;
    return postedLines.filter(l => l.chart_account_id === vat472.id).reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
  }, [postedLines, chartAccounts]);

  // ---- Monthly evolution (last 12 months) ----
  const monthlyData = useMemo(() => {
    const months: { month: string; ingresos: number; gastos: number }[] = [];
    const now = new Date();
    const incomeIds = new Set(chartAccounts.filter(c => c.type === "INCOME").map(c => c.id));
    const expenseIds = new Set(chartAccounts.filter(c => c.type === "EXPENSE").map(c => c.id));
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(now, i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const monthLines = postedLines.filter(l => {
        const ld = new Date(l.journal_entries?.date || "");
        return ld >= start && ld <= end;
      });
      months.push({
        month: format(d, "MMM yy", { locale: es }),
        ingresos: monthLines.filter(l => incomeIds.has(l.chart_account_id)).reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0),
        gastos: monthLines.filter(l => expenseIds.has(l.chart_account_id)).reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0),
      });
    }
    return months;
  }, [postedLines, chartAccounts]);

  // ---- Pie chart ----
  const pieData = useMemo(() => {
    const byType: Record<string, number> = {};
    for (const ca of chartAccounts.filter(c => c.type === "EXPENSE")) {
      const total = postedLines.filter(l => l.chart_account_id === ca.id).reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
      if (total > 0) byType[ca.name] = (byType[ca.name] || 0) + total;
    }
    return Object.entries(byType).map(([name, value]) => ({ name, value }));
  }, [postedLines, chartAccounts]);

  // ===== CHART OF ACCOUNTS =====
  const [chartSearch, setChartSearch] = useState("");
  const [chartDialog, setChartDialog] = useState(false);
  const [editingChart, setEditingChart] = useState<ChartAccount | null>(null);
  const [chartForm, setChartForm] = useState({ code: "", name: "", type: "EXPENSE" });

  const filteredChart = useMemo(() => {
    if (!chartSearch) return chartAccounts;
    const q = chartSearch.toLowerCase();
    return chartAccounts.filter(c => c.code.includes(q) || c.name.toLowerCase().includes(q));
  }, [chartAccounts, chartSearch]);

  const groupedChart = useMemo(() => {
    const groups: Record<string, ChartAccount[]> = { ASSET: [], LIABILITY: [], EQUITY: [], INCOME: [], EXPENSE: [] };
    filteredChart.forEach(c => { if (groups[c.type]) groups[c.type].push(c); });
    return groups;
  }, [filteredChart]);

  const getAccountBalance = (accountId: string) => {
    return postedLines.filter(l => l.chart_account_id === accountId).reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
  };

  const saveChartAccount = useMutation({
    mutationFn: async () => {
      const payload = { account_id: activeAccountId!, code: chartForm.code, name: chartForm.name, type: chartForm.type };
      if (editingChart) {
        const { error } = await supabase.from("chart_of_accounts").update(payload).eq("id", editingChart.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("chart_of_accounts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chart-of-accounts", activeAccountId] });
      setChartDialog(false);
      toast({ title: editingChart ? "Cuenta actualizada" : "Cuenta creada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ===== JOURNAL ENTRIES =====
  const [entryFilter, setEntryFilter] = useState({ status: "ALL", search: "" });
  const [entryDialog, setEntryDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [entryForm, setEntryForm] = useState<{ date: string; description: string; lines: EntryFormLine[] }>({
    date: format(new Date(), "yyyy-MM-dd"), description: "",
    lines: [{ chart_account_id: "", debit: "", credit: "" }, { chart_account_id: "", debit: "", credit: "" }],
  });

  // Delete states
  const [deleteConfirmEntry, setDeleteConfirmEntry] = useState<JournalEntry | null>(null);
  const [deleteRequestDialog, setDeleteRequestDialog] = useState<JournalEntry | null>(null);
  const [deleteRequestReason, setDeleteRequestReason] = useState("");

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (entryFilter.status !== "ALL" && e.status !== entryFilter.status) return false;
      if (entryFilter.search && !e.entry_number?.toLowerCase().includes(entryFilter.search.toLowerCase()) && !e.description.toLowerCase().includes(entryFilter.search.toLowerCase())) return false;
      return true;
    });
  }, [entries, entryFilter]);

  const getEntryLines = (entryId: string) => allLines.filter(l => l.entry_id === entryId);

  const openCreateEntry = () => {
    setEditingEntry(null);
    setEntryForm({
      date: format(new Date(), "yyyy-MM-dd"), description: "",
      lines: [{ chart_account_id: "", debit: "", credit: "" }, { chart_account_id: "", debit: "", credit: "" }],
    });
    setEntryDialog(true);
  };

  const openEditEntry = (entry: JournalEntry) => {
    const lines = getEntryLines(entry.id);
    setEditingEntry(entry);
    setEntryForm({
      date: entry.date,
      description: entry.description,
      lines: lines.length > 0
        ? lines.map(l => ({ chart_account_id: l.chart_account_id, debit: Number(l.debit) > 0 ? String(l.debit) : "", credit: Number(l.credit) > 0 ? String(l.credit) : "" }))
        : [{ chart_account_id: "", debit: "", credit: "" }, { chart_account_id: "", debit: "", credit: "" }],
    });
    setEntryDialog(true);
  };

  const addEntryLine = () => {
    setEntryForm(prev => ({ ...prev, lines: [...prev.lines, { chart_account_id: "", debit: "", credit: "" }] }));
  };
  const updateEntryLine = (idx: number, field: string, value: string) => {
    setEntryForm(prev => {
      const lines = [...prev.lines];
      lines[idx] = { ...lines[idx], [field]: value };
      return { ...prev, lines };
    });
  };
  const removeEntryLine = (idx: number) => {
    if (entryForm.lines.length <= 2) return;
    setEntryForm(prev => ({ ...prev, lines: prev.lines.filter((_, i) => i !== idx) }));
  };

  const entryTotalDebit = entryForm.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const entryTotalCredit = entryForm.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const entryBalanced = Math.abs(entryTotalDebit - entryTotalCredit) < 0.01 && entryTotalDebit > 0;

  const saveEntry = useMutation({
    mutationFn: async () => {
      if (!entryBalanced) throw new Error("El asiento no está cuadrado");
      const validLines = entryForm.lines.filter(l => l.chart_account_id && (Number(l.debit) > 0 || Number(l.credit) > 0));
      if (validLines.length < 2) throw new Error("Se necesitan al menos 2 líneas");

      if (editingEntry) {
        // Update header
        const { error } = await supabase.from("journal_entries").update({
          date: entryForm.date, description: entryForm.description,
        }).eq("id", editingEntry.id);
        if (error) throw error;

        // Delete old lines and re-insert
        const { error: delErr } = await supabase.from("journal_entry_lines").delete().eq("entry_id", editingEntry.id);
        if (delErr) throw delErr;

        const linePayloads = validLines.map(l => ({
          entry_id: editingEntry.id, chart_account_id: l.chart_account_id,
          debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: "",
        }));
        const { error: lineErr } = await supabase.from("journal_entry_lines").insert(linePayloads);
        if (lineErr) throw lineErr;
      } else {
        // Create new
        const { data: entry, error } = await supabase.from("journal_entries").insert({
          account_id: activeAccountId!, date: entryForm.date, description: entryForm.description,
          status: "DRAFT", created_by: user!.id,
        }).select().single();
        if (error) throw error;

        const linePayloads = validLines.map(l => ({
          entry_id: entry.id, chart_account_id: l.chart_account_id,
          debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: "",
        }));
        const { error: lineErr } = await supabase.from("journal_entry_lines").insert(linePayloads);
        if (lineErr) throw lineErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal-entries", activeAccountId] });
      qc.invalidateQueries({ queryKey: ["journal-entry-lines", activeAccountId] });
      setEntryDialog(false);
      toast({ title: editingEntry ? "Asiento actualizado" : "Asiento creado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const postEntry = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase.from("journal_entries").update({ status: "POSTED" }).eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal-entries", activeAccountId] });
      qc.invalidateQueries({ queryKey: ["journal-entry-lines", activeAccountId] });
      toast({ title: "Asiento contabilizado" });
    },
  });

  // ---- Delete entry (manager direct) ----
  const deleteEntry = useMutation({
    mutationFn: async (entryId: string) => {
      // Lines cascade-delete via FK, but we delete explicitly for RLS
      const { error: lineErr } = await supabase.from("journal_entry_lines").delete().eq("entry_id", entryId);
      if (lineErr) throw lineErr;
      const { error } = await supabase.from("journal_entries").delete().eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal-entries", activeAccountId] });
      qc.invalidateQueries({ queryKey: ["journal-entry-lines", activeAccountId] });
      setDeleteConfirmEntry(null);
      toast({ title: "Asiento eliminado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ---- Delete request (employee) ----
  const createDeleteRequest = useMutation({
    mutationFn: async () => {
      if (!deleteRequestDialog) throw new Error("No entry selected");
      const { error } = await supabase.from("journal_entry_delete_requests").insert({
        account_id: activeAccountId!, entry_id: deleteRequestDialog.id,
        reason: deleteRequestReason, requested_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entry-delete-requests", activeAccountId] });
      setDeleteRequestDialog(null);
      setDeleteRequestReason("");
      toast({ title: "Solicitud de eliminación enviada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ---- Approve/Reject delete request ----
  const reviewDeleteRequest = useMutation({
    mutationFn: async ({ requestId, approved }: { requestId: string; approved: boolean }) => {
      const request = deleteRequests.find(r => r.id === requestId);
      if (!request) throw new Error("Request not found");

      const { error } = await supabase.from("journal_entry_delete_requests").update({
        status: approved ? "APPROVED" : "REJECTED",
        reviewed_by: user!.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", requestId);
      if (error) throw error;

      if (approved) {
        // Delete the entry lines then entry
        const { error: lineErr } = await supabase.from("journal_entry_lines").delete().eq("entry_id", request.entry_id);
        if (lineErr) throw lineErr;
        const { error: entryErr } = await supabase.from("journal_entries").delete().eq("id", request.entry_id);
        if (entryErr) throw entryErr;
      }
    },
    onSuccess: (_, { approved }) => {
      qc.invalidateQueries({ queryKey: ["entry-delete-requests", activeAccountId] });
      qc.invalidateQueries({ queryKey: ["journal-entries", activeAccountId] });
      qc.invalidateQueries({ queryKey: ["journal-entry-lines", activeAccountId] });
      toast({ title: approved ? "Solicitud aprobada y asiento eliminado" : "Solicitud rechazada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ===== LIBRO MAYOR =====
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

  const exportLedgerCSV = () => {
    const acc = chartAccounts.find(c => c.id === ledgerAccountId);
    const header = "Fecha,Nº Asiento,Descripción,Debe,Haber,Saldo\n";
    const rows = ledgerWithBalance.map(l =>
      `"${l.journal_entries?.date}","${l.journal_entries?.entry_number}","${l.journal_entries?.description}",${l.debit},${l.credit},${l.balance}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `libro_mayor_${acc?.code || ""}.csv`; a.click();
  };

  // ===== RESULTADOS (P&L) =====
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

  const exportPLCSV = () => {
    let csv = "Tipo,Código,Cuenta,Importe\n";
    plData.incomeBreakdown.forEach(r => { csv += `Ingreso,${r.code},"${r.name}",${r.total}\n`; });
    csv += `Ingreso,,TOTAL INGRESOS,${plData.totalIncome}\n`;
    plData.expenseBreakdown.forEach(r => { csv += `Gasto,${r.code},"${r.name}",${r.total}\n`; });
    csv += `Gasto,,TOTAL GASTOS,${plData.totalExpense}\n`;
    csv += `,,RESULTADO,${plData.result}\n`;
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "cuenta_resultados.csv"; a.click();
  };

  // ===== IMPUESTOS (VAT) =====
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

  const exportTaxCSV = () => {
    let csv = "Concepto,Tipo IVA,Base Imponible,Cuota IVA\n";
    taxData.collected.forEach(r => { csv += `IVA Repercutido,${r.rate}%,${r.base},${r.vat}\n`; });
    csv += `TOTAL IVA Repercutido,,,${taxData.totalCollected}\n`;
    taxData.paid.forEach(r => { csv += `IVA Soportado,${r.rate}%,${r.base},${r.vat}\n`; });
    csv += `TOTAL IVA Soportado,,,${taxData.totalPaid}\n`;
    csv += `RESULTADO,,,${taxData.result}\n`;
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `iva_T${taxQuarter}_${taxYear}.csv`; a.click();
  };

  // ---- Seed chart of accounts ----
  const seedChart = useMutation({
    mutationFn: async () => {
      const defaultAccounts = [
        { code: "100", name: "Capital social", type: "EQUITY" },
        { code: "129", name: "Resultado del ejercicio", type: "EQUITY" },
        { code: "400", name: "Proveedores", type: "LIABILITY" },
        { code: "410", name: "Acreedores", type: "LIABILITY" },
        { code: "430", name: "Clientes", type: "ASSET" },
        { code: "472", name: "IVA Soportado", type: "ASSET" },
        { code: "477", name: "IVA Repercutido", type: "LIABILITY" },
        { code: "570", name: "Caja", type: "ASSET" },
        { code: "572", name: "Bancos", type: "ASSET" },
        { code: "600", name: "Compras de mercaderías", type: "EXPENSE" },
        { code: "621", name: "Arrendamientos y cánones", type: "EXPENSE" },
        { code: "625", name: "Primas de seguros", type: "EXPENSE" },
        { code: "628", name: "Suministros", type: "EXPENSE" },
        { code: "629", name: "Otros servicios", type: "EXPENSE" },
        { code: "640", name: "Sueldos y salarios", type: "EXPENSE" },
        { code: "642", name: "Seguridad Social a cargo de la empresa", type: "EXPENSE" },
        { code: "700", name: "Ventas de mercaderías", type: "INCOME" },
        { code: "705", name: "Prestaciones de servicios", type: "INCOME" },
        { code: "759", name: "Ingresos por servicios diversos", type: "INCOME" },
      ];
      const { error } = await supabase.from("chart_of_accounts").insert(
        defaultAccounts.map(a => ({ ...a, account_id: activeAccountId! }))
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chart-of-accounts", activeAccountId] });
      toast({ title: "Plan contable inicializado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ===== RENDER =====
  if (isMaster && !selectedAccountId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Contabilidad</h1>
        <Card>
          <CardHeader><CardTitle className="text-base">Selecciona un cliente</CardTitle></CardHeader>
          <CardContent>
            <Select onValueChange={setSelectedAccountId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
              <SelectContent>
                {clientAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!activeAccountId) return <p className="text-muted-foreground">Sin cuenta asignada.</p>;

  if (chartAccounts.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Contabilidad</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <BookOpen className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg text-muted-foreground">No hay plan contable configurado</p>
            {isManager && (
              <Button onClick={() => seedChart.mutate()} disabled={seedChart.isPending}>
                <Plus className="mr-2 h-4 w-4" /> Inicializar Plan Contable Español (PGC)
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Managers can edit any manual entry; employees only DRAFT manual entries
  const canEditEntry = (e: JournalEntry) => !e.invoice_id && (isManager || e.status === "DRAFT");
  const canDeleteEntry = (e: JournalEntry) => !e.invoice_id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contabilidad</h1>
        {isMaster && (
          <Button variant="outline" size="sm" onClick={() => setSelectedAccountId("")}>Cambiar cliente</Button>
        )}
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="flex-wrap">
          <TabsTrigger value="dashboard">Resumen</TabsTrigger>
          <TabsTrigger value="chart">Plan Contable</TabsTrigger>
          <TabsTrigger value="entries" className="relative">
            Asientos
            {isManager && pendingDeleteRequests.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold h-4 w-4">
                {pendingDeleteRequests.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="ledger">Libro Mayor</TabsTrigger>
          <TabsTrigger value="pl">Resultados</TabsTrigger>
          <TabsTrigger value="taxes">Impuestos</TabsTrigger>
        </TabsList>

        {/* ===== DASHBOARD ===== */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{EUR(totalIncome)}</p>
                    <p className="text-xs text-muted-foreground">Ingresos totales</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingDown className="h-8 w-8 text-destructive" />
                  <div>
                    <p className="text-2xl font-bold">{EUR(totalExpense)}</p>
                    <p className="text-xs text-muted-foreground">Gastos totales</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-8 w-8 text-primary" />
                  <div>
                    <p className={`text-2xl font-bold ${totalIncome - totalExpense >= 0 ? "" : "text-destructive"}`}>
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
                  <Calculator className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className={`text-2xl font-bold ${vatCollected - vatPaid >= 0 ? "text-destructive" : ""}`}>
                      {EUR(vatCollected - vatPaid)}
                    </p>
                    <p className="text-xs text-muted-foreground">IVA a {vatCollected - vatPaid >= 0 ? "liquidar" : "compensar"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Evolución mensual</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip formatter={(v: number) => EUR(v)} />
                      <Bar dataKey="ingresos" fill="hsl(var(--primary))" name="Ingresos" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="gastos" fill="hsl(var(--destructive))" name="Gastos" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Distribución de gastos</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
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
        </TabsContent>

        {/* ===== PLAN CONTABLE ===== */}
        <TabsContent value="chart" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por código o nombre..." className="pl-8" value={chartSearch} onChange={e => setChartSearch(e.target.value)} />
            </div>
            {isManager && (
              <Button size="sm" onClick={() => { setEditingChart(null); setChartForm({ code: "", name: "", type: "EXPENSE" }); setChartDialog(true); }}>
                <Plus className="mr-1 h-4 w-4" /> Nueva cuenta
              </Button>
            )}
          </div>

          {Object.entries(groupedChart).map(([type, accounts]) => accounts.length > 0 && (
            <Card key={type}>
              <CardHeader className="py-3">
                <div className="flex items-center gap-2">
                  <Badge className={typeColors[type]}>{typeLabels[type]}</Badge>
                  <span className="text-sm text-muted-foreground">{accounts.length} cuentas</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Código</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead className="text-right w-36">Saldo</TableHead>
                      {isManager && <TableHead className="w-16" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map(acc => {
                      const bal = getAccountBalance(acc.id);
                      return (
                        <TableRow key={acc.id} className={!acc.is_active ? "opacity-50" : ""}>
                          <TableCell className="font-mono font-medium">{acc.code}</TableCell>
                          <TableCell>{acc.name}</TableCell>
                          <TableCell className={`text-right font-mono ${bal >= 0 ? "" : "text-destructive"}`}>
                            {EUR(Math.abs(bal))} {bal < 0 ? "(H)" : bal > 0 ? "(D)" : ""}
                          </TableCell>
                          {isManager && (
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => {
                                setEditingChart(acc);
                                setChartForm({ code: acc.code, name: acc.name, type: acc.type });
                                setChartDialog(true);
                              }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ===== ASIENTOS ===== */}
        <TabsContent value="entries" className="space-y-4">
          {/* Pending delete requests for managers */}
          {isManager && pendingDeleteRequests.length > 0 && (
            <Card className="border-destructive/50">
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-destructive" />
                  Solicitudes de eliminación pendientes ({pendingDeleteRequests.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Asiento</TableHead>
                      <TableHead className="w-28">Fecha</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="w-28">Solicitado</TableHead>
                      <TableHead className="w-28" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingDeleteRequests.map(req => (
                      <TableRow key={req.id}>
                        <TableCell className="font-mono text-sm">{req.journal_entries?.entry_number}</TableCell>
                        <TableCell>{req.journal_entries?.date ? format(new Date(req.journal_entries.date), "dd/MM/yyyy") : ""}</TableCell>
                        <TableCell className="max-w-[250px] truncate">{req.reason || "Sin motivo"}</TableCell>
                        <TableCell>{format(new Date(req.created_at), "dd/MM/yyyy")}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="outline" size="icon" className="h-7 w-7 text-primary"
                              onClick={() => reviewDeleteRequest.mutate({ requestId: req.id, approved: true })}
                              disabled={reviewDeleteRequest.isPending}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline" size="icon" className="h-7 w-7 text-destructive"
                              onClick={() => reviewDeleteRequest.mutate({ requestId: req.id, approved: false })}
                              disabled={reviewDeleteRequest.isPending}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar asiento..." className="pl-8" value={entryFilter.search} onChange={e => setEntryFilter(prev => ({ ...prev, search: e.target.value }))} />
            </div>
            <Select value={entryFilter.status} onValueChange={v => setEntryFilter(prev => ({ ...prev, status: v }))}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="DRAFT">Borrador</SelectItem>
                <SelectItem value="POSTED">Contabilizado</SelectItem>
              </SelectContent>
            </Select>
            {isManager && (
              <Button size="sm" onClick={openCreateEntry}>
                <Plus className="mr-1 h-4 w-4" /> Nuevo asiento
              </Button>
            )}
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Nº Asiento</TableHead>
                  <TableHead className="w-28">Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="w-28">Estado</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sin asientos</TableCell></TableRow>
                ) : filteredEntries.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-sm">
                      {e.entry_number}
                      {e.invoice_id && <Link className="inline ml-1 h-3 w-3 text-muted-foreground" />}
                    </TableCell>
                    <TableCell>{format(new Date(e.date), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{e.description}</TableCell>
                    <TableCell>
                      <Badge variant={e.status === "POSTED" ? "default" : "secondary"}>
                        {e.status === "POSTED" ? "Contabilizado" : "Borrador"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {/* Edit — only DRAFT manual entries */}
                          {canEditEntry(e) && (
                            <DropdownMenuItem onClick={() => openEditEntry(e)}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                          )}
                          {/* Post — managers, DRAFT only */}
                          {isManager && e.status === "DRAFT" && (
                            <DropdownMenuItem onClick={() => postEntry.mutate(e.id)}>
                              <Check className="mr-2 h-4 w-4" /> Contabilizar
                            </DropdownMenuItem>
                          )}
                          {canDeleteEntry(e) && (
                            <>
                              <DropdownMenuSeparator />
                              {isManager ? (
                                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirmEntry(e)}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem className="text-destructive" onClick={() => { setDeleteRequestDialog(e); setDeleteRequestReason(""); }}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Solicitar eliminación
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ===== LIBRO MAYOR ===== */}
        <TabsContent value="ledger" className="space-y-4">
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
              <Button variant="outline" size="sm" onClick={exportLedgerCSV}>
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
        </TabsContent>

        {/* ===== RESULTADOS (P&L) ===== */}
        <TabsContent value="pl" className="space-y-4">
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
            <Button variant="outline" size="sm" onClick={exportPLCSV}>
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
        </TabsContent>

        {/* ===== IMPUESTOS ===== */}
        <TabsContent value="taxes" className="space-y-4">
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
            <Button variant="outline" size="sm" onClick={exportTaxCSV}>
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
              <span className={`text-2xl font-bold font-mono ${taxData.result >= 0 ? "text-destructive" : ""}`}>
                {EUR(Math.abs(taxData.result))}
              </span>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== DIALOGS ===== */}

      {/* Chart Account Dialog */}
      <Dialog open={chartDialog} onOpenChange={setChartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingChart ? "Editar cuenta" : "Nueva cuenta contable"}</DialogTitle>
            <DialogDescription>Introduce los datos de la cuenta del plan contable.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Código</Label>
                <Input value={chartForm.code} onChange={e => setChartForm(p => ({ ...p, code: e.target.value }))} placeholder="700" />
              </div>
              <div className="col-span-2">
                <Label>Nombre</Label>
                <Input value={chartForm.name} onChange={e => setChartForm(p => ({ ...p, name: e.target.value }))} placeholder="Ventas de mercaderías" />
              </div>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={chartForm.type} onValueChange={v => setChartForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChartDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveChartAccount.mutate()} disabled={!chartForm.code || !chartForm.name || saveChartAccount.isPending}>
              {editingChart ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Journal Entry Dialog (Create / Edit) */}
      <Dialog open={entryDialog} onOpenChange={setEntryDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEntry ? `Editar asiento ${editingEntry.entry_number}` : "Nuevo asiento contable"}</DialogTitle>
            <DialogDescription>Las líneas deben cuadrar (Debe = Haber).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha</Label>
                <Input type="date" value={entryForm.date} onChange={e => setEntryForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div>
                <Label>Descripción</Label>
                <Input value={entryForm.description} onChange={e => setEntryForm(p => ({ ...p, description: e.target.value }))} placeholder="Descripción del asiento" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Líneas del asiento</Label>
              {entryForm.lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_100px_100px_32px] gap-2 items-end">
                  <Select value={line.chart_account_id} onValueChange={v => updateEntryLine(idx, "chart_account_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Cuenta..." /></SelectTrigger>
                    <SelectContent>
                      {chartAccounts.filter(c => c.is_active).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder="Debe" value={line.debit} onChange={e => updateEntryLine(idx, "debit", e.target.value)} />
                  <Input type="number" placeholder="Haber" value={line.credit} onChange={e => updateEntryLine(idx, "credit", e.target.value)} />
                  <Button variant="ghost" size="icon" onClick={() => removeEntryLine(idx)} disabled={entryForm.lines.length <= 2}>×</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addEntryLine}>
                <Plus className="mr-1 h-4 w-4" /> Añadir línea
              </Button>
            </div>

            <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
              <div className="text-sm">
                <span className="font-medium">Debe: {EUR(entryTotalDebit)}</span>
                <span className="mx-4">|</span>
                <span className="font-medium">Haber: {EUR(entryTotalCredit)}</span>
              </div>
              <Badge variant={entryBalanced ? "default" : "destructive"}>
                {entryBalanced ? "✓ Cuadrado" : `Descuadre: ${EUR(Math.abs(entryTotalDebit - entryTotalCredit))}`}
              </Badge>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveEntry.mutate()} disabled={!entryBalanced || saveEntry.isPending}>
              {editingEntry ? "Guardar cambios" : "Crear asiento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation (Manager) */}
      <AlertDialog open={!!deleteConfirmEntry} onOpenChange={open => !open && setDeleteConfirmEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar asiento</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar el asiento <strong>{deleteConfirmEntry?.entry_number}</strong>?
              {deleteConfirmEntry?.status === "POSTED" && " Este asiento ya está contabilizado."}
              {" "}Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmEntry && deleteEntry.mutate(deleteConfirmEntry.id)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Request Dialog (Employee) */}
      <Dialog open={!!deleteRequestDialog} onOpenChange={open => !open && setDeleteRequestDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar eliminación de asiento</DialogTitle>
            <DialogDescription>
              Asiento: <strong>{deleteRequestDialog?.entry_number}</strong> — {deleteRequestDialog?.description}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Motivo de la eliminación</Label>
            <Textarea
              value={deleteRequestReason}
              onChange={e => setDeleteRequestReason(e.target.value)}
              placeholder="Explica por qué se debe eliminar este asiento..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRequestDialog(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => createDeleteRequest.mutate()}
              disabled={!deleteRequestReason.trim() || createDeleteRequest.isPending}
            >
              Enviar solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppAccounting;
