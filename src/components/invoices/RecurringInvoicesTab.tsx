import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, RefreshCw, Pencil, Trash2, Pause, Play } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import DeleteConfirmDialog from "@/components/shared/DeleteConfirmDialog";
import PaginationControls from "@/components/shared/PaginationControls";
import { usePagination } from "@/hooks/use-pagination";

const frequencyLabels: Record<string, string> = {
  MONTHLY: "Mensual",
  QUARTERLY: "Trimestral",
  YEARLY: "Anual",
};

const vatOptions = [
  { value: "0", label: "0% (Exento)" },
  { value: "4", label: "4% (Superreducido)" },
  { value: "10", label: "10% (Reducido)" },
  { value: "21", label: "21% (General)" },
];

interface RecurringInvoicesTabProps {
  accountId: string;
  isManager: boolean;
}

const emptyForm = {
  client_id: "",
  concept: "",
  amount_net: "",
  vat_percentage: "21",
  type: "INVOICE",
  frequency: "MONTHLY",
  next_run_date: new Date().toISOString().split("T")[0],
  is_active: true,
};

const RecurringInvoicesTab = ({ accountId, isManager }: RecurringInvoicesTabProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [vatIncluded, setVatIncluded] = useState(false);

  const { data: recurring = [], isLoading } = useQuery({
    queryKey: ["recurring-invoices", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_invoices")
        .select("*, business_clients(name)")
        .eq("account_id", accountId)
        .order("next_run_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["business-clients", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_clients")
        .select("id, name")
        .eq("account_id", accountId)
        .eq("status", "ACTIVE")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const pagination = usePagination(recurring);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setVatIncluded(false);
    setDialogOpen(true);
  };

  const openEdit = (r: any) => {
    setEditingId(r.id);
    setForm({
      client_id: r.client_id,
      concept: r.concept,
      amount_net: String(r.amount_net),
      vat_percentage: String(r.vat_percentage),
      type: r.type,
      frequency: r.frequency,
      next_run_date: r.next_run_date,
      is_active: r.is_active,
    });
    setVatIncluded(false);
    setDialogOpen(true);
  };

  const computeAmounts = () => {
    const net = parseFloat(form.amount_net) || 0;
    const vatPct = parseFloat(form.vat_percentage) || 0;
    if (vatIncluded) {
      const realNet = net / (1 + vatPct / 100);
      const vat = net - realNet;
      return { amount_net: +realNet.toFixed(2), amount_vat: +vat.toFixed(2), amount_total: +net.toFixed(2) };
    }
    const vat = +(net * vatPct / 100).toFixed(2);
    return { amount_net: +net.toFixed(2), amount_vat: vat, amount_total: +(net + vat).toFixed(2) };
  };

  const handleSave = async () => {
    if (!form.client_id || !form.amount_net || !form.next_run_date) {
      toast({ title: "Error", description: "Completa los campos obligatorios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const amounts = computeAmounts();
      const payload = {
        account_id: accountId,
        client_id: form.client_id,
        concept: form.concept,
        ...amounts,
        vat_percentage: parseFloat(form.vat_percentage),
        type: form.type,
        frequency: form.frequency,
        next_run_date: form.next_run_date,
        is_active: form.is_active,
        created_by: user!.id,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase.from("recurring_invoices").update(payload).eq("id", editingId);
        if (error) throw error;
        toast({ title: "Plantilla actualizada" });
      } else {
        const { error } = await supabase.from("recurring_invoices").insert(payload);
        if (error) throw error;
        toast({ title: "Plantilla creada" });
      }
      queryClient.invalidateQueries({ queryKey: ["recurring-invoices"] });
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from("recurring_invoices").delete().eq("id", deleteId);
      if (error) throw error;
      toast({ title: "Plantilla eliminada" });
      queryClient.invalidateQueries({ queryKey: ["recurring-invoices"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase.from("recurring_invoices").update({ is_active: !current, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      toast({ title: !current ? "Plantilla activada" : "Plantilla pausada" });
      queryClient.invalidateQueries({ queryKey: ["recurring-invoices"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleProcessNow = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No autenticado");
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/process_recurring_invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ account_id: accountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error procesando");
      toast({ title: "Facturas generadas", description: `${data.generated} factura(s) generada(s)` });
      queryClient.invalidateQueries({ queryKey: ["recurring-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const fmtMoney = (n: number) => `€${Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2 })}`;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Facturas recurrentes</CardTitle>
          <div className="flex gap-2">
            {isManager && (
              <Button variant="outline" size="sm" onClick={handleProcessNow}>
                <RefreshCw className="h-4 w-4 mr-1" /> Generar ahora
              </Button>
            )}
            {isManager && (
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" /> Nueva plantilla
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Cargando...</p>
          ) : recurring.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No hay facturas recurrentes configuradas</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Frecuencia</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Próxima</TableHead>
                    <TableHead>Estado</TableHead>
                    {isManager && <TableHead className="text-right">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.paginatedItems.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.business_clients?.name || "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.concept || "—"}</TableCell>
                      <TableCell>{r.type === "INVOICE" ? "Factura" : "Gasto"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{frequencyLabels[r.frequency] || r.frequency}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">{fmtMoney(r.amount_total)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(r.next_run_date), "dd MMM yyyy", { locale: es })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.is_active ? "default" : "secondary"}>
                          {r.is_active ? "Activa" : "Pausada"}
                        </Badge>
                      </TableCell>
                      {isManager && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActive(r.id, r.is_active)}>
                              {r.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(r.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="pt-4">
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
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar plantilla" : "Nueva plantilla recurrente"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Modifica los datos de la factura recurrente." : "Configura una factura que se generará automáticamente."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cliente *</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Concepto</Label>
              <Input value={form.concept} onChange={(e) => setForm({ ...form, concept: e.target.value })} placeholder="Servicio mensual..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INVOICE">Factura</SelectItem>
                    <SelectItem value="EXPENSE">Gasto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Frecuencia</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Mensual</SelectItem>
                    <SelectItem value="QUARTERLY">Trimestral</SelectItem>
                    <SelectItem value="YEARLY">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Importe *</Label>
                <Input type="number" step="0.01" value={form.amount_net} onChange={(e) => setForm({ ...form, amount_net: e.target.value })} placeholder="0.00" />
              </div>
              <div>
                <Label>IVA</Label>
                <Select value={form.vat_percentage} onValueChange={(v) => setForm({ ...form, vat_percentage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {vatOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={vatIncluded} onCheckedChange={setVatIncluded} id="vat-incl" />
              <Label htmlFor="vat-incl" className="text-sm text-muted-foreground">IVA incluido en el importe</Label>
            </div>
            <div>
              <Label>Próxima fecha de generación *</Label>
              <Input type="date" value={form.next_run_date} onChange={(e) => setForm({ ...form, next_run_date: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : editingId ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <DeleteConfirmDialog
        open={!!deleteId}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        title="¿Eliminar esta plantilla?"
        description="Se eliminará la plantilla recurrente. Las facturas ya generadas no se verán afectadas."
      />
    </>
  );
};

export default RecurringInvoicesTab;
