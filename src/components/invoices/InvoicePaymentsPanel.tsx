import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus, CreditCard, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const methodLabels: Record<string, string> = {
  TRANSFER: "Transferencia",
  CASH: "Efectivo",
  CARD: "Tarjeta",
  CHECK: "Cheque",
  OTHER: "Otro",
};

interface Props {
  invoice: any;
  onStatusChanged?: () => void;
}

const InvoicePaymentsPanel = ({ invoice, onStatusChanged }: Props) => {
  const { user, accountId } = useAuth();
  const queryClient = useQueryClient();
  const isManager = true; // Only shown in contexts where user can manage

  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("TRANSFER");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["invoice-payments", invoice?.id],
    queryFn: async () => {
      if (!invoice?.id) return [];
      const { data, error } = await supabase
        .from("invoice_payments" as any)
        .select("*")
        .eq("invoice_id", invoice.id)
        .order("payment_date", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!invoice?.id,
  });

  const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const invoiceTotal = Number(invoice?.amount_total || 0);
  const remaining = Math.max(0, +(invoiceTotal - totalPaid).toFixed(2));
  const paidPercentage = invoiceTotal > 0 ? Math.min(100, (totalPaid / invoiceTotal) * 100) : 0;

  const handleAddPayment = async () => {
    if (!invoice || !user || !accountId) return;
    const payAmount = parseFloat(amount);
    if (!payAmount || payAmount <= 0) {
      toast({ title: "Error", description: "Introduce un importe válido", variant: "destructive" });
      return;
    }
    if (payAmount > remaining + 0.01) {
      toast({ title: "Error", description: "El importe supera el saldo pendiente", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("invoice_payments" as any).insert({
        invoice_id: invoice.id,
        account_id: accountId,
        amount: payAmount,
        payment_date: paymentDate,
        method,
        notes: notes.trim(),
        created_by: user.id,
      } as any);
      if (error) throw error;

      // Calculate new total paid
      const newTotalPaid = totalPaid + payAmount;
      const isFullyPaid = Math.abs(newTotalPaid - invoiceTotal) < 0.01;

      // Update invoice status
      const newStatus = isFullyPaid ? "PAID" : "PARTIALLY_PAID";
      const updatePayload: any = { status: newStatus };
      if (isFullyPaid) {
        updatePayload.paid_at = new Date().toISOString();
      }
      await supabase.from("invoices").update(updatePayload).eq("id", invoice.id);

      toast({ title: isFullyPaid ? "Factura pagada al 100%" : "Pago registrado" });
      queryClient.invalidateQueries({ queryKey: ["invoice-payments", invoice.id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      onStatusChanged?.();

      // Reset form
      setAmount("");
      setNotes("");
      setShowForm(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId: string, paymentAmount: number) => {
    try {
      const { error } = await supabase.from("invoice_payments" as any).delete().eq("id", paymentId);
      if (error) throw error;

      // Recalculate status
      const newTotalPaid = totalPaid - paymentAmount;
      let newStatus = invoice.status;
      if (newTotalPaid <= 0.01) {
        newStatus = "SENT";
      } else if (Math.abs(newTotalPaid - invoiceTotal) < 0.01) {
        newStatus = "PAID";
      } else {
        newStatus = "PARTIALLY_PAID";
      }
      const updatePayload: any = { status: newStatus };
      if (newStatus !== "PAID") {
        updatePayload.paid_at = null;
      }
      await supabase.from("invoices").update(updatePayload).eq("id", invoice.id);

      toast({ title: "Pago eliminado" });
      queryClient.invalidateQueries({ queryKey: ["invoice-payments", invoice.id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      onStatusChanged?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (!invoice || invoice.type === "QUOTE") return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5" /> Pagos
        </Label>
        {remaining > 0 && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Registrar pago
          </Button>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Pagado: €{totalPaid.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
          <span>Pendiente: €{remaining.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${paidPercentage}%`,
              backgroundColor: paidPercentage >= 100 ? "hsl(var(--primary))" : "hsl(var(--accent-foreground) / 0.5)",
            }}
          />
        </div>
        <div className="text-right text-xs font-medium">
          {paidPercentage >= 100 ? (
            <Badge variant="default" className="text-xs">100% Pagado</Badge>
          ) : (
            <span className="text-muted-foreground">{paidPercentage.toFixed(0)}%</span>
          )}
        </div>
      </div>

      {/* Payment form */}
      {showForm && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Importe (€)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                max={remaining}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Máx: ${remaining.toFixed(2)}`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Método</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(methodLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notas</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAddPayment} disabled={submitting}>
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Registrar
            </Button>
          </div>
        </div>
      )}

      {/* Payments list */}
      {payments.length > 0 && (
        <div className="space-y-1.5">
          {payments.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between rounded border bg-background px-3 py-2 text-sm">
              <div className="flex items-center gap-3">
                <span className="font-mono font-semibold text-foreground">
                  €{Number(p.amount).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(p.payment_date), "dd MMM yyyy", { locale: es })}
                </span>
                <Badge variant="outline" className="text-xs">{methodLabels[p.method] || p.method}</Badge>
                {p.notes && <span className="text-xs text-muted-foreground truncate max-w-[120px]">{p.notes}</span>}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeletePayment(p.id, Number(p.amount))}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {isLoading && <div className="text-xs text-muted-foreground text-center py-2">Cargando pagos...</div>}
    </div>
  );
};

export default InvoicePaymentsPanel;
