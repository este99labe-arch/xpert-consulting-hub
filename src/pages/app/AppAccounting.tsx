import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";

import MasterAccountSelector, { MasterAccountClearButton } from "@/components/shared/MasterAccountSelector";
import AccountingDashboard from "@/components/accounting/AccountingDashboard";
import ChartOfAccountsTab from "@/components/accounting/ChartOfAccountsTab";
import JournalEntriesTab from "@/components/accounting/JournalEntriesTab";
import JournalEntryDialog from "@/components/accounting/JournalEntryDialog";
import LedgerTab from "@/components/accounting/LedgerTab";
import PLTab from "@/components/accounting/PLTab";
import TaxesTab from "@/components/accounting/TaxesTab";
import { DeleteConfirmDialog, DeleteRequestDialog } from "@/components/accounting/DeleteEntryDialogs";
import { ChartAccount, JournalEntry, JournalEntryLine, DeleteRequest, EntryFormLine } from "@/components/accounting/types";

const AppAccounting = () => {
  const { user, accountId, role } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";
  const isMaster = role === "MASTER_ADMIN";

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const activeAccountId = isMaster ? (selectedAccountId || accountId) : accountId;

  // ---- Data Queries ----
  const { data: chartAccounts = [] } = useQuery({
    queryKey: ["chart-of-accounts", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("chart_of_accounts").select("*").eq("account_id", activeAccountId!).order("code");
      if (error) throw error;
      return (data || []) as ChartAccount[];
    },
    enabled: !!activeAccountId,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["journal-entries", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("journal_entries").select("*").eq("account_id", activeAccountId!).order("date", { ascending: false });
      if (error) throw error;
      return (data || []) as JournalEntry[];
    },
    enabled: !!activeAccountId,
  });

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

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices-accounting", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*").eq("account_id", activeAccountId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeAccountId,
  });

  const { data: deleteRequests = [] } = useQuery({
    queryKey: ["entry-delete-requests", activeAccountId],
    queryFn: async () => {
      const q = supabase
        .from("journal_entry_delete_requests")
        .select("*, journal_entries(entry_number, description, date)")
        .order("created_at", { ascending: false });
      if (isMaster && activeAccountId) q.eq("account_id", activeAccountId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as DeleteRequest[];
    },
    enabled: !!activeAccountId,
  });

  const pendingDeleteRequests = useMemo(() => deleteRequests.filter(r => r.status === "PENDING"), [deleteRequests]);

  // ---- Dashboard KPIs ----
  const postedLines = useMemo(() => allLines.filter(l => l.journal_entries?.status === "POSTED"), [allLines]);

  const totalIncome = useMemo(() => {
    const ids = chartAccounts.filter(c => c.type === "INCOME").map(c => c.id);
    return postedLines.filter(l => ids.includes(l.chart_account_id)).reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0);
  }, [postedLines, chartAccounts]);

  const totalExpense = useMemo(() => {
    const ids = chartAccounts.filter(c => c.type === "EXPENSE").map(c => c.id);
    return postedLines.filter(l => ids.includes(l.chart_account_id)).reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
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

  const pieData = useMemo(() => {
    const byType: Record<string, number> = {};
    for (const ca of chartAccounts.filter(c => c.type === "EXPENSE")) {
      const total = postedLines.filter(l => l.chart_account_id === ca.id).reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
      if (total > 0) byType[ca.name] = (byType[ca.name] || 0) + total;
    }
    return Object.entries(byType).map(([name, value]) => ({ name, value }));
  }, [postedLines, chartAccounts]);

  const getAccountBalance = (accountId: string) => {
    return postedLines.filter(l => l.chart_account_id === accountId).reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
  };

  // ---- Mutations ----
  const saveChartAccount = useMutation({
    mutationFn: async ({ form, editingId }: { form: { code: string; name: string; type: string }; editingId?: string }) => {
      const payload = { account_id: activeAccountId!, code: form.code, name: form.name, type: form.type };
      if (editingId) {
        const { error } = await supabase.from("chart_of_accounts").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("chart_of_accounts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chart-of-accounts", activeAccountId] });
      toast({ title: "Cuenta guardada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ---- Entry Dialog State ----
  const [entryDialog, setEntryDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [entryForm, setEntryForm] = useState<{ date: string; description: string; lines: EntryFormLine[] }>({
    date: format(new Date(), "yyyy-MM-dd"), description: "",
    lines: [{ chart_account_id: "", debit: "", credit: "" }, { chart_account_id: "", debit: "", credit: "" }],
  });

  const [deleteConfirmEntry, setDeleteConfirmEntry] = useState<JournalEntry | null>(null);
  const [deleteRequestEntry, setDeleteRequestEntry] = useState<JournalEntry | null>(null);

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
      date: entry.date, description: entry.description,
      lines: lines.length > 0
        ? lines.map(l => ({ chart_account_id: l.chart_account_id, debit: Number(l.debit) > 0 ? String(l.debit) : "", credit: Number(l.credit) > 0 ? String(l.credit) : "" }))
        : [{ chart_account_id: "", debit: "", credit: "" }, { chart_account_id: "", debit: "", credit: "" }],
    });
    setEntryDialog(true);
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
        const { error } = await supabase.from("journal_entries").update({ date: entryForm.date, description: entryForm.description }).eq("id", editingEntry.id);
        if (error) throw error;
        const { error: delErr } = await supabase.from("journal_entry_lines").delete().eq("entry_id", editingEntry.id);
        if (delErr) throw delErr;
        const linePayloads = validLines.map(l => ({ entry_id: editingEntry.id, chart_account_id: l.chart_account_id, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: "" }));
        const { error: lineErr } = await supabase.from("journal_entry_lines").insert(linePayloads);
        if (lineErr) throw lineErr;
      } else {
        const { data: entry, error } = await supabase.from("journal_entries").insert({ account_id: activeAccountId!, date: entryForm.date, description: entryForm.description, status: "DRAFT", created_by: user!.id }).select().single();
        if (error) throw error;
        const linePayloads = validLines.map(l => ({ entry_id: entry.id, chart_account_id: l.chart_account_id, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: "" }));
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

  const deleteEntry = useMutation({
    mutationFn: async (entryId: string) => {
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

  const createDeleteRequest = useMutation({
    mutationFn: async (reason: string) => {
      if (!deleteRequestEntry) throw new Error("No entry selected");
      const { error } = await supabase.from("journal_entry_delete_requests").insert({ account_id: activeAccountId!, entry_id: deleteRequestEntry.id, reason, requested_by: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entry-delete-requests", activeAccountId] });
      setDeleteRequestEntry(null);
      toast({ title: "Solicitud de eliminación enviada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reviewDeleteRequest = useMutation({
    mutationFn: async ({ requestId, approved }: { requestId: string; approved: boolean }) => {
      const request = deleteRequests.find(r => r.id === requestId);
      if (!request) throw new Error("Request not found");
      const { error } = await supabase.from("journal_entry_delete_requests").update({ status: approved ? "APPROVED" : "REJECTED", reviewed_by: user!.id, reviewed_at: new Date().toISOString() }).eq("id", requestId);
      if (error) throw error;
      if (approved) {
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
      const { error } = await supabase.from("chart_of_accounts").insert(defaultAccounts.map(a => ({ ...a, account_id: activeAccountId! })));
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chart-of-accounts", activeAccountId] });
      toast({ title: "Plan contable inicializado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ---- Render ----
  // Master admin no longer blocked — defaults to own account

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

  const canEditEntry = (e: JournalEntry) => isManager || (e.status === "DRAFT" && !e.invoice_id);
  const canDeleteEntry = (_e: JournalEntry) => true;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Contabilidad</h1>
        {isMaster && selectedAccountId && <MasterAccountClearButton onClear={() => setSelectedAccountId("")} />}
      </div>
      {isMaster && !selectedAccountId && (
        <MasterAccountSelector title="Contabilidad" onSelect={setSelectedAccountId} variant="inline" />
      )}

      <Tabs defaultValue="dashboard">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="dashboard">Resumen</TabsTrigger>
          <TabsTrigger value="chart">Plan</TabsTrigger>
          <TabsTrigger value="entries" className="relative">
            Asientos
            {isManager && pendingDeleteRequests.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold h-4 w-4">
                {pendingDeleteRequests.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="ledger">Mayor</TabsTrigger>
          <TabsTrigger value="pl">P&L</TabsTrigger>
          <TabsTrigger value="taxes">IVA</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <AccountingDashboard
            totalIncome={totalIncome} totalExpense={totalExpense}
            vatCollected={vatCollected} vatPaid={vatPaid}
            monthlyData={monthlyData} pieData={pieData}
          />
        </TabsContent>

        <TabsContent value="chart">
          <ChartOfAccountsTab
            chartAccounts={chartAccounts} isManager={isManager}
            getAccountBalance={getAccountBalance}
            onSave={(form, editingId) => saveChartAccount.mutate({ form, editingId })}
            isSaving={saveChartAccount.isPending}
          />
        </TabsContent>

        <TabsContent value="entries">
          <JournalEntriesTab
            entries={entries} pendingDeleteRequests={pendingDeleteRequests}
            isManager={isManager} canEditEntry={canEditEntry} canDeleteEntry={canDeleteEntry}
            onCreateEntry={openCreateEntry} onEditEntry={openEditEntry}
            onPostEntry={(id) => postEntry.mutate(id)}
            onDeleteEntry={setDeleteConfirmEntry}
            onRequestDelete={setDeleteRequestEntry}
            onReviewDeleteRequest={(id, approved) => reviewDeleteRequest.mutate({ requestId: id, approved })}
            isReviewPending={reviewDeleteRequest.isPending}
          />
        </TabsContent>

        <TabsContent value="ledger">
          <LedgerTab chartAccounts={chartAccounts} allLines={allLines} />
        </TabsContent>

        <TabsContent value="pl">
          <PLTab chartAccounts={chartAccounts} postedLines={postedLines} />
        </TabsContent>

        <TabsContent value="taxes">
          <TaxesTab invoices={invoices} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <JournalEntryDialog
        open={entryDialog} onOpenChange={setEntryDialog}
        editingEntry={editingEntry} entryForm={entryForm} setEntryForm={setEntryForm}
        chartAccounts={chartAccounts} onSave={() => saveEntry.mutate()} isSaving={saveEntry.isPending}
      />
      <DeleteConfirmDialog entry={deleteConfirmEntry} onClose={() => setDeleteConfirmEntry(null)} onConfirm={(id) => deleteEntry.mutate(id)} />
      <DeleteRequestDialog entry={deleteRequestEntry} onClose={() => setDeleteRequestEntry(null)} onSubmit={(reason) => createDeleteRequest.mutate(reason)} isPending={createDeleteRequest.isPending} />
    </div>
  );
};

export default AppAccounting;
