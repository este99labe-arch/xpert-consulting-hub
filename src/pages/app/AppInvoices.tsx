import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, TrendingUp, TrendingDown, DollarSign, Plus, Search } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import CreateInvoiceDialog from "@/components/invoices/CreateInvoiceDialog";
import InvoicePreviewDialog from "@/components/invoices/InvoicePreviewDialog";
import EditInvoiceDialog from "@/components/invoices/EditInvoiceDialog";
import InvoiceActionsMenu from "@/components/invoices/InvoiceActionsMenu";

const statusColors: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-primary/10 text-primary",
  PAID: "bg-green-100 text-green-800",
  OVERDUE: "bg-destructive/10 text-destructive",
};

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  PAID: "Pagada",
  OVERDUE: "Vencida",
};

const typeLabels: Record<string, string> = {
  INVOICE: "Factura",
  EXPENSE: "Gasto",
};

const AppInvoices = () => {
  const { accountId } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);
  const [editInvoice, setEditInvoice] = useState<any>(null);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("invoices")
        .select("*, business_clients(name, tax_id, email)")
        .eq("account_id", accountId)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const filtered = invoices.filter((inv: any) => {
    const matchesSearch =
      !search ||
      (inv.business_clients?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (inv.concept || "").toLowerCase().includes(search.toLowerCase()) ||
      (inv.invoice_number || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || inv.status === statusFilter;
    const matchesType = typeFilter === "ALL" || inv.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  // KPIs
  const totalIncome = invoices
    .filter((i: any) => i.type === "INVOICE")
    .reduce((sum: number, i: any) => sum + Number(i.amount_total), 0);
  const totalExpenses = invoices
    .filter((i: any) => i.type === "EXPENSE")
    .reduce((sum: number, i: any) => sum + Number(i.amount_total), 0);
  const totalPaid = invoices
    .filter((i: any) => i.status === "PAID" && i.type === "INVOICE")
    .reduce((sum: number, i: any) => sum + Number(i.amount_total), 0);
  const totalPending = invoices
    .filter((i: any) => i.status !== "PAID" && i.type === "INVOICE")
    .reduce((sum: number, i: any) => sum + Number(i.amount_total), 0);

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
      if (!token) {
        toast({ title: "Error", description: "No estás autenticado", variant: "destructive" });
        return;
      }
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/generate_invoice_pdf`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ invoice_id: invoiceId }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error generando PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, "_blank");
      if (printWindow) {
        printWindow.addEventListener("load", () => {
          printWindow.print();
        });
      }
      toast({ title: "Documento listo para imprimir" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Facturación</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Factura
        </Button>
      </div>

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

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nº factura, cliente o concepto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="DRAFT">Borrador</SelectItem>
            <SelectItem value="SENT">Enviada</SelectItem>
            <SelectItem value="PAID">Pagada</SelectItem>
            <SelectItem value="OVERDUE">Vencida</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="INVOICE">Factura</SelectItem>
            <SelectItem value="EXPENSE">Gasto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando facturas...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No se encontraron facturas</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv: any) => (
                  <TableRow key={inv.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setPreviewInvoice(inv)}>
                    <TableCell className="font-mono font-semibold text-sm">
                      {inv.invoice_number || inv.id.slice(0, 8).toUpperCase()}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(inv.issue_date), "dd MMM yyyy", { locale: es })}
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
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateInvoiceDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <InvoicePreviewDialog
        open={!!previewInvoice}
        onOpenChange={() => setPreviewInvoice(null)}
        invoice={previewInvoice}
        onExport={previewInvoice ? () => handleExportPdf(previewInvoice.id) : undefined}
      />
      <EditInvoiceDialog
        open={!!editInvoice}
        onOpenChange={() => setEditInvoice(null)}
        invoice={editInvoice}
      />
    </div>
  );
};

export default AppInvoices;
