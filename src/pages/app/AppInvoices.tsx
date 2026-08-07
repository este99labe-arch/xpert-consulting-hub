import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_PROJECT_ID } from "@/integrations/supabase/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
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
import { FileText, TrendingUp, TrendingDown, DollarSign, Plus, Search, Trash2, Check, X, RefreshCw, ClipboardList, CalendarIcon, List, LayoutGrid, FolderTree, Landmark, Upload, ShieldCheck, Eye } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import CreateReminderDialog from "@/components/reminders/CreateReminderDialog";
import { format, subDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import CreateInvoiceDialog from "@/components/invoices/CreateInvoiceDialog";
import EmptyState from "@/components/shared/EmptyState";
import TableSkeleton from "@/components/shared/TableSkeleton";
import InvoicePreviewDialog from "@/components/invoices/InvoicePreviewDialog";
import EditInvoiceDialog from "@/components/invoices/EditInvoiceDialog";
import InvoiceActionsMenu from "@/components/invoices/InvoiceActionsMenu";
import RecurringInvoicesTab from "@/components/invoices/RecurringInvoicesTab";
import PaginationControls from "@/components/shared/PaginationControls";
import { useServerPagination } from "@/hooks/use-server-pagination";
import { usePagination } from "@/hooks/use-pagination";
import { dispatchWebhook } from "@/lib/webhooks";
import { registrarFacturaVerifactu } from "@/lib/verifactu.service";
import InvoiceKanbanView from "@/components/invoices/InvoiceKanbanView";
import InvoiceFolderView from "@/components/invoices/InvoiceFolderView";
import BankReconciliationTab from "@/components/invoices/BankReconciliationTab";
import InvoiceImportTab from "@/components/invoices/InvoiceImportTab";
import PageHeader from "@/components/shared/PageHeader";
import { markInvoicePaid, reopenInvoice, setInvoiceStatus, convertQuoteToInvoice, INVOICE_STATUS_LABELS } from "@/lib/invoiceStatus";
import { fmtEUR } from "@/lib/format";
import InvoiceDetailView from "@/components/invoices/InvoiceDetailView";

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador", SENT: "Enviada", PAID: "Pagada", PARTIALLY_PAID: "Pago parcial", OVERDUE: "Vencida",
  ACCEPTED: "Aceptado", REJECTED: "Rechazado", INVOICED: "Facturado",
};

/** Pestañas de estado de la barra de filtros. El contador toma el color del
 *  estado que cuenta: en vencidas informa de un problema, en pagadas no. */
const STATUS_TABS = [
  { value: "ALL", label: "Todas", countClass: "text-subtle" },
  { value: "OVERDUE", label: "Vencidas", countClass: "text-destructive-text" },
  { value: "SENT", label: "Pendientes", countClass: "text-warning-text" },
  { value: "PAID", label: "Pagadas", countClass: "text-success" },
];

/** Vencida = pendiente de cobro y pasada su fecha de vencimiento. */
const isOverdue = (inv: any): boolean =>
  ["SENT", "PARTIALLY_PAID"].includes(inv.status) &&
  !!inv.due_date &&
  inv.due_date < format(new Date(), "yyyy-MM-dd");

const typeLabels: Record<string, string> = {
  INVOICE: "Factura", EXPENSE: "Gasto", QUOTE: "Presupuesto",
};

/* El estado se pinta con las variantes del sistema, no con fondos al 10 %:
   así una factura vencida se ve igual en el listado, en el kanban y en el
   menú de acciones, y basta con tocar badge.tsx para cambiarlas todas. */
const STATUS_VARIANT: Record<string, "success" | "softDestructive" | "warning" | "info" | "muted"> = {
  DRAFT: "muted",
  SENT: "info",
  PAID: "success",
  PARTIALLY_PAID: "warning",
  OVERDUE: "softDestructive",
  ACCEPTED: "success",
  REJECTED: "softDestructive",
  INVOICED: "info",
  CANCELLED: "muted",
};

