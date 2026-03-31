import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import InvoiceAttachment from "@/components/invoices/InvoiceAttachment";
import { dispatchWebhook } from "@/lib/webhooks";

interface InvoiceLineInput {
  description: string;
  quantity: string;
  unitPrice: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: "QUOTE" | "INVOICE" | "EXPENSE";
}

const CreateInvoiceDialog = ({ open, onOpenChange, defaultType }: Props) => {
  const { accountId } = useAuth();
  const queryClient = useQueryClient();

  const [clientId, setClientId] = useState("");
  const [type, setType] = useState("INVOICE");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [operationDate, setOperationDate] = useState("");
  const [vatPercentage, setVatPercentage] = useState("21");
  const [irpfPercentage, setIrpfPercentage] = useState("0");
  const [specialMentions, setSpecialMentions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attachmentPath, setAttachmentPath] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);

  const [vatIncluded, setVatIncluded] = useState(false);
  const [lines, setLines] = useState<InvoiceLineInput[]>([
    { description: "", quantity: "1", unitPrice: "" },
  ]);

  useEffect(() => {
    if (open && defaultType) setType(defaultType);
  }, [open, defaultType]);

  const isQuoteMode = defaultType === "QUOTE";

  // Calculations
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
    queryKey: ["business_clients", accountId, account?.name],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("business_clients")
        .select("id, name, default_vat_percentage")
        .eq("account_id", accountId)
        .eq("status", "ACTIVE");
      if (error) throw error;
      return (data || []).filter((c: any) => c.name !== account?.name);
    },
    enabled: !!accountId && open,
  });

  useEffect(() => {
    if (clientId && !clientId.startsWith("__self__")) {
      const selected = clients.find((c: any) => c.id === clientId);
      if (selected?.default_vat_percentage != null) {
        setVatPercentage(String(selected.default_vat_percentage));
      }
    }
  }, [clientId, clients]);

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
  const updateLine = (i: number, field: keyof InvoiceLineInput, value: string) => {
    const updated = [...lines];
    updated[i] = { ...updated[i], [field]: value };
    setLines(updated);
  };

  const handleSubmit = async () => {
    if (!clientId || !accountId) {
      toast({ title: "Error", description: "Selecciona un cliente/proveedor", variant: "destructive" });
      return;
    }
    const validLines = lines.filter(l => l.description.trim() && (parseFloat(l.unitPrice) || 0) > 0);
    if (validLines.length === 0) {
      toast({ title: "Error", description: "Añade al menos un servicio con descripción y precio", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const resolvedClientId = await resolveClientId(clientId);
      const concept = validLines.map(l => l.description.trim()).join(", ");

      const { data: inv, error } = await supabase.from("invoices").insert({
        account_id: accountId,
        client_id: resolvedClientId,
        type,
        concept,
        issue_date: issueDate,
        operation_date: operationDate || null,
        amount_net: amountNet,
        vat_percentage: vatNum,
        amount_vat: amountVat,
        irpf_percentage: irpfNum,
        irpf_amount: irpfAmount,
        amount_total: amountTotal,
        special_mentions: specialMentions.trim() || null,
        ...(attachmentPath ? { attachment_path: attachmentPath, attachment_name: attachmentName } : {}),
      } as any).select("id").single();
      if (error) throw error;

      // Insert line items
      if (inv) {
        const lineInserts = validLines.map((l, i) => ({
          invoice_id: inv.id,
          account_id: accountId,
          description: l.description.trim(),
          quantity: parseFloat(l.quantity) || 1,
          unit_price: parseFloat(l.unitPrice) || 0,
          amount: +((parseFloat(l.quantity) || 1) * (parseFloat(l.unitPrice) || 0)).toFixed(2),
          sort_order: i,
        }));
        await supabase.from("invoice_lines").insert(lineInserts as any);
      }

      const typeLabel = type === "QUOTE" ? "Presupuesto" : type === "EXPENSE" ? "Gasto" : "Factura";
      toast({ title: `${typeLabel} creado correctamente` });
      dispatchWebhook(accountId, type === "QUOTE" ? "quote.created" : "invoice.created", {
        type, concept, amount_net: amountNet, amount_vat: amountVat,
        amount_total: amountTotal, vat_percentage: vatNum, issue_date: issueDate,
      });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["business_clients"] });
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setClientId("");
    setType("INVOICE");
    setIssueDate(new Date().toISOString().slice(0, 10));
    setOperationDate("");
    setVatPercentage("21");
    setIrpfPercentage("0");
    setSpecialMentions("");
    setLines([{ description: "", quantity: "1", unitPrice: "" }]);
    setAttachmentPath(null);
    setAttachmentName(null);
  };

  const dialogTitle = isQuoteMode ? "Nuevo Presupuesto" : "Nueva Factura / Gasto";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          {/* Type & Client */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              {isQuoteMode ? (
                <Input value="Presupuesto" disabled className="bg-muted" />
              ) : (
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INVOICE">Factura</SelectItem>
                    <SelectItem value="EXPENSE">Gasto</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>{type === "EXPENSE" ? "Proveedor / Empresa" : "Cliente"} *</Label>
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
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha de emisión *</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fecha de operación <span className="text-muted-foreground text-xs">(si difiere)</span></Label>
              <Input type="date" value={operationDate} onChange={(e) => setOperationDate(e.target.value)} />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Servicios / Conceptos *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Añadir línea
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 min-w-0">
                    <Input
                      value={line.description}
                      onChange={(e) => updateLine(i, "description", e.target.value)}
                      placeholder="Descripción del servicio..."
                      className="text-sm"
                    />
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.quantity}
                      onChange={(e) => updateLine(i, "quantity", e.target.value)}
                      placeholder="Cant."
                      className="text-sm"
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(i, "unitPrice", e.target.value)}
                      placeholder="Precio €"
                      className="text-sm"
                    />
                  </div>
                  <div className="w-24 text-right pt-2 text-sm font-mono text-muted-foreground">
                    €{lineAmounts[i]?.toLocaleString("es-ES", { minimumFractionDigits: 2 }) || "0,00"}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => removeLine(i)}
                    disabled={lines.length <= 1}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
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

          {/* Special mentions */}
          <div className="space-y-2">
            <Label>Menciones especiales <span className="text-muted-foreground text-xs">(exención IVA, inversión sujeto pasivo...)</span></Label>
            <Textarea
              value={specialMentions}
              onChange={(e) => setSpecialMentions(e.target.value)}
              placeholder="Ej: Operación exenta de IVA según Art. 20.1 LIVA"
              rows={2}
            />
          </div>

          {/* Attachment */}
          <div className="space-y-2">
            <Label>Archivo adjunto</Label>
            <InvoiceAttachment
              accountId={accountId || ""}
              attachmentPath={attachmentPath}
              attachmentName={attachmentName}
              onUploaded={(path, name) => { setAttachmentPath(path); setAttachmentName(name); }}
              onRemoved={() => { setAttachmentPath(null); setAttachmentName(null); }}
            />
          </div>

          {/* Totals summary */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
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
            <div className="flex justify-between text-base font-semibold text-foreground pt-1 border-t border-border">
              <span>Total</span>
              <span className="font-mono">€{amountTotal.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Guardando..." : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateInvoiceDialog;
