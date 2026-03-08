import { useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, Download } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import InvoiceAttachment from "@/components/invoices/InvoiceAttachment";

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador", SENT: "Enviada", PAID: "Pagada", OVERDUE: "Vencida",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any | null;
  onExport?: () => void;
}

const InvoicePreviewDialog = ({ open, onOpenChange, invoice, onExport }: Props) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { accountId } = useAuth();

  const { data: account } = useQuery({
    queryKey: ["my-account", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").eq("id", accountId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!accountId && open,
  });

  if (!invoice) return null;

  const client = invoice.business_clients;
  const typeLabel = invoice.type === "INVOICE" ? "FACTURA" : "GASTO";
  const invoiceNumber = invoice.invoice_number || invoice.id.slice(0, 8).toUpperCase();
  const fmt = (n: number) => Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8">
      <title>${typeLabel} ${invoiceNumber}</title>
      <style>
        @page { size: A4; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a2e; }
        ${printStyles}
      </style>
      </head><body>${content.innerHTML}</body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        {/* Toolbar */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-background border-b px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-foreground">{typeLabel} {invoiceNumber}</span>
            <Badge variant="outline">{statusLabels[invoice.status] || invoice.status}</Badge>
          </div>
          <div className="flex gap-2">
            {onExport && (
              <Button variant="outline" size="sm" onClick={onExport}>
                <Download className="h-4 w-4 mr-1" /> Exportar
              </Button>
            )}
            <Button size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
          </div>
        </div>

        {/* Attachment bar */}
        {invoice.attachment_path && invoice.attachment_name && (
          <div className="px-6 py-2 border-b bg-muted/20">
            <InvoiceAttachment
              accountId={accountId || ""}
              invoiceId={invoice.id}
              attachmentPath={invoice.attachment_path}
              attachmentName={invoice.attachment_name}
              onUploaded={() => {}}
              readOnly
            />
          </div>
        )}

        {/* A4 Preview — scaled to fit dialog */}
        <div className="p-4 flex justify-center bg-muted/30 overflow-hidden">
          <div
            ref={printRef}
            className="invoice-page bg-white shadow-lg origin-top"
            style={{ width: "210mm", minHeight: "297mm", padding: "40px 50px", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", color: "#1a1a2e", fontSize: "13px", lineHeight: "1.5", transform: "scale(0.55)", transformOrigin: "top center", marginBottom: "-45%" }}
          >
            {/* Header bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "40px" }}>
              <div>
                <div style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.5px", color: "#0f172a" }}>
                  {account?.name || "Empresa"}
                </div>
                {account?.tax_id && (
                  <div style={{ marginTop: "4px", fontSize: "12px", color: "#64748b" }}>NIF/CIF: {account.tax_id}</div>
                )}
                {account?.address && (
                  <div style={{ fontSize: "12px", color: "#64748b" }}>{account.address}{account?.postal_code ? `, ${account.postal_code}` : ""}{account?.city ? ` ${account.city}` : ""}</div>
                )}
                {(account?.phone || account?.email) && (
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    {account?.phone}{account?.phone && account?.email ? " · " : ""}{account?.email}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "2px", color: "#94a3b8", fontWeight: 600 }}>
                  {typeLabel}
                </div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
                  {invoiceNumber}
                </div>
              </div>
            </div>

            {/* Parties */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "36px", gap: "40px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1.5px", color: "#94a3b8", fontWeight: 600, marginBottom: "8px" }}>
                  De
                </div>
                <div style={{ fontWeight: 600, fontSize: "15px" }}>{account?.name || "—"}</div>
                {account?.tax_id && <div style={{ color: "#64748b", fontSize: "13px" }}>NIF/CIF: {account.tax_id}</div>}
                {account?.address && <div style={{ color: "#64748b", fontSize: "13px" }}>{account.address}{account?.postal_code ? `, ${account.postal_code}` : ""}{account?.city ? ` ${account.city}` : ""}</div>}
                {account?.email && <div style={{ color: "#64748b", fontSize: "13px" }}>{account.email}</div>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1.5px", color: "#94a3b8", fontWeight: 600, marginBottom: "8px" }}>
                  Para
                </div>
                <div style={{ fontWeight: 600, fontSize: "15px" }}>{client?.name || "—"}</div>
                <div style={{ color: "#64748b", fontSize: "13px" }}>NIF/CIF: {client?.tax_id || "—"}</div>
                {client?.email && <div style={{ color: "#64748b", fontSize: "13px" }}>{client.email}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1.5px", color: "#94a3b8", fontWeight: 600, marginBottom: "8px" }}>
                  Fecha
                </div>
                <div style={{ fontWeight: 600 }}>
                  {format(new Date(invoice.issue_date), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: "2px", background: "linear-gradient(90deg, #0f172a, #e2e8f0)", marginBottom: "28px" }} />

            {/* Concept table */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "32px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "12px 16px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1.5px", color: "#94a3b8", fontWeight: 600, borderBottom: "1px solid #e2e8f0" }}>
                    Concepto
                  </th>
                  <th style={{ textAlign: "right", padding: "12px 16px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1.5px", color: "#94a3b8", fontWeight: 600, borderBottom: "1px solid #e2e8f0", width: "140px" }}>
                    Base imponible
                  </th>
                  <th style={{ textAlign: "right", padding: "12px 16px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1.5px", color: "#94a3b8", fontWeight: 600, borderBottom: "1px solid #e2e8f0", width: "120px" }}>
                    IVA ({invoice.vat_percentage}%)
                  </th>
                  <th style={{ textAlign: "right", padding: "12px 16px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1.5px", color: "#94a3b8", fontWeight: 600, borderBottom: "1px solid #e2e8f0", width: "130px" }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "16px", borderBottom: "1px solid #f1f5f9", fontWeight: 500 }}>
                    {invoice.concept || "—"}
                  </td>
                  <td style={{ padding: "16px", textAlign: "right", borderBottom: "1px solid #f1f5f9", fontFamily: "'SF Mono', 'Fira Code', monospace" }}>
                    €{fmt(invoice.amount_net)}
                  </td>
                  <td style={{ padding: "16px", textAlign: "right", borderBottom: "1px solid #f1f5f9", fontFamily: "'SF Mono', 'Fira Code', monospace" }}>
                    €{fmt(invoice.amount_vat)}
                  </td>
                  <td style={{ padding: "16px", textAlign: "right", borderBottom: "1px solid #f1f5f9", fontWeight: 700, fontFamily: "'SF Mono', 'Fira Code', monospace" }}>
                    €{fmt(invoice.amount_total)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Totals summary */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "60px" }}>
              <div style={{ width: "280px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: "13px", color: "#64748b" }}>
                  <span>Base imponible</span>
                  <span style={{ fontFamily: "'SF Mono', 'Fira Code', monospace" }}>€{fmt(invoice.amount_net)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: "13px", color: "#64748b" }}>
                  <span>IVA ({invoice.vat_percentage}%)</span>
                  <span style={{ fontFamily: "'SF Mono', 'Fira Code', monospace" }}>€{fmt(invoice.amount_vat)}</span>
                </div>
                <div style={{ height: "2px", background: "#0f172a", margin: "8px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
                  <span>Total</span>
                  <span style={{ fontFamily: "'SF Mono', 'Fira Code', monospace" }}>€{fmt(invoice.amount_total)}</span>
                </div>
              </div>
            </div>


            {/* Footer */}
            <div style={{ position: "relative", marginTop: "auto", paddingTop: "30px", borderTop: "1px solid #e2e8f0", textAlign: "center" }}>
              <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                {account?.name || "Empresa"} · Documento generado automáticamente
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const printStyles = `
  .invoice-page {
    width: 210mm !important;
    min-height: 297mm !important;
    padding: 40px 50px !important;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
    color: #1a1a2e !important;
    font-size: 13px !important;
    line-height: 1.5 !important;
  }
  @media print {
    body { margin: 0; }
    .invoice-page { box-shadow: none !important; }
  }
`;

export default InvoicePreviewDialog;
