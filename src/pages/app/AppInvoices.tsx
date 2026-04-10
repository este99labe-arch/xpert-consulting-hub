import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { FileText, TrendingUp, TrendingDown, DollarSign, Plus, Search, Trash2, Check, X, RefreshCw, ClipboardList, CalendarIcon, List, LayoutGrid, Landmark, Upload } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import CreateReminderDialog from "@/components/reminders/CreateReminderDialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import CreateInvoiceDialog from "@/components/invoices/CreateInvoiceDialog";
import InvoicePreviewDialog from "@/components/invoices/InvoicePreviewDialog";
import EditInvoiceDialog from "@/components/invoices/EditInvoiceDialog";
import InvoiceActionsMenu from "@/components/invoices/InvoiceActionsMenu";
import RecurringInvoicesTab from "@/components/invoices/RecurringInvoicesTab";
import PaginationControls from "@/components/shared/PaginationControls";
import { useServerPagination } from "@/hooks/use-server-pagination";
import { usePagination } from "@/hooks/use-pagination";
import { dispatchWebhook } from "@/lib/webhooks";
import InvoiceKanbanView from "@/components/invoices/InvoiceKanbanView";
import BankReconciliationTab from "@/components/invoices/BankReconciliationTab";
import InvoiceImportTab from "@/components/invoices/InvoiceImportTab";

const statusColors: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-primary/10 text-primary",
  PAID: "bg-green-100 text-green-800",
  PARTIALLY_PAID: "bg-amber-100 text-amber-800",
  OVERDUE: "bg-destructive/10 text-destructive",
  ACCEPTED: "bg-green-100 text-green-800",
  REJECTED: "bg-destructive/10 text-destructive",
  INVOICED: "bg-primary/10 text-primary",
};

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador", SENT: "Enviada", PAID: "Pagada", PARTIALLY_PAID: "Pago parcial", OVERDUE: "Vencida",
  ACCEPTED: "Aceptado", REJECTED: "Rechazado", INVOICED: "Facturado",
};

const typeLabels: Record<string, string> = {
  INVOICE: "Factura", EXPENSE: "Gasto", QUOTE: "Presupuesto",
};

