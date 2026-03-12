import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import InvoiceAttachment from "@/components/invoices/InvoiceAttachment";

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador", SENT: "Enviada", PAID: "Pagada", OVERDUE: "Vencida",
  ACCEPTED: "Aceptado", REJECTED: "Rechazado", INVOICED: "Facturado",
};

const statusFlow: Record<string, string[]> = {
  DRAFT: ["SENT"],
  SENT: ["PAID", "OVERDUE"],
  OVERDUE: ["PAID"],
  PAID: [],
};

const quoteStatusFlow: Record<string, string[]> = {
  DRAFT: ["SENT"],
  SENT: ["ACCEPTED", "REJECTED"],
  ACCEPTED: ["INVOICED"],
  REJECTED: [],
  INVOICED: [],
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any | null;
}

const EditInvoiceDialog = ({ open, onOpenChange, invoice }: Props) => {
  const { accountId } = useAuth();
  const queryClient = useQueryClient();

  const [clientId, setClientId] = useState("");
  const [concept, setConcept] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [vatPercentage, setVatPercentage] = useState("21");
  const [vatIncluded, setVatIncluded] = useState(false);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attachmentPath, setAttachmentPath] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);

  const isDraft = invoice?.status === "DRAFT";
  const isQuote = invoice?.type === "QUOTE";
  const flow = isQuote ? quoteStatusFlow : statusFlow;
  const nextStatuses = flow[invoice?.status || ""] || [];

  useEffect(() => {
    if (invoice && open) {
      setClientId(invoice.client_id || "");
      setConcept(invoice.concept || "");
      setIssueDate(invoice.issue_date || "");
      setAmount(String(invoice.amount_net || ""));
      setVatPercentage(String(invoice.vat_percentage || "21"));
      setVatIncluded(false);
      setStatus(invoice.status || "DRAFT");
      setAttachmentPath(invoice.attachment_path || null);
      setAttachmentName(invoice.attachment_name || null);
    }
  }, [invoice, open]);

  const amountNum = parseFloat(amount) || 0;
  const vatNum = parseFloat(vatPercentage) || 0;
  const amountNet = vatIncluded ? +(amountNum / (1 + vatNum / 100)).toFixed(2) : amountNum;
  const amountVat = +(amountNet * vatNum / 100).toFixed(2);
  const amountTotal = +(amountNet + amountVat).toFixed(2);

  const { data: account } = useQuery({
    queryKey: ["my-account", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("id, name").eq("id", accountId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!accountId && open,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["business_clients", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("business_clients").select("id, name")
        .eq("account_id", accountId).eq("status", "ACTIVE");
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId && open,
  });

  const resolveClientId = async (selectedId: string): Promise<string> => {
    if (!selectedId.startsWith("__self__")) return selectedId;
    const { data: existing } = await supabase
      .from("business_clients").select("id")
      .eq("account_id", accountId!).eq("name", account?.name || "")
      .eq("tax_id", (account as any)?.tax_id || "PROPIA").maybeSingle();
    if (existing) return existing.id;
    const { data: created, error } = await supabase
      .from("business_clients").insert({
        account_id: accountId!, name: account?.name || "Mi empresa",
        tax_id: (account as any)?.tax_id || "PROPIA",
        email: (account as any)?.email || null, status: "ACTIVE",
      }).select("id").single();
    if (error) throw error;
    return created.id;
  };

  const handleSubmit = async () => {
    if (!invoice) return;
    setSubmitting(true);
    try {
      // If quote is being moved to INVOICED, create a new invoice from it
      if (isQuote && status === "INVOICED") {
        // Create invoice copy
        const { error: invErr } = await supabase.from("invoices").insert({
          account_id: invoice.account_id,
          client_id: invoice.client_id,
          type: "INVOICE",
          concept: invoice.concept,
          issue_date: new Date().toISOString().slice(0, 10),
          amount_net: invoice.amount_net,
          vat_percentage: invoice.vat_percentage,
          amount_vat: invoice.amount_vat,
          amount_total: invoice.amount_total,
          attachment_path: invoice.attachment_path,
          attachment_name: invoice.attachment_name,
        } as any);
        if (invErr) throw invErr;
        // Update quote status to INVOICED
        const { error: updErr } = await supabase.from("invoices").update({ status: "INVOICED" }).eq("id", invoice.id);
        if (updErr) throw updErr;
        toast({ title: "Factura creada desde presupuesto" });
        queryClient.invalidateQueries({ queryKey: ["invoices"] });
        onOpenChange(false);
        return;
      }

      const updatePayload: any = { status };

      if (isDraft) {
        if (!clientId || !concept.trim() || !amount) {
          toast({ title: "Error", description: "Completa todos los campos obligatorios", variant: "destructive" });
          setSubmitting(false);
          return;
        }
        const resolvedClientId = await resolveClientId(clientId);
        updatePayload.client_id = resolvedClientId;
        updatePayload.concept = concept.trim();
        updatePayload.issue_date = issueDate;
        updatePayload.amount_net = amountNet;
        updatePayload.vat_percentage = vatNum;
        updatePayload.amount_vat = amountVat;
        updatePayload.amount_total = amountTotal;
      }

      // Always allow attachment changes
      updatePayload.attachment_path = attachmentPath;
      updatePayload.attachment_name = attachmentName;

      const { error } = await supabase.from("invoices").update(updatePayload).eq("id", invoice.id);
      if (error) throw error;

      toast({ title: isQuote ? "Presupuesto actualizado" : "Factura actualizada" });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["business_clients"] });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!invoice) return null;

  const invoiceNumber = invoice.invoice_number || invoice.id.slice(0, 8).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar {invoiceNumber}</DialogTitle>
          <DialogDescription>
            {isDraft
              ? `Puedes modificar todos los campos mientras ${isQuote ? "el presupuesto" : "la factura"} está en borrador.`
              : isQuote && invoice?.status === "ACCEPTED"
                ? "Puedes convertir este presupuesto en factura."
                : `Solo puedes cambiar el estado de ${isQuote ? "este presupuesto" : "esta factura"}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status change section */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Estado</Label>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className="text-sm py-1 px-3">
                {statusLabels[invoice.status]}
              </Badge>
              {nextStatuses.length > 0 && (
                <>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  {nextStatuses.map((s) => (
                    <Button
                      key={s}
                      variant={status === s ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStatus(s)}
                    >
                      {statusLabels[s]}
                    </Button>
                  ))}
                </>
              )}
              {nextStatuses.length === 0 && (
                <span className="text-sm text-muted-foreground">No hay cambios de estado disponibles</span>
              )}
            </div>
          </div>

          <Separator />

          {/* Editable fields (only DRAFT) */}
          {isDraft && (
            <>
              <div className="space-y-2">
                <Label>{invoice?.type === "EXPENSE" ? "Proveedor / Empresa" : "Cliente"}</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Selecciona destinatario" /></SelectTrigger>
                  <SelectContent>
                    {account && (
                      <SelectItem value={`__self__${account.id}`}>
                        🏢 {account.name} (Mi empresa)
                      </SelectItem>
                    )}
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Concepto</Label>
                <Input value={concept} onChange={(e) => setConcept(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Fecha de emisión</Label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{vatIncluded ? "Importe con IVA (€)" : "Importe neto (€)"}</Label>
                  <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>IVA (%)</Label>
                  <Select value={vatPercentage} onValueChange={setVatPercentage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0%</SelectItem>
                      <SelectItem value="4">4%</SelectItem>
                      <SelectItem value="10">10%</SelectItem>
                      <SelectItem value="21">21%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={vatIncluded} onCheckedChange={setVatIncluded} id="edit-vat-included" />
                <Label htmlFor="edit-vat-included" className="text-sm text-muted-foreground cursor-pointer">
                  El importe ya incluye IVA
                </Label>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Base imponible</span>
                  <span className="font-mono">€{amountNet.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>IVA ({vatPercentage}%)</span>
                  <span className="font-mono">€{amountVat.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-base font-semibold text-foreground pt-1 border-t">
                  <span>Total</span>
                  <span className="font-mono">€{amountTotal.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </>
          )}

          {/* Summary for non-draft */}
          {!isDraft && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Concepto</span>
                <span className="font-medium">{invoice.concept || "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-medium">{invoice.business_clients?.name || "—"}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Base imponible</span>
                <span className="font-mono">€{Number(invoice.amount_net).toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IVA ({invoice.vat_percentage}%)</span>
                <span className="font-mono">€{Number(invoice.amount_vat).toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-1 border-t">
                <span>Total</span>
                <span className="font-mono">€{Number(invoice.amount_total).toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}

          {/* Attachment — always editable */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Archivo adjunto</Label>
            <InvoiceAttachment
              accountId={accountId || ""}
              invoiceId={invoice?.id}
              attachmentPath={attachmentPath}
              attachmentName={attachmentName}
              onUploaded={(path, name) => { setAttachmentPath(path); setAttachmentName(name); }}
              onRemoved={() => { setAttachmentPath(null); setAttachmentName(null); }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting || (status === invoice?.status && !isDraft && attachmentPath === (invoice?.attachment_path || null))}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isQuote && status === "INVOICED" ? "Convertir en factura" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditInvoiceDialog;
