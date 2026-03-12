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
import InvoiceAttachment from "@/components/invoices/InvoiceAttachment";
import { dispatchWebhook } from "@/lib/webhooks";

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
  const [concept, setConcept] = useState("");
  const [description, setDescription] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [vatPercentage, setVatPercentage] = useState("21");
  const [vatIncluded, setVatIncluded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attachmentPath, setAttachmentPath] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);

  // Set type when defaultType changes or dialog opens
  useEffect(() => {
    if (open && defaultType) {
      setType(defaultType);
    }
  }, [open, defaultType]);

  const isQuoteMode = defaultType === "QUOTE";

  const amountNum = parseFloat(amount) || 0;
  const vatNum = parseFloat(vatPercentage) || 0;
  const amountNet = vatIncluded
    ? +(amountNum / (1 + vatNum / 100)).toFixed(2)
    : amountNum;
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
        .from("business_clients")
        .select("id, name")
        .eq("account_id", accountId)
        .eq("status", "ACTIVE");
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId && open,
  });

  const resolveClientId = async (selectedId: string): Promise<string> => {
    if (!selectedId.startsWith("__self__")) return selectedId;
    const { data: existing } = await supabase
      .from("business_clients")
      .select("id")
      .eq("account_id", accountId!)
      .eq("name", account?.name || "")
      .eq("tax_id", (account as any)?.tax_id || "PROPIA")
      .maybeSingle();
    if (existing) return existing.id;
    const { data: created, error } = await supabase
      .from("business_clients")
      .insert({
        account_id: accountId!,
        name: account?.name || "Mi empresa",
        tax_id: (account as any)?.tax_id || "PROPIA",
        email: (account as any)?.email || null,
        status: "ACTIVE",
      })
      .select("id")
      .single();
    if (error) throw error;
    return created.id;
  };

  const handleSubmit = async () => {
    if (!clientId || !amount || !accountId || !concept.trim()) {
      toast({ title: "Error", description: "Completa todos los campos obligatorios", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const resolvedClientId = await resolveClientId(clientId);
      const { error } = await supabase.from("invoices").insert({
        account_id: accountId,
        client_id: resolvedClientId,
        type,
        concept: concept.trim(),
        description: description.trim(),
        issue_date: issueDate,
        amount_net: amountNet,
        vat_percentage: vatNum,
        amount_vat: amountVat,
        amount_total: amountTotal,
        ...(attachmentPath ? { attachment_path: attachmentPath, attachment_name: attachmentName } : {}),
      } as any);
      if (error) throw error;

      const typeLabel = type === "QUOTE" ? "Presupuesto" : type === "EXPENSE" ? "Gasto" : "Factura";
      toast({ title: `${typeLabel} creado correctamente` });
      dispatchWebhook(accountId, type === "QUOTE" ? "quote.created" : "invoice.created", {
        type, concept: concept.trim(), amount_net: amountNet, amount_vat: amountVat,
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
    setConcept("");
    setDescription("");
    setIssueDate(new Date().toISOString().slice(0, 10));
    setAmount("");
    setVatPercentage("21");
    setVatIncluded(false);
    setAttachmentPath(null);
    setAttachmentName(null);
  };

  const dialogTitle = isQuoteMode ? "Nuevo Presupuesto" : "Nueva Factura / Gasto";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
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

          <div className="space-y-2">
            <Label>Concepto *</Label>
            <Input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder={isQuoteMode ? "Ej: Propuesta de diseño web" : "Ej: Servicio de consultoría marzo 2026"}
            />
          </div>

          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Añade información adicional o detalles del servicio..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Fecha de emisión</Label>
            <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{vatIncluded ? "Importe con IVA (€)" : "Importe neto (€)"} *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
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
            <Switch checked={vatIncluded} onCheckedChange={setVatIncluded} id="vat-included" />
            <Label htmlFor="vat-included" className="text-sm text-muted-foreground cursor-pointer">
              El importe ya incluye IVA
            </Label>
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

          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Base imponible</span>
              <span className="font-mono">€{amountNet.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>IVA ({vatPercentage}%)</span>
              <span className="font-mono">€{amountVat.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
            </div>
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