const StatusBadge = ({ status }: { status: string }) => (
  <Badge variant={STATUS_VARIANT[status] ?? "muted"}>{statusLabels[status] || status}</Badge>
);

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
  const [invoiceViewMode, setInvoiceViewMode] = useState<"list" | "kanban" | "folders">("list");

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

  const [reopenTarget, setReopenTarget] = useState<any>(null);

  /* Factura abierta a página completa. Sustituye al diálogo como forma de
     VER una factura; editar sigue abriendo el diálogo. */
  const [detailInvoice, setDetailInvoice] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
        .select("*, business_clients(name, tax_id, email, address)", { count: "exact" })
        .eq("account_id", accountId)
        .neq("type", "QUOTE")
        .order("issue_date", { ascending: false });

      if (debouncedSearch) {
        query = query.or(`concept.ilike.%${debouncedSearch}%,invoice_number.ilike.%${debouncedSearch}%`);
      }
      if (statusFilter === "OVERDUE") {
        // Vencida = pendiente de cobro y pasada su fecha de vencimiento
        query = query.in("status", ["SENT", "PARTIALLY_PAID"]).lt("due_date", format(new Date(), "yyyy-MM-dd"));
      } else if (statusFilter !== "ALL") {
        query = query.eq("status", statusFilter);
      }
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

  /* Contadores de las pestañas. Van en su propia consulta ligera porque la
     lista está paginada en servidor y contar sobre la página daría un número
     que cambia al pasar de página. */
  const { data: statusCounts = {} } = useQuery({
    queryKey: ["invoice-status-counts", accountId, typeFilter],
    queryFn: async (): Promise<Record<string, number>> => {
      if (!accountId) return {};
      let q = supabase.from("invoices").select("status, due_date").eq("account_id", accountId).neq("type", "QUOTE");
      if (typeFilter !== "ALL") q = q.eq("type", typeFilter);
      const { data, error } = await q;
      if (error) throw error;
      const rows = data || [];
      return {
        ALL: rows.length,
        OVERDUE: rows.filter(isOverdue).length,
        SENT: rows.filter((r: any) => ["SENT", "PARTIALLY_PAID"].includes(r.status) && !isOverdue(r)).length,
        PAID: rows.filter((r: any) => r.status === "PAID").length,
      };
    },
    enabled: !!accountId,
  });

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const allSelected = paginatedInvoices.length > 0 && paginatedInvoices.every((i: any) => selectedIds.has(i.id));
  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(paginatedInvoices.map((i: any) => i.id)));

  const pageTotals = paginatedInvoices.reduce(
    (acc: { net: number; total: number }, i: any) => ({
      net: acc.net + Number(i.amount_net || 0),
      total: acc.total + Number(i.amount_total || 0),
    }),
    { net: 0, total: 0 },
  );

  /** Recordatorio a todas las seleccionadas que tengan email de cliente. */
  const handleBatchReminder = async () => {
    const targets = paginatedInvoices.filter((i: any) => selectedIds.has(i.id) && i.business_clients?.email);
    if (targets.length === 0) {
      toast({ title: "Ninguna seleccionada tiene email de cliente", variant: "destructive" });
      return;
    }
    for (const inv of targets) await handleSendEmail(inv.id);
    setSelectedIds(new Set());
  };

  const handleBatchCancel = async () => {
    const ids = paginatedInvoices.filter((i: any) => selectedIds.has(i.id)).map((i: any) => i.id);
    try {
      for (const id of ids) await setInvoiceStatus(id, "CANCELLED");
      toast({ title: `${ids.length} anulada${ids.length === 1 ? "" : "s"}` });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-status-counts"] });
      setSelectedIds(new Set());
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Server-side paginated query for quotes
  const { data: quoteResult } = useQuery({
    queryKey: ["quotes", accountId, quotePagination.currentPage, quotePagination.pageSize, debouncedQuoteSearch, quoteStatusFilter],
    queryFn: async () => {
      if (!accountId) return { data: [], count: 0 };
      let query = supabase
        .from("invoices")
        .select("*, business_clients(name, tax_id, email, address)", { count: "exact" })
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
      if (statusFilter === "OVERDUE") {
        query = query.in("status", ["SENT", "PARTIALLY_PAID"]).lt("due_date", format(new Date(), "yyyy-MM-dd"));
      } else if (statusFilter !== "ALL") {
        query = query.eq("status", statusFilter);
      }
      if (typeFilter !== "ALL") query = query.eq("type", typeFilter);
      if (dateFrom) query = query.gte("issue_date", format(dateFrom, "yyyy-MM-dd"));
      if (dateTo) query = query.lte("issue_date", format(dateTo, "yyyy-MM-dd"));

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId && invoiceViewMode !== "list",
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
    { label: "Facturado", value: `€${totalIncome.toLocaleString("es-ES", { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: "text-accent-foreground", bg: "bg-primary/10" },
    { label: "Gastos", value: `€${totalExpenses.toLocaleString("es-ES", { minimumFractionDigits: 2 })}`, icon: TrendingDown, color: "text-destructive", bg: "bg-destructive-surface" },
    { label: "Cobrado", value: `€${totalPaid.toLocaleString("es-ES", { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-[hsl(var(--success))]", bg: "bg-success-foreground" },
    { label: "Pendiente", value: `€${totalPending.toLocaleString("es-ES", { minimumFractionDigits: 2 })}`, icon: FileText, color: "text-[hsl(var(--warning))]", bg: "bg-warning-surface" },
  ];

  const handleExportPdf = async (invoiceId: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { toast({ title: "Error", description: "No estás autenticado", variant: "destructive" }); return; }
      const projectId = SUPABASE_PROJECT_ID;
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
      const projectId = SUPABASE_PROJECT_ID;
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

  const handleRegisterVerifactu = async (inv: any) => {
    toast({ title: "Registrando en la AEAT…", description: `Factura ${inv.invoice_number || ""}` });
    try {
      const res = await registrarFacturaVerifactu(inv.id);
      if (res.status === "SENT") {
        toast({ title: "Factura registrada", description: res.csv ? `CSV: ${res.csv}` : "Registrada en VERI*FACTU" });
        if (accountId) dispatchWebhook(accountId, "invoice.verifactu_registered", { invoice_id: inv.id, csv: res.csv });
      } else if (res.status === "PREPARED") {
        toast({ title: "Registro preparado", description: res.message || "Pendiente de configurar el certificado para enviarlo a la AEAT." });
      } else {
        toast({ title: "Error al registrar", description: res.error || "La AEAT rechazó el registro", variant: "destructive" });
      }
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices-kanban"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  /** Cambia el estado desde el menú de Acciones del listado. */
  const handleChangeStatus = async (inv: any, status: string) => {
    try {
      await setInvoiceStatus(inv.id, status);
      toast({ title: `Estado: ${INVOICE_STATUS_LABELS[status] ?? status}` });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  /** Registra el cobro pendiente (genera el asiento) y la deja pagada. */
  const handleMarkPaid = async (inv: any) => {
    if (!accountId || !user) return;
    try {
      await markInvoicePaid(inv, accountId, user.id);
      toast({ title: "Factura marcada como pagada", description: "Cobro registrado y contabilizado." });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["treasury-balance"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleReopen = async () => {
    const inv = reopenTarget;
    if (!inv) return;
    try {
      await reopenInvoice(inv.id);
      setReopenTarget(null);
      toast({ title: "Factura reabierta", description: "Se han eliminado los cobros y su asiento." });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["treasury-balance"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleConvertQuote = async (quote: any) => {
    try {
      await convertQuoteToInvoice(quote);
      toast({ title: "Factura creada desde presupuesto", description: "La encontrarás como borrador en Facturas." });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

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

  if (detailInvoice) {
    return (
      <InvoiceDetailView
        invoice={detailInvoice}
        onBack={() => setDetailInvoice(null)}
        onEdit={() => setEditInvoice(detailInvoice)}
        onExport={() => handleExportPdf(detailInvoice.id)}
        onSendEmail={detailInvoice.business_clients?.email ? () => handleSendEmail(detailInvoice.id) : undefined}
        onMarkPaid={() => handleMarkPaid(detailInvoice)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Facturación"
        description="Gestiona facturas, presupuestos, gastos y cobros"
      />

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
            <TabsTrigger value="import">
              <Upload className="h-4 w-4 mr-1" /> Importar
            </TabsTrigger>
          </TabsList>
          <Button onClick={() => setDialogOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" /> {activeTab === "quotes" ? "Nuevo presupuesto" : "Nuevo"}
          </Button>
        </div>

        <TabsContent value="invoices" className="space-y-4">

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="px-[18px] py-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="truncate text-[10.5px] font-medium text-muted-foreground">{kpi.label}</span>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-muted">
                <kpi.icon className="h-3.5 w-3.5 stroke-[1.8] text-faint" />
              </div>
            </div>
            <p className={`tnum text-[22px] font-semibold tracking-[-.02em] ${kpi.color}`}>{kpi.value}</p>
          </Card>
        ))}
      </div>

      {/* Pending delete requests (managers) */}
      {isManager && deleteRequests.length > 0 && (
        <Card tone="warning">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-warning-text" />
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
                        <span className="font-mono text-xs font-semibold">{inv?.invoice_number || "—"}</span>
                        <Badge variant="outline" className="text-xs">
                          {inv?.type === "INVOICE" ? "Factura" : "Gasto"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
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

      {/* ── Barra de filtros ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Pestañas de estado con contador */}
        <div className="inline-flex items-center gap-1 rounded-[9px] border border-input bg-muted p-[3px]">
          {STATUS_TABS.map((t) => {
            const active = statusFilter === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => { setStatusFilter(t.value); invoicePagination.resetPage(); }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-chip px-2.5 py-[5px] text-[11.5px] transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/[.16]",
                  active
                    ? "bg-[hsl(var(--border-strong))] font-semibold text-foreground"
                    : "font-medium text-subtle hover:text-foreground",
                )}
              >
                {t.label}
                {statusCounts[t.value] != null && (
                  <span className={cn("tnum text-[11px]", t.countClass)}>{statusCounts[t.value]}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative w-[220px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.8] text-faint" />
          <Input
            placeholder="Buscar por nº o cliente"
            value={search}
            onChange={(e) => { setSearch(e.target.value); invoicePagination.resetPage(); }}
            className="pl-8"
          />
        </div>

        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); invoicePagination.resetPage(); }}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los tipos</SelectItem>
            <SelectItem value="INVOICE">Factura</SelectItem>
            <SelectItem value="EXPENSE">Gasto</SelectItem>
          </SelectContent>
        </Select>

        {/* Rango de fechas como chip descartable */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-1.5">
              <CalendarIcon />
              {dateFrom || dateTo
                ? `${dateFrom ? format(dateFrom, "d MMM", { locale: es }) : "…"} – ${dateTo ? format(dateTo, "d MMM yyyy", { locale: es }) : "…"}`
                : "Fechas"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex">
              <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); invoicePagination.resetPage(); }} />
              <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); invoicePagination.resetPage(); }} />
            </div>
          </PopoverContent>
        </Popover>
        {(dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => { setDateFrom(undefined); setDateTo(undefined); invoicePagination.resetPage(); }}
            className="inline-flex items-center gap-1.5 rounded-chip border border-info-border bg-accent px-2 py-[5px] text-[11px] text-info-text transition-colors hover:border-primary"
          >
            Rango activo
            <X className="h-3 w-3 stroke-[2] text-accent-foreground" />
          </button>
        )}

        {/* Acciones por lote: solo aparecen con algo seleccionado */}
        {selectedIds.size > 0 && (
          <div className="flex h-[30px] items-center gap-2.5 rounded-control border border-row-selected-border bg-row-selected px-2.5">
            <span className="tnum text-[11px] font-semibold text-accent-foreground">
              {selectedIds.size} seleccionada{selectedIds.size === 1 ? "" : "s"}
            </span>
            <span className="h-3.5 w-px bg-row-selected-border" aria-hidden />
            <button
              type="button"
              onClick={handleBatchReminder}
              className="text-[11px] font-medium text-foreground transition-colors hover:text-accent-foreground"
            >
              Enviar recordatorio
            </button>
            <button
              type="button"
              onClick={handleBatchCancel}
              className="text-[11px] font-medium text-destructive-text transition-colors hover:text-destructive"
            >
              Anular
            </button>
          </div>
        )}

        <ToggleGroup
          type="single"
          value={invoiceViewMode}
          onValueChange={(v) => v && setInvoiceViewMode(v as "list" | "kanban" | "folders")}
          className="ml-auto"
        >
          <ToggleGroupItem value="list" aria-label="Vista lista" className="px-2.5"><List className="h-4 w-4" /></ToggleGroupItem>
          <ToggleGroupItem value="kanban" aria-label="Vista kanban" className="px-2.5"><LayoutGrid className="h-4 w-4" /></ToggleGroupItem>
          <ToggleGroupItem value="folders" aria-label="Vista carpetas" className="px-2.5"><FolderTree className="h-4 w-4" /></ToggleGroupItem>
        </ToggleGroup>
      </div>

      {invoiceViewMode === "kanban" ? (
        <InvoiceKanbanView invoices={kanbanInvoices} onPreview={setDetailInvoice} />
      ) : invoiceViewMode === "folders" ? (
        <InvoiceFolderView invoices={kanbanInvoices} onPreview={setDetailInvoice} />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {isLoading ? (
              <TableSkeleton rows={5} columns={3} />
            ) : paginatedInvoices.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No se encontraron facturas"
                description="Crea tu primera factura o ajusta los filtros de búsqueda."
                actionLabel="Nueva factura"
                onAction={() => { setCreateDefaultType("INVOICE"); setDialogOpen(true); }}
              />
            ) : (
              <>
                {paginatedInvoices.map((inv: any) => (
                  <Card key={inv.id} className="cursor-pointer space-y-2 px-[18px] py-4 active:bg-popover" onClick={() => setDetailInvoice(inv)}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-xs">{inv.invoice_number || inv.id.slice(0, 8).toUpperCase()}</span>
                      <StatusBadge status={inv.status} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate">{inv.business_clients?.name || "—"}</span>
                      <span className="font-mono font-semibold">€{Number(inv.amount_total).toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{format(new Date(inv.issue_date), "dd MMM yyyy", { locale: es })}</span>
                      <span>{typeLabels[inv.type] || inv.type}</span>
                    </div>
                    <div className="flex justify-end pt-1 border-t" onClick={(e) => e.stopPropagation()}>
                      <InvoiceActionsMenu
                        status={inv.status}
                        onChangeStatus={(st) => handleChangeStatus(inv, st)}
                        onMarkPaid={inv.status !== "PAID" ? () => handleMarkPaid(inv) : undefined}
                        onReopen={inv.status === "PAID" ? () => setReopenTarget(inv) : undefined}
                        onPreview={() => setPreviewInvoice(inv)}
                        onExport={() => handleExportPdf(inv.id)}
                        onEdit={() => setEditInvoice(inv)}
                        onDelete={() => handleDeleteClick(inv)}
                        onSendEmail={inv.business_clients?.email ? () => handleSendEmail(inv.id) : undefined}
                        onReminder={() => setReminderInvoice(inv)}
                        onRegisterVerifactu={inv.type === "INVOICE" ? () => handleRegisterVerifactu(inv) : undefined}
                        verifactuStatus={inv.verifactu_status}
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
                <TableSkeleton rows={8} columns={6} />
              ) : paginatedInvoices.length === 0 ? (
                <EmptyState
                  bare
                  icon={FileText}
                  title="No se encontraron facturas"
                  description="Crea tu primera factura o ajusta los filtros de búsqueda."
                  actionLabel="Nueva factura"
                  onAction={() => { setCreateDefaultType("INVOICE"); setDialogOpen(true); }}
                />
              ) : (
                <>
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[34px] pr-0">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Seleccionar todas"
                          />
                        </TableHead>
                        <TableHead className="w-[118px]">Nº</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="w-[116px] text-right">Base</TableHead>
                        <TableHead className="w-[108px] text-right">Total</TableHead>
                        <TableHead className="w-[100px] text-right">Vence</TableHead>
                        <TableHead className="w-[106px]">Estado</TableHead>
                        <TableHead className="w-[52px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedInvoices.map((inv: any) => {
                        const overdue = isOverdue(inv);
                        const selected = selectedIds.has(inv.id);
                        return (
                          <TableRow
                            key={inv.id}
                            data-state={selected ? "selected" : undefined}
                            className="cursor-pointer"
                            onClick={() => setDetailInvoice(inv)}
                          >
                            <TableCell className="pr-0" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selected}
                                onCheckedChange={() => toggleSelect(inv.id)}
                                aria-label={`Seleccionar ${inv.invoice_number || "factura"}`}
                              />
                            </TableCell>
                            <TableCell className="tnum text-muted-foreground">
                              {inv.invoice_number || inv.id.slice(0, 8).toUpperCase()}
                            </TableCell>
                            <TableCell className="max-w-0 truncate text-foreground">
                              {inv.business_clients?.name || <span className="text-muted-foreground">Sin cliente asignado</span>}
                            </TableCell>
                            <TableCell className="tnum text-right text-muted-foreground">
                              {Number(inv.amount_net).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="tnum text-right font-medium text-figure">
                              {fmtEUR(inv.amount_total)}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "tnum whitespace-nowrap text-right",
                                overdue ? "text-destructive-text"
                                  : inv.status === "PAID" ? "text-faint"
                                  : "text-warning-text",
                              )}
                            >
                              {inv.status === "PAID" || !inv.due_date
                                ? <span className="text-faint">—</span>
                                : format(new Date(inv.due_date), "dd MMM", { locale: es })}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <StatusBadge status={overdue ? "OVERDUE" : inv.status} />
                                {inv.verifactu_status === "SENT" && (
                                  <span title="Registrada en la AEAT (VERI*FACTU)">
                                    <ShieldCheck className="h-3.5 w-3.5 text-success" />
                                  </span>
                                )}
                                {inv.verifactu_status === "PREPARED" && (
                                  <span title="Preparada para VERI*FACTU (pendiente de envío)">
                                    <ShieldCheck className="h-3.5 w-3.5 text-warning-text" />
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <InvoiceActionsMenu
                                status={inv.status}
                                onChangeStatus={(st) => handleChangeStatus(inv, st)}
                                onMarkPaid={inv.status !== "PAID" ? () => handleMarkPaid(inv) : undefined}
                                onReopen={inv.status === "PAID" ? () => setReopenTarget(inv) : undefined}
                                onPreview={() => setPreviewInvoice(inv)}
                                onExport={() => handleExportPdf(inv.id)}
                                onEdit={() => setEditInvoice(inv)}
                                onDelete={() => handleDeleteClick(inv)}
                                onSendEmail={inv.business_clients?.email ? () => handleSendEmail(inv.id) : undefined}
                                onReminder={() => setReminderInvoice(inv)}
                                onRegisterVerifactu={inv.type === "INVOICE" ? () => handleRegisterVerifactu(inv) : undefined}
                                verifactuStatus={inv.verifactu_status}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    {/* Pie de totales de la página */}
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={3} className="text-[11.5px] text-muted-foreground">
                          Total página · <span className="tnum">{paginatedInvoices.length}</span> de{" "}
                          <span className="tnum">{invoiceResult?.count ?? 0}</span>
                        </TableCell>
                        <TableCell className="tnum text-right text-muted-foreground">
                          {pageTotals.net.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="tnum text-right text-figure">{fmtEUR(pageTotals.total)}</TableCell>
                        <TableCell colSpan={3} />
                      </TableRow>
                    </TableFooter>
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

        <TabsContent value="quotes" className="space-y-4">
          {/* Quote KPIs */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            {[
              { label: "Total presupuestado", value: totalQuotes, icon: ClipboardList, color: "text-figure" },
              { label: "Aceptados", value: acceptedQuotes, icon: Check, color: "text-success" },
              { label: "Pendientes", value: pendingQuotes, icon: FileText, color: "text-warning-text" },
            ].map((kpi) => (
              <Card key={kpi.label} className="px-[18px] py-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate text-[10.5px] font-medium text-muted-foreground">{kpi.label}</span>
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-muted">
                    <kpi.icon className="h-3.5 w-3.5 stroke-[1.8] text-faint" />
                  </div>
                </div>
                <p className={`tnum text-[22px] font-semibold tracking-[-.02em] ${kpi.color}`}>
                  €{kpi.value.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                </p>
              </Card>
            ))}
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
                        <TableRow key={q.id} className="cursor-pointer" onClick={() => setEditInvoice(q)}>
                          <TableCell className="font-mono font-semibold text-xs">
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
                            <StatusBadge status={q.status} />
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-0.5">
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Vista previa" onClick={() => setPreviewInvoice(q)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <InvoiceActionsMenu
                              status={q.status}
                              isQuote
                              onChangeStatus={(st) => handleChangeStatus(q, st)}
                              onConvertToInvoice={q.status === "ACCEPTED" ? () => handleConvertQuote(q) : undefined}
                              onPreview={() => setPreviewInvoice(q)}
                              onExport={() => handleExportPdf(q.id)}
                              onEdit={() => setEditInvoice(q)}
                              onDelete={() => handleDeleteClick(q)}
                              onSendEmail={q.business_clients?.email ? () => handleSendEmail(q.id) : undefined}
                              onReminder={() => setReminderInvoice(q)}
                            />
                            </div>
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

        <TabsContent value="import">
          <InvoiceImportTab />
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
        onRegisterVerifactu={previewInvoice?.type === "INVOICE" ? () => handleRegisterVerifactu(previewInvoice) : undefined}
      />
      <EditInvoiceDialog
        open={!!editInvoice}
        onOpenChange={() => setEditInvoice(null)}
        invoice={editInvoice}
        onPreview={editInvoice ? () => { const cur = editInvoice; setEditInvoice(null); setPreviewInvoice(cur); } : undefined}
      />

      {/* Manager: direct delete confirmation */}
      <AlertDialog open={!!reopenTarget} onOpenChange={(o) => { if (!o) setReopenTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reabrir esta factura?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán los cobros registrados y, con ellos, su asiento contable: el
              importe saldrá de tesorería y la factura volverá a "Enviada". Es la forma
              correcta de deshacer un cobro, pero no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleReopen}
            >
              Reabrir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <label className="text-xs font-medium">Motivo (opcional)</label>
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