const AppInvoices = () => {
  const { accountId, role, user } = useAuth();
  const queryClient = useQueryClient();
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";

  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") || "ALL");
  const [typeFilter, setTypeFilter] = useState<string>(searchParams.get("type") || "ALL");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const location = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createDefaultType, setCreateDefaultType] = useState<"INVOICE" | "EXPENSE" | "QUOTE" | undefined>(undefined);
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);
  const [editInvoice, setEditInvoice] = useState<any>(null);
  const [quoteSearch, setQuoteSearch] = useState("");
  const [debouncedQuoteSearch, setDebouncedQuoteSearch] = useState("");
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<string>("ALL");

  // Debounce search inputs
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuoteSearch(quoteSearch), 300);
    return () => clearTimeout(t);
  }, [quoteSearch]);

  // Auto-open create dialog from dashboard quick actions
  useEffect(() => {
    const state = location.state as any;
    if (state?.openCreate) {
      setCreateDefaultType(state.defaultType || undefined);
      setDialogOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  const [activeTab, setActiveTab] = useState("invoices");
  const [invoiceViewMode, setInvoiceViewMode] = useState<"list" | "kanban">("list");

  // Sync URL params on mount
  useEffect(() => {
    const urlStatus = searchParams.get("status");
    const urlType = searchParams.get("type");
    if (urlStatus) setStatusFilter(urlStatus);
    if (urlType) setTypeFilter(urlType);
    if (urlStatus || urlType) setSearchParams({}, { replace: true });
  }, []);

  // Delete state
  const [deleteInvoice, setDeleteInvoice] = useState<any>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteReasonDialog, setDeleteReasonDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reminder state
  const [reminderInvoice, setReminderInvoice] = useState<any>(null);

  // ---- Server-side pagination for invoices (list view) ----
  const invoicePagination = useServerPagination();
  const quotePagination = useServerPagination();

  // Server-side KPIs via DB function
  const { data: kpiData } = useQuery({
    queryKey: ["invoice-kpis", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("invoice_kpis", { _account_id: accountId! });
      if (error) throw error;
      return data as {
        total_income: number; total_expenses: number; total_paid: number; total_pending: number;
        total_quotes: number; accepted_quotes: number; pending_quotes: number;
      };
    },
    enabled: !!accountId,
  });

  // Server-side paginated query for invoices/expenses
  const { data: invoiceResult, isLoading } = useQuery({
    queryKey: ["invoices", accountId, invoicePagination.currentPage, invoicePagination.pageSize, debouncedSearch, statusFilter, typeFilter, dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: async () => {
      if (!accountId) return { data: [], count: 0 };
      let query = supabase
        .from("invoices")
        .select("*, business_clients(name, tax_id, email)", { count: "exact" })
        .eq("account_id", accountId)
        .neq("type", "QUOTE")
        .order("issue_date", { ascending: false });

      if (debouncedSearch) {
        query = query.or(`concept.ilike.%${debouncedSearch}%,invoice_number.ilike.%${debouncedSearch}%`);
      }
      if (statusFilter !== "ALL") query = query.eq("status", statusFilter);
      if (typeFilter !== "ALL") query = query.eq("type", typeFilter);
      if (dateFrom) query = query.gte("issue_date", format(dateFrom, "yyyy-MM-dd"));
      if (dateTo) query = query.lte("issue_date", format(dateTo, "yyyy-MM-dd"));

      query = query.range(invoicePagination.rangeFrom, invoicePagination.rangeTo);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    enabled: !!accountId,
  });

  // Update pagination total when data loads
  useEffect(() => {
    if (invoiceResult) invoicePagination.setTotalItems(invoiceResult.count);
  }, [invoiceResult?.count]);

  const paginatedInvoices = invoiceResult?.data || [];

  // Server-side paginated query for quotes
  const { data: quoteResult } = useQuery({
    queryKey: ["quotes", accountId, quotePagination.currentPage, quotePagination.pageSize, debouncedQuoteSearch, quoteStatusFilter],
    queryFn: async () => {
      if (!accountId) return { data: [], count: 0 };
      let query = supabase
        .from("invoices")
        .select("*, business_clients(name, tax_id, email)", { count: "exact" })
        .eq("account_id", accountId)
        .eq("type", "QUOTE")
        .order("issue_date", { ascending: false });

      if (debouncedQuoteSearch) {
        query = query.or(`concept.ilike.%${debouncedQuoteSearch}%,invoice_number.ilike.%${debouncedQuoteSearch}%`);
      }
      if (quoteStatusFilter !== "ALL") query = query.eq("status", quoteStatusFilter);

      query = query.range(quotePagination.rangeFrom, quotePagination.rangeTo);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    enabled: !!accountId,
  });

  useEffect(() => {
    if (quoteResult) quotePagination.setTotalItems(quoteResult.count);
  }, [quoteResult?.count]);

  const paginatedQuotes = quoteResult?.data || [];

  // Kanban: load ALL non-quote invoices (no pagination) when in kanban mode
  const { data: kanbanInvoices = [] } = useQuery({
    queryKey: ["invoices-kanban", accountId, debouncedSearch, statusFilter, typeFilter, dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: async () => {
      if (!accountId) return [];
      let query = supabase
        .from("invoices")
        .select("*, business_clients(name, tax_id, email)")
        .eq("account_id", accountId)
        .neq("type", "QUOTE")
        .order("issue_date", { ascending: false })
        .limit(5000);

      if (debouncedSearch) {
        query = query.or(`concept.ilike.%${debouncedSearch}%,invoice_number.ilike.%${debouncedSearch}%`);
      }
      if (statusFilter !== "ALL") query = query.eq("status", statusFilter);
      if (typeFilter !== "ALL") query = query.eq("type", typeFilter);
      if (dateFrom) query = query.gte("issue_date", format(dateFrom, "yyyy-MM-dd"));
      if (dateTo) query = query.lte("issue_date", format(dateTo, "yyyy-MM-dd"));

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId && invoiceViewMode === "kanban",
  });

  // Pending delete requests (managers only)
  const { data: deleteRequests = [] } = useQuery({
    queryKey: ["invoice-delete-requests", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_delete_requests" as any)
        .select("*, invoices(invoice_number, concept, amount_total, type, business_clients(name))")
        .eq("account_id", accountId!)
        .eq("status", "PENDING")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!accountId && isManager,
  });

  // KPIs from server
  const totalIncome = Number(kpiData?.total_income || 0);
  const totalExpenses = Number(kpiData?.total_expenses || 0);
  const totalPaid = Number(kpiData?.total_paid || 0);
  const totalPending = Number(kpiData?.total_pending || 0);
  const totalQuotes = Number(kpiData?.total_quotes || 0);
  const acceptedQuotes = Number(kpiData?.accepted_quotes || 0);
  const pendingQuotes = Number(kpiData?.pending_quotes || 0);

  const kpis = [
    { label: "Facturado", value: `€${totalIncome.toLocaleString("es-ES", { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: "text-primary" },
    { label: "Gastos", value: `€${totalExpenses.toLocaleString("es-ES", { minimumFractionDigits: 2 })}`, icon: TrendingDown, color: "text-destructive" },
    { label: "Cobrado", value: `€${totalPaid.toLocaleString("es-ES", { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-primary" },
    { label: "Pendiente", value: `€${totalPending.toLocaleString("es-ES", { minimumFractionDigits: 2 })}`, icon: FileText, color: "text-muted-foreground" },
  ];

  const handleExportPdf = async (invoiceId: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { toast({ title: "Error", description: "No estás autenticado", variant: "destructive" }); return; }
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/generate_invoice_pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ invoice_id: invoiceId, format: "pdf" }),
      });
      if (!res.ok) {
        const errText = await res.text();
        let errMsg = "Error generando PDF";
        try { errMsg = JSON.parse(errText).error || errMsg; } catch {}
        throw new Error(errMsg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      a.download = filenameMatch?.[1] || `factura-${invoiceId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "PDF descargado correctamente" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleSendEmail = async (invoiceId: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { toast({ title: "Error", description: "No estás autenticado", variant: "destructive" }); return; }
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/send_invoice_email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error enviando email");
      toast({ title: "Email enviado", description: "La factura se ha enviado al cliente por email" });
      if (accountId) dispatchWebhook(accountId, "invoice.sent", { invoice_id: invoiceId });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  const handleDeleteClick = (inv: any) => {
    setDeleteInvoice(inv);
    if (isManager) {
      setDeleteReasonDialog(false);
    } else {
      setDeleteReason("");
      setDeleteReasonDialog(true);
    }
  };

  const handleManagerDelete = async () => {
    if (!deleteInvoice) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("invoices").delete().eq("id", deleteInvoice.id);
      if (error) throw error;
      toast({ title: "Factura eliminada" });
      if (accountId) dispatchWebhook(accountId, "invoice.deleted", { invoice_id: deleteInvoice.id, invoice_number: deleteInvoice.invoice_number });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["invoices-kanban"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteInvoice(null);
    }
  };

  const handleEmployeeRequest = async () => {
    if (!deleteInvoice || !accountId || !user) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("invoice_delete_requests" as any).insert({
        invoice_id: deleteInvoice.id,
        account_id: accountId,
        requested_by: user.id,
        reason: deleteReason.trim() || "Sin motivo especificado",
        status: "PENDING",
      } as any);
      if (error) throw error;
      toast({ title: "Solicitud enviada", description: "Tu manager revisará la solicitud de eliminación." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteInvoice(null);
      setDeleteReasonDialog(false);
    }
  };

  const handleApproveDelete = async (request: any) => {
    try {
      const { error: delErr } = await supabase.from("invoices").delete().eq("id", request.invoice_id);
      if (delErr) throw delErr;
      await supabase.from("invoice_delete_requests" as any).update({
        status: "APPROVED", reviewed_by: user?.id, reviewed_at: new Date().toISOString(),
      } as any).eq("id", request.id);
      toast({ title: "Factura eliminada y solicitud aprobada" });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-delete-requests"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleRejectDelete = async (request: any) => {
    try {
      await supabase.from("invoice_delete_requests" as any).update({
        status: "REJECTED", reviewed_by: user?.id, reviewed_at: new Date().toISOString(),
      } as any).eq("id", request.id);
      toast({ title: "Solicitud rechazada" });
      queryClient.invalidateQueries({ queryKey: ["invoice-delete-requests"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const renderServerPagination = (p: ReturnType<typeof useServerPagination>) => (
    <div className="px-4 pb-4">
      <PaginationControls
        currentPage={p.currentPage}
        totalPages={p.totalPages}
        totalItems={p.totalItems}
        pageSize={p.pageSize}
        startIndex={p.startIndex}
        endIndex={p.endIndex}
        onPageChange={p.setCurrentPage}
        onPageSizeChange={p.setPageSize}
        pageSizeOptions={p.pageSizeOptions}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Facturación</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="invoices">Facturas</TabsTrigger>
            <TabsTrigger value="quotes">
              <ClipboardList className="h-4 w-4 mr-1" /> Presupuestos
            </TabsTrigger>
            <TabsTrigger value="recurring">
              <RefreshCw className="h-4 w-4 mr-1" /> Recurrentes
            </TabsTrigger>
            <TabsTrigger value="reconciliation">
              <Landmark className="h-4 w-4 mr-1" /> Conciliación
            </TabsTrigger>
          </TabsList>
          <Button onClick={() => setDialogOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" /> {activeTab === "quotes" ? "Nuevo presupuesto" : "Nuevo"}
          </Button>
        </div>

        <TabsContent value="invoices" className="space-y-6">

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending delete requests (managers) */}
      {isManager && deleteRequests.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-amber-600" />
              Solicitudes de eliminación pendientes
              <Badge variant="secondary" className="ml-1">{deleteRequests.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {deleteRequests.map((req: any) => {
                const inv = req.invoices;
                return (
                  <div key={req.id} className="flex items-center justify-between rounded-lg border bg-background p-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{inv?.invoice_number || "—"}</span>
                        <Badge variant="outline" className="text-xs">
                          {inv?.type === "INVOICE" ? "Factura" : "Gasto"}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          €{Number(inv?.amount_total || 0).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {inv?.concept || "—"} · {inv?.business_clients?.name || "—"}
                      </p>
                      {req.reason && (
                        <p className="text-xs text-muted-foreground italic">Motivo: {req.reason}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleRejectDelete(req)}>
                        <X className="h-3.5 w-3.5 mr-1" /> Rechazar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleApproveDelete(req)}>
                        <Check className="h-3.5 w-3.5 mr-1" /> Aprobar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters + View Toggle */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nº factura o concepto..." value={search} onChange={(e) => { setSearch(e.target.value); invoicePagination.resetPage(); }} className="pl-9" />
          </div>
          <ToggleGroup type="single" value={invoiceViewMode} onValueChange={(v) => v && setInvoiceViewMode(v as "list" | "kanban")} className="hidden sm:flex">
            <ToggleGroupItem value="list" aria-label="Vista lista" className="px-2.5">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="kanban" aria-label="Vista kanban" className="px-2.5">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); invoicePagination.resetPage(); }}>
            <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="DRAFT">Borrador</SelectItem>
              <SelectItem value="SENT">Enviada</SelectItem>
              <SelectItem value="PARTIALLY_PAID">Pago parcial</SelectItem>
              <SelectItem value="PAID">Pagada</SelectItem>
              <SelectItem value="OVERDUE">Vencida</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); invoicePagination.resetPage(); }}>
            <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="INVOICE">Factura</SelectItem>
              <SelectItem value="EXPENSE">Gasto</SelectItem>
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full sm:w-[140px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "dd/MM/yy") : "Desde"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); invoicePagination.resetPage(); }} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full sm:w-[140px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "dd/MM/yy") : "Hasta"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); invoicePagination.resetPage(); }} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); invoicePagination.resetPage(); }}>
              <X className="h-4 w-4 mr-1" /> Limpiar
            </Button>
          )}
          {/* Mobile view toggle */}
          <ToggleGroup type="single" value={invoiceViewMode} onValueChange={(v) => v && setInvoiceViewMode(v as "list" | "kanban")} className="sm:hidden">
            <ToggleGroupItem value="list" aria-label="Vista lista" className="px-2.5">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="kanban" aria-label="Vista kanban" className="px-2.5">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {invoiceViewMode === "kanban" ? (
        <InvoiceKanbanView invoices={kanbanInvoices} onPreview={setPreviewInvoice} />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Cargando facturas...</div>
            ) : paginatedInvoices.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No se encontraron facturas</div>
            ) : (
              <>
                {paginatedInvoices.map((inv: any) => (
                  <Card key={inv.id} className="p-4 space-y-2 cursor-pointer active:bg-accent/50" onClick={() => setPreviewInvoice(inv)}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-sm">{inv.invoice_number || inv.id.slice(0, 8).toUpperCase()}</span>
                      <Badge variant="secondary" className={statusColors[inv.status]}>{statusLabels[inv.status] || inv.status}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate">{inv.business_clients?.name || "—"}</span>
                      <span className="font-mono font-semibold">€{Number(inv.amount_total).toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{format(new Date(inv.issue_date), "dd MMM yyyy", { locale: es })}</span>
                      <span>{typeLabels[inv.type] || inv.type}</span>
                    </div>
                    <div className="flex justify-end pt-1 border-t" onClick={(e) => e.stopPropagation()}>
                      <InvoiceActionsMenu
                        onPreview={() => setPreviewInvoice(inv)}
                        onExport={() => handleExportPdf(inv.id)}
                        onEdit={() => setEditInvoice(inv)}
                        onDelete={() => handleDeleteClick(inv)}
                        onSendEmail={inv.business_clients?.email ? () => handleSendEmail(inv.id) : undefined}
                        onReminder={() => setReminderInvoice(inv)}
                      />
                    </div>
                  </Card>
                ))}
                {renderServerPagination(invoicePagination)}
              </>
            )}
          </div>

          {/* Desktop Table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">Cargando facturas...</div>
              ) : paginatedInvoices.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No se encontraron facturas</div>
              ) : (
                <>
                   <div className="overflow-x-auto">
                   <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº</TableHead>
                        <TableHead>F. Emisión</TableHead>
                        <TableHead className="hidden lg:table-cell">F. Pago</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedInvoices.map((inv: any) => (
                        <TableRow key={inv.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setPreviewInvoice(inv)}>
                          <TableCell className="font-mono font-semibold text-sm">
                            {inv.invoice_number || inv.id.slice(0, 8).toUpperCase()}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(inv.issue_date), "dd MMM yyyy", { locale: es })}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground hidden lg:table-cell">
                            {inv.paid_at ? format(new Date(inv.paid_at), "dd MMM yyyy", { locale: es }) : "—"}
                          </TableCell>
                          <TableCell>{inv.business_clients?.name || "—"}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{inv.concept || "—"}</TableCell>
                          <TableCell>{typeLabels[inv.type] || inv.type}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            €{Number(inv.amount_total).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={statusColors[inv.status]}>
                              {statusLabels[inv.status] || inv.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <InvoiceActionsMenu
                              onPreview={() => setPreviewInvoice(inv)}
                              onExport={() => handleExportPdf(inv.id)}
                              onEdit={() => setEditInvoice(inv)}
                              onDelete={() => handleDeleteClick(inv)}
                              onSendEmail={inv.business_clients?.email ? () => handleSendEmail(inv.id) : undefined}
                              onReminder={() => setReminderInvoice(inv)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                  {renderServerPagination(invoicePagination)}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

        </TabsContent>

        <TabsContent value="quotes" className="space-y-6">
          {/* Quote KPIs */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total presupuestado</CardTitle>
                <ClipboardList className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">€{totalQuotes.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Aceptados</CardTitle>
                <Check className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">€{acceptedQuotes.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
                <FileText className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">€{pendingQuotes.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
          </div>

          {/* Quote Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar presupuesto..." value={quoteSearch} onChange={(e) => { setQuoteSearch(e.target.value); quotePagination.resetPage(); }} className="pl-9" />
            </div>
            <Select value={quoteStatusFilter} onValueChange={(v) => { setQuoteStatusFilter(v); quotePagination.resetPage(); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="DRAFT">Borrador</SelectItem>
                <SelectItem value="SENT">Enviado</SelectItem>
                <SelectItem value="ACCEPTED">Aceptado</SelectItem>
                <SelectItem value="REJECTED">Rechazado</SelectItem>
                <SelectItem value="INVOICED">Facturado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quotes Table */}
          <Card>
            <CardContent className="p-0">
              {paginatedQuotes.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No se encontraron presupuestos</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº</TableHead>
                        <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="hidden md:table-cell">Concepto</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedQuotes.map((q: any) => (
                        <TableRow key={q.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setPreviewInvoice(q)}>
                          <TableCell className="font-mono font-semibold text-sm">
                            {q.invoice_number || q.id.slice(0, 8).toUpperCase()}
                          </TableCell>
                          <TableCell className="whitespace-nowrap hidden sm:table-cell">
                            {format(new Date(q.issue_date), "dd MMM yyyy", { locale: es })}
                          </TableCell>
                          <TableCell>{q.business_clients?.name || "—"}</TableCell>
                          <TableCell className="max-w-[200px] truncate hidden md:table-cell">{q.concept || "—"}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            €{Number(q.amount_total).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={statusColors[q.status]}>
                              {statusLabels[q.status] || q.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <InvoiceActionsMenu
                              onPreview={() => setPreviewInvoice(q)}
                              onExport={() => handleExportPdf(q.id)}
                              onEdit={() => setEditInvoice(q)}
                              onDelete={() => handleDeleteClick(q)}
                              onSendEmail={q.business_clients?.email ? () => handleSendEmail(q.id) : undefined}
                              onReminder={() => setReminderInvoice(q)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                  {renderServerPagination(quotePagination)}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recurring">
          <RecurringInvoicesTab accountId={accountId || ""} isManager={isManager} />
        </TabsContent>

        <TabsContent value="reconciliation">
          <BankReconciliationTab />
        </TabsContent>
      </Tabs>

      <CreateInvoiceDialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setCreateDefaultType(undefined); }} defaultType={createDefaultType || (activeTab === "quotes" ? "QUOTE" : undefined)} />
      <InvoicePreviewDialog
        open={!!previewInvoice}
        onOpenChange={() => setPreviewInvoice(null)}
        invoice={previewInvoice}
        onExport={previewInvoice ? () => handleExportPdf(previewInvoice.id) : undefined}
        onSendEmail={previewInvoice?.business_clients?.email ? () => handleSendEmail(previewInvoice.id) : undefined}
        onEdit={previewInvoice ? () => { setPreviewInvoice(null); setEditInvoice(previewInvoice); } : undefined}
      />
      <EditInvoiceDialog
        open={!!editInvoice}
        onOpenChange={() => setEditInvoice(null)}
        invoice={editInvoice}
      />

      {/* Manager: direct delete confirmation */}
      <AlertDialog open={!!deleteInvoice && isManager && !deleteReasonDialog} onOpenChange={(o) => { if (!o) setDeleteInvoice(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente{" "}
              <span className="font-semibold">{deleteInvoice?.invoice_number || ""}</span>.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleManagerDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Employee: request deletion with reason */}
      <Dialog open={deleteReasonDialog} onOpenChange={(o) => { if (!o) { setDeleteReasonDialog(false); setDeleteInvoice(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar eliminación</DialogTitle>
            <DialogDescription>
              Tu solicitud será revisada por un manager antes de que{" "}
              <span className="font-semibold">{deleteInvoice?.invoice_number || ""}</span> sea eliminado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Motivo (opcional)</label>
            <Textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Indica el motivo..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteReasonDialog(false); setDeleteInvoice(null); }}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleEmployeeRequest} disabled={deleting}>
              {deleting ? "Enviando..." : "Enviar solicitud"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {reminderInvoice && (
        <CreateReminderDialog
          open={!!reminderInvoice}
          onOpenChange={(open) => !open && setReminderInvoice(null)}
          defaultEntityType={reminderInvoice.type === "QUOTE" ? "QUOTE" : reminderInvoice.type === "EXPENSE" ? "EXPENSE" : "INVOICE"}
          defaultEntityId={reminderInvoice.id}
          defaultEntityLabel={`${reminderInvoice.invoice_number || ""} — ${reminderInvoice.concept || reminderInvoice.business_clients?.name || ""}`}
        />
      )}
    </div>
  );
};

export default AppInvoices;
