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
import {
  Plus, Trash2, FileText, Receipt, FileSignature, Users, CalendarDays,
  Percent, StickyNote, Paperclip, Copy, Loader2, Tags,
} from "lucide-react";
import InvoiceAttachment from "@/components/invoices/InvoiceAttachment";
import FormSection from "@/components/shared/FormSection";
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
  const [categoryId, setCategoryId] = useState("");
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
  const rawTotal = lineAmounts.reduce((s, a) => s + a, 0);
  const amountNet = vatIncluded && vatNum > 0 ? +(rawTotal / (1 + vatNum / 100)).toFixed(2) : rawTotal;
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

  // Categorías contables (mapean a la cuenta del PGC en el asiento automático)
  const categoryKind = type === "EXPENSE" ? "EXPENSE" : "INCOME";
  const { data: categories = [] } = useQuery({
    queryKey: ["accounting_categories", accountId, categoryKind],
    queryFn: async () => {
      if (!accountId) return [] as any[];
      const { data, error } = await (supabase as any)
        .from("accounting_categories")
        .select("id, name, kind, is_default, sort_order")
        .eq("account_id", accountId).eq("kind", categoryKind)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId && open,
  });

  useEffect(() => {
    if (categories.length && !categories.find((c: any) => c.id === categoryId)) {
      const def = categories.find((c: any) => c.is_default) || categories[0];
      setCategoryId(def?.id || "");
    }
  }, [categories, categoryId]);

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

  const handleSubmit = async (keepOpen = false) => {
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
        vat_included: vatIncluded,
        category_id: categoryId || null,
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
      if (keepOpen) {
        // Mantén cliente, tipo, fechas e impuestos para alta rápida; limpia el resto
        setLines([{ description: "", quantity: "1", unitPrice: "" }]);
        setSpecialMentions("");
        setAttachmentPath(null);
        setAttachmentName(null);
      } else {
        onOpenChange(false);
        resetForm();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setClientId("");
    setCategoryId("");
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

  const meta = isQuoteMode
    ? { title: "Nuevo presupuesto", subtitle: "Crea un presupuesto para enviar a un cliente", icon: FileSignature }
    : type === "EXPENSE"
      ? { title: "Nuevo gasto", subtitle: "Registra una factura de proveedor o un gasto", icon: Receipt }
      : { title: "Nueva factura", subtitle: "Emite una factura a uno de tus clientes", icon: FileText };

  const recipientLabel = type === "EXPENSE" ? "Proveedor / Empresa" : "Cliente";
  const validLineCount = lines.filter(l => l.description.trim() && (parseFloat(l.unitPrice) || 0) > 0).length;
  const canSubmit = !!clientId && validLineCount > 0 && !submitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 space-y-0 border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <meta.icon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">{meta.title}</DialogTitle>
              <p className="text-sm text-muted-foreground">{meta.subtitle}</p>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto bg-muted/30 px-6 py-5">
          {/* Datos generales */}
          <FormSection icon={Users} title="Datos generales" desc="Tipo de documento, destinatario y fechas">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
                <Label>{recipientLabel} <span className="text-destructive">*</span></Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger className={!clientId ? "text-muted-foreground" : ""}>
                    <SelectValue placeholder="Selecciona destinatario" />
                  </SelectTrigger>
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
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Tags className="h-3.5 w-3.5 text-muted-foreground" />Categoría contable</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Selecciona categoría" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Determina la cuenta del PGC en el asiento automático.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />Fecha de emisión <span className="text-destructive">*</span></Label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha de operación <span className="text-xs text-muted-foreground">(si difiere)</span></Label>
                <Input type="date" value={operationDate} onChange={(e) => setOperationDate(e.target.value)} />
              </div>
            </div>
          </FormSection>

          {/* Conceptos */}
          <FormSection
            icon={FileText}
            title="Conceptos"
            desc="Servicios o productos incluidos"
            action={
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Añadir línea
              </Button>
            }
          >
            {/* Column headers (desktop) */}
            <div className="hidden grid-cols-[1fr_5rem_7rem_6rem_2.25rem] gap-2 px-1 sm:grid">
              <span className="text-xs font-medium text-muted-foreground">Descripción</span>
              <span className="text-xs font-medium text-muted-foreground">Cant.</span>
              <span className="text-xs font-medium text-muted-foreground">Precio €</span>
              <span className="text-right text-xs font-medium text-muted-foreground">Importe</span>
              <span />
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-[1fr_3.5rem_4.5rem_2.25rem] items-center gap-2 sm:grid-cols-[1fr_5rem_7rem_6rem_2.25rem]">
                  <Input
                    value={line.description}
                    onChange={(e) => updateLine(i, "description", e.target.value)}
                    placeholder="Descripción del servicio..."
                    className="text-sm"
                  />
                  <Input
                    type="number" min="0" step="0.01"
                    value={line.quantity}
                    onChange={(e) => updateLine(i, "quantity", e.target.value)}
                    placeholder="Cant."
                    className="text-sm"
                  />
                  <Input
                    type="number" min="0" step="0.01"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(i, "unitPrice", e.target.value)}
                    placeholder="Precio €"
                    className="text-sm"
                  />
                  <div className="hidden text-right font-mono text-sm text-muted-foreground sm:block">
                    €{lineAmounts[i]?.toLocaleString("es-ES", { minimumFractionDigits: 2 }) || "0,00"}
                  </div>
                  <Button
                    type="button" variant="ghost" size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => removeLine(i)}
                    disabled={lines.length <= 1}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          </FormSection>

          {/* Impuestos */}
          <FormSection icon={Percent} title="Impuestos" desc="IVA, IRPF y desglose del importe">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
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
              <div className="flex items-end pb-1">
                <div className="flex items-center gap-2">
                  <Switch checked={vatIncluded} onCheckedChange={setVatIncluded} />
                  <Label className="text-sm">IVA incluido</Label>
                </div>
              </div>
            </div>

            <div className="space-y-1 rounded-lg border border-border bg-muted/40 p-3">
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
              <div className="flex justify-between border-t border-border pt-1 text-base font-semibold text-foreground">
                <span>Total</span>
                <span className="font-mono">€{amountTotal.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </FormSection>

          {/* Detalles adicionales */}
          <FormSection icon={StickyNote} title="Detalles adicionales" desc="Menciones legales y documentación de soporte">
            <div className="space-y-1.5">
              <Label>Menciones especiales <span className="text-xs text-muted-foreground">(exención IVA, inversión sujeto pasivo...)</span></Label>
              <Textarea
                value={specialMentions}
                onChange={(e) => setSpecialMentions(e.target.value)}
                placeholder="Ej: Operación exenta de IVA según Art. 20.1 LIVA"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5 text-muted-foreground" />Archivo adjunto</Label>
              <InvoiceAttachment
                accountId={accountId || ""}
                attachmentPath={attachmentPath}
                attachmentName={attachmentName}
                onUploaded={(path, name) => { setAttachmentPath(path); setAttachmentName(name); }}
                onRemoved={() => { setAttachmentPath(null); setAttachmentName(null); }}
              />
            </div>
          </FormSection>
        </div>

        {/* Sticky footer with live total + actions */}
        <DialogFooter className="flex-shrink-0 flex-row items-center justify-between gap-3 border-t border-border bg-background px-6 py-3 sm:justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Total</span>
            <span className="font-mono text-lg font-bold tracking-tight">
              €{amountTotal.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
            <Button variant="outline" onClick={() => handleSubmit(true)} disabled={!canSubmit} className="hidden sm:inline-flex">
              <Copy className="mr-1.5 h-4 w-4" /> Guardar y crear otro
            </Button>
            <Button onClick={() => handleSubmit(false)} disabled={!canSubmit}>
              {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {submitting ? "Guardando..." : "Crear"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateInvoiceDialog;
