import { useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Download, Mail, Clock, Palette } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import InvoiceAttachment from "@/components/invoices/InvoiceAttachment";
import { renderInvoiceHtml, INVOICE_TEMPLATES, type InvoiceTemplateId, type InvoiceData } from "./invoiceTemplates";

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador", SENT: "Enviada", PAID: "Pagada", PARTIALLY_PAID: "Pago parcial", OVERDUE: "Vencida",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any | null;
  onExport?: () => void;
  onSendEmail?: () => void;
}

const InvoicePreviewDialog = ({ open, onOpenChange, invoice, onExport, onSendEmail }: Props) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { accountId } = useAuth();
  const [templateOverride, setTemplateOverride] = useState<InvoiceTemplateId | null>(null);

  const { data: account } = useQuery({
    queryKey: ["my-account", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").eq("id", accountId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!accountId && open,
  });

  const { data: accountSettings } = useQuery({
    queryKey: ["account-settings", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("account_settings").select("*").eq("account_id", accountId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!accountId && open,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["invoice-payments", invoice?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_payments").select("*")
        .eq("invoice_id", invoice!.id).order("payment_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!invoice?.id && open,
  });

  const { data: invoiceLines = [] } = useQuery({
    queryKey: ["invoice-lines", invoice?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_lines").select("*")
        .eq("invoice_id", invoice!.id).order("sort_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!invoice?.id && open,
  });

  const { data: emailLogs = [] } = useQuery({
    queryKey: ["email-log", invoice?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_log").select("*")
        .eq("invoice_id", invoice!.id).order("sent_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!invoice?.id && open,
  });

  if (!invoice) return null;

  const client = invoice.business_clients;
  const typeLabel = invoice.type === "INVOICE" ? "FACTURA" : invoice.type === "QUOTE" ? "PRESUPUESTO" : "GASTO";
  const invoiceNumber = invoice.invoice_number || invoice.id.slice(0, 8).toUpperCase();
  const template: InvoiceTemplateId = templateOverride || ((accountSettings as any)?.invoice_template as InvoiceTemplateId) || "classic";

  const methodLabels: Record<string, string> = {
    TRANSFER: "Transferencia", CASH: "Efectivo", CARD: "Tarjeta", CHECK: "Cheque", OTHER: "Otro",
  };

  const invoiceData: InvoiceData = {
    typeLabel,
    invoiceNumber,
    issueDate: format(new Date(invoice.issue_date), "dd 'de' MMMM 'de' yyyy", { locale: es }),
    operationDate: invoice.operation_date
      ? format(new Date(invoice.operation_date), "dd 'de' MMMM 'de' yyyy", { locale: es })
      : undefined,
    concept: invoice.concept,
    description: invoice.description,
    lines: invoiceLines.length > 0 ? invoiceLines.map((l: any) => ({
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unit_price,
      amount: l.amount,
    })) : undefined,
    amountNet: invoice.amount_net,
    amountVat: invoice.amount_vat,
    amountTotal: invoice.amount_total,
    vatPercentage: invoice.vat_percentage,
    irpfPercentage: invoice.irpf_percentage || 0,
    irpfAmount: invoice.irpf_amount || 0,
    specialMentions: invoice.special_mentions || undefined,
    status: invoice.status,
    statusLabel: statusLabels[invoice.status] || invoice.status,
    company: {
      name: account?.name || "Empresa",
      taxId: (account as any)?.tax_id || undefined,
      address: (account as any)?.address || undefined,
      city: (account as any)?.city || undefined,
      postalCode: (account as any)?.postal_code || undefined,
      phone: (account as any)?.phone || undefined,
      email: (account as any)?.email || undefined,
    },
    client: {
      name: client?.name || "—",
      taxId: client?.tax_id || undefined,
      email: client?.email || undefined,
      address: client?.address || undefined,
      city: client?.city || undefined,
      postalCode: client?.postal_code || undefined,
      phone: client?.phone || undefined,
    },
    payments: payments.map((p: any) => ({
      amount: p.amount,
      date: format(new Date(p.payment_date), "dd/MM/yyyy"),
      method: methodLabels[p.method] || p.method,
    })),
  };

  const html = renderInvoiceHtml(template, invoiceData);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        {/* Toolbar */}
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between bg-background border-b px-4 md:px-6 py-3 gap-2">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-foreground text-sm md:text-base">{typeLabel} {invoiceNumber}</span>
            <Badge variant="outline">{statusLabels[invoice.status] || invoice.status}</Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <Select value={template} onValueChange={(v) => setTemplateOverride(v as InvoiceTemplateId)}>
                <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVOICE_TEMPLATES.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {onSendEmail && client?.email && (
              <Button variant="outline" size="sm" onClick={onSendEmail}>
                <Mail className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Email</span>
              </Button>
            )}
            {onExport && (
              <Button variant="outline" size="sm" onClick={onExport}>
                <Download className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Exportar</span>
              </Button>
            )}
            <Button size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Imprimir</span>
            </Button>
          </div>
        </div>

        {/* Attachment bar */}
        {invoice.attachment_path && invoice.attachment_name && (
          <div className="px-6 py-2 border-b bg-muted/20">
            <InvoiceAttachment
              accountId={accountId || ""} invoiceId={invoice.id}
              attachmentPath={invoice.attachment_path} attachmentName={invoice.attachment_name}
              onUploaded={() => {}} readOnly
            />
          </div>
        )}

        {/* A4 Preview */}
        <div className="p-4 flex justify-center bg-muted/30">
          <div className="w-full max-w-[700px] shadow-lg rounded-lg overflow-hidden bg-white">
            <iframe
              ref={iframeRef} srcDoc={html} title="Vista previa factura"
              className="w-full border-0" style={{ minHeight: "80vh", height: "1100px" }}
              sandbox="allow-same-origin"
            />
          </div>
        </div>

        {/* Email history */}
        {emailLogs.length > 0 && (
          <div className="px-6 py-4 border-t bg-muted/20">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Historial de envíos</span>
            </div>
            <div className="space-y-2">
              {emailLogs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{log.recipient}</span>
                    <Badge variant={log.status === "sent" ? "default" : "destructive"} className="text-xs">
                      {log.type === "reminder" ? "Recordatorio" : "Factura"} — {log.status === "sent" ? "Enviado" : "Error"}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(log.sent_at), "dd MMM yyyy HH:mm", { locale: es })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InvoicePreviewDialog;
