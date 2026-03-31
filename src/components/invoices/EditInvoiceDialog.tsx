import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowRight, Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import InvoiceAttachment from "@/components/invoices/InvoiceAttachment";
import InvoicePaymentsPanel from "@/components/invoices/InvoicePaymentsPanel";

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador", SENT: "Enviada", PAID: "Pagada", PARTIALLY_PAID: "Pago parcial", OVERDUE: "Vencida",
  ACCEPTED: "Aceptado", REJECTED: "Rechazado", INVOICED: "Facturado",
};

const allInvoiceStatuses = ["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"];
const allQuoteStatuses = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "INVOICED", "CANCELLED"];

interface LineInput { description: string; quantity: string; unitPrice: string; }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any | null;
}

const EditInvoiceDialog = ({ open, onOpenChange, invoice }: Props) => {
  const { accountId } = useAuth();
  const queryClient = useQueryClient();

  const [clientId, setClientId] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [operationDate, setOperationDate] = useState("");
  const [vatPercentage, setVatPercentage] = useState("21");
  const [irpfPercentage, setIrpfPercentage] = useState("0");
  const [specialMentions, setSpecialMentions] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attachmentPath, setAttachmentPath] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [lines, setLines] = useState<LineInput[]>([{ description: "", quantity: "1", unitPrice: "" }]);

  const isDraft = invoice?.status === "DRAFT";
  const isQuote = invoice?.type === "QUOTE";
  const allStatuses = isQuote ? allQuoteStatuses : allInvoiceStatuses;
  const nextStatuses = allStatuses.filter((s) => s !== invoice?.status);

  // Load invoice lines
  const { data: existingLines = [] } = useQuery({
    queryKey: ["invoice-lines", invoice?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_lines")
        .select("*")
        .eq("invoice_id", invoice!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!invoice?.id && open,
  });

  useEffect(() => {
    if (invoice && open) {
      setClientId(invoice.client_id || "");
      setIssueDate(invoice.issue_date || "");
      setOperationDate(invoice.operation_date || "");
      setVatPercentage(String(invoice.vat_percentage || "21"));
      setIrpfPercentage(String(invoice.irpf_percentage || "0"));
      setSpecialMentions(invoice.special_mentions || "");
      setStatus(invoice.status || "DRAFT");
      setAttachmentPath(invoice.attachment_path || null);
      setAttachmentName(invoice.attachment_name || null);
    }
  }, [invoice, open]);

  // Populate lines from existing data
  useEffect(() => {
    if (existingLines.length > 0 && open) {
      setLines(existingLines.map((l: any) => ({
        description: l.description || "",
        quantity: String(l.quantity || 1),
        unitPrice: String(l.unit_price || 0),
      })));
    } else if (invoice && open && existingLines.length === 0) {
      // Fallback for old invoices without lines
      setLines([{
        description: invoice.concept || "",
        quantity: "1",
        unitPrice: String(invoice.amount_net || ""),
      }]);
    }
  }, [existingLines, invoice, open]);

  const vatNum = parseFloat(vatPercentage) || 0;
  const irpfNum = parseFloat(irpfPercentage) || 0;
  const lineAmounts = lines.map(l => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.unitPrice) || 0;
    return +(qty * price).toFixed(2);
  });
  const amountNet = lineAmounts.reduce((s, a) => s + a, 0);
  const amountVat = +(amountNet * vatNum / 100).toFixed(2);
  const irpfAmount = +(amountNet * irpfNum / 100).toFixed(2);
  const amountTotal = +(amountNet + amountVat - irpfAmount).toFixed(2);

  const { data: account } = useQuery({
    queryKey: ["my-account", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("id, name, tax_id").eq("id", accountId!).single();
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
      .eq("tax_id", account?.tax_id || "PROPIA").maybeSingle();
    if (existing) return existing.id;
    const { data: created, error } = await supabase
      .from("business_clients").insert({
        account_id: accountId!, name: account?.name || "Mi empresa",
        tax_id: account?.tax_id || "PROPIA",
        email: (account as any)?.email || null, status: "ACTIVE",
      }).select("id").single();
    if (error) throw error;
    return created.id;
  };

  const addLine = () => setLines([...lines, { description: "", quantity: "1", unitPrice: "" }]);
  const removeLine = (i: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, idx) => idx !== i));
  };
  const updateLine = (i: number, field: keyof LineInput, value: string) => {
    const updated = [...lines];
    updated[i] = { ...updated[i], [field]: value };
    setLines(updated);
  };

  const handleSubmit = async () => {
    if (!invoice) return;
    setSubmitting(true);
    try {
      if (isQuote && status === "INVOICED") {
        const { error: invErr } = await supabase.from("invoices").insert({
          account_id: invoice.account_id, client_id: invoice.client_id,
          type: "INVOICE", status: "PAID", concept: invoice.concept,
          issue_date: new Date().toISOString().slice(0, 10),
          amount_net: invoice.amount_net, vat_percentage: invoice.vat_percentage,
          amount_vat: invoice.amount_vat, amount_total: invoice.amount_total,
          irpf_percentage: invoice.irpf_percentage || 0,
          irpf_amount: invoice.irpf_amount || 0,
          attachment_path: invoice.attachment_path, attachment_name: invoice.attachment_name,
        } as any);
        if (invErr) throw invErr;
        const { error: updErr } = await supabase.from("invoices").update({ status: "INVOICED" }).eq("id", invoice.id);
        if (updErr) throw updErr;
        toast({ title: "Factura creada desde presupuesto" });
        queryClient.invalidateQueries({ queryKey: ["invoices"] });
        onOpenChange(false);
        return;
      }

      const updatePayload: any = { status };
      if (status === "PAID" && invoice.status !== "PAID") {
        updatePayload.paid_at = new Date().toISOString();
      } else if (status !== "PAID" && invoice.status === "PAID") {
        updatePayload.paid_at = null;
      }

      if (isDraft) {
        const validLines = lines.filter(l => l.description.trim() && (parseFloat(l.unitPrice) || 0) > 0);
        if (!clientId || validLines.length === 0) {
          toast({ title: "Error", description: "Completa todos los campos obligatorios", variant: "destructive" });
          setSubmitting(false);
          return;
        }
        const resolvedClientId = await resolveClientId(clientId);
        const concept = validLines.map(l => l.description.trim()).join(", ");
        updatePayload.client_id = resolvedClientId;
        updatePayload.concept = concept;
        updatePayload.issue_date = issueDate;
        updatePayload.operation_date = operationDate || null;
        updatePayload.amount_net = amountNet;
        updatePayload.vat_percentage = vatNum;
        updatePayload.amount_vat = amountVat;
        updatePayload.irpf_percentage = irpfNum;
        updatePayload.irpf_amount = irpfAmount;
        updatePayload.amount_total = amountTotal;
        updatePayload.special_mentions = specialMentions.trim() || null;

        // Delete old lines and insert new
        await supabase.from("invoice_lines").delete().eq("invoice_id", invoice.id);
        const lineInserts = validLines.map((l, i) => ({
          invoice_id: invoice.id, account_id: accountId,
          description: l.description.trim(),
          quantity: parseFloat(l.quantity) || 1,
          unit_price: parseFloat(l.unitPrice) || 0,
          amount: +((parseFloat(l.quantity) || 1) * (parseFloat(l.unitPrice) || 0)).toFixed(2),
          sort_order: i,
        }));
        await supabase.from("invoice_lines").insert(lineInserts as any);
      }

      updatePayload.attachment_path = attachmentPath;
      updatePayload.attachment_name = attachmentName;

      const { error } = await supabase.from("invoices").update(updatePayload).eq("id", invoice.id);
      if (error) throw error;

      toast({ title: isQuote ? "Presupuesto actualizado" : "Factura actualizada" });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-lines"] });
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
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

        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          {/* Status */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Estado</Label>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className="text-sm py-1 px-3">{statusLabels[invoice.status]}</Badge>
              {nextStatuses.length > 0 && (
                <>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  {nextStatuses.map((s) => (
                    <Button key={s} variant={status === s ? "default" : "outline"} size="sm" onClick={() => setStatus(s)}>
                      {statusLabels[s]}
                    </Button>
                  ))}
                </>
              )}
            </div>
          </div>

          <Separator />

          {isDraft && (
            <>
              {/* Client & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{invoice?.type === "EXPENSE" ? "Proveedor" : "Cliente"}</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger><SelectValue placeholder="Selecciona destinatario" /></SelectTrigger>
                    <SelectContent>
                      {account && (
                        <SelectItem value={`__self__${account.id}`}>🏢 {account.name} (Mi empresa)</SelectItem>
                      )}
                      {clients.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fecha de emisión</Label>
                  <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Fecha de operación <span className="text-muted-foreground text-xs">(si difiere)</span></Label>
                <Input type="date" value={operationDate} onChange={(e) => setOperationDate(e.target.value)} />
              </div>

              {/* Line items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Servicios / Conceptos</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLine}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Línea
                  </Button>
                </div>
                {lines.map((line, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 min-w-0">
                      <Input value={line.description} onChange={(e) => updateLine(i, "description", e.target.value)}
                        placeholder="Descripción..." className="text-sm" />
                    </div>
                    <div className="w-20">
                      <Input type="number" min="0" step="0.01" value={line.quantity}
                        onChange={(e) => updateLine(i, "quantity", e.target.value)} placeholder="Cant." className="text-sm" />
                    </div>
                    <div className="w-28">
                      <Input type="number" min="0" step="0.01" value={line.unitPrice}
                        onChange={(e) => updateLine(i, "unitPrice", e.target.value)} placeholder="Precio €" className="text-sm" />
                    </div>
                    <div className="w-24 text-right pt-2 text-sm font-mono text-muted-foreground">
                      €{lineAmounts[i]?.toLocaleString("es-ES", { minimumFractionDigits: 2 }) || "0,00"}
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0"
                      onClick={() => removeLine(i)} disabled={lines.length <= 1}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Tax config */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
                <div className="space-y-2">
                  <Label>IRPF (%)</Label>
                  <Select value={irpfPercentage} onValueChange={setIrpfPercentage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Sin IRPF</SelectItem>
                      <SelectItem value="7">7%</SelectItem>
                      <SelectItem value="15">15%</SelectItem>
                      <SelectItem value="19">19%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Menciones especiales</Label>
                <Textarea value={specialMentions} onChange={(e) => setSpecialMentions(e.target.value)}
                  placeholder="Exención de IVA, inversión del sujeto pasivo..." rows={2} />
              </div>

              {/* Totals */}
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Base imponible</span>
                  <span className="font-mono">€{amountNet.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>IVA ({vatPercentage}%)</span>
                  <span className="font-mono">€{amountVat.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
                </div>
                {irpfNum > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>IRPF (−{irpfPercentage}%)</span>
                    <span className="font-mono">−€{irpfAmount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
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
              {(invoice.irpf_percentage || 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">IRPF (−{invoice.irpf_percentage}%)</span>
                  <span className="font-mono">−€{Number(invoice.irpf_amount || 0).toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-1 border-t">
                <span>Total</span>
                <span className="font-mono">€{Number(invoice.amount_total).toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}

          {/* Partial payments */}
          {invoice?.type !== "QUOTE" && invoice?.status !== "DRAFT" && (
            <>
              <Separator />
              <InvoicePaymentsPanel invoice={invoice} onStatusChanged={() => {
                queryClient.invalidateQueries({ queryKey: ["invoices"] });
              }} />
            </>
          )}

          {/* Attachment */}
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
