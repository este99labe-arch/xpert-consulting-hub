import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { INVOICE_TEMPLATES, type InvoiceTemplateId, renderInvoiceHtml, type InvoiceData, type InvoiceLine } from "@/components/invoices/invoiceTemplates";

interface Props {
  accountId: string;
  isManager: boolean;
}

const sampleData: InvoiceData = {
  typeLabel: "FACTURA",
  invoiceNumber: "FAC-2026-001",
  issueDate: "15 de marzo de 2026",
  concept: "Servicios de consultoría empresarial",
  lines: [
    { description: "Consultoría estratégica — Marzo 2026", quantity: 20, unitPrice: 50, amount: 1000 },
    { description: "Análisis de procesos internos", quantity: 10, unitPrice: 50, amount: 500 },
  ],
  amountNet: 1500,
  amountVat: 315,
  amountTotal: 1590,
  vatPercentage: 21,
  irpfPercentage: 15,
  irpfAmount: 225,
  specialMentions: "Operación sujeta a retención de IRPF según Art. 101 LIRPF",
  status: "SENT",
  statusLabel: "Enviada",
  company: {
    name: "Mi Empresa S.L.",
    taxId: "B12345678",
    address: "Calle Principal 10",
    city: "Madrid",
    postalCode: "28001",
    phone: "+34 612 345 678",
    email: "info@miempresa.es",
  },
  client: {
    name: "Cliente Ejemplo S.A.",
    taxId: "A87654321",
    email: "contacto@cliente.es",
    address: "Av. de la Innovación 25",
    city: "Barcelona",
    postalCode: "08001",
  },
  payments: [
    { amount: 500, date: "20/03/2026", method: "Transferencia" },
  ],
};

const InvoiceTemplateTab = ({ accountId, isManager }: Props) => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<InvoiceTemplateId | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["account-settings", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_settings")
        .select("*")
        .eq("account_id", accountId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  const currentTemplate = ((settings as any)?.invoice_template as InvoiceTemplateId) || "classic";

  const handleSelect = async (templateId: InvoiceTemplateId) => {
    if (!isManager) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("account_settings")
        .update({ invoice_template: templateId } as any)
        .eq("account_id", accountId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["account-settings"] });
      toast({ title: "Plantilla actualizada", description: `Se ha seleccionado la plantilla "${INVOICE_TEMPLATES.find(t => t.id === templateId)?.name}"` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Plantilla de factura</CardTitle>
          <CardDescription>
            Elige el diseño que se usará para la vista previa y exportación de tus facturas y gastos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {INVOICE_TEMPLATES.map((t) => {
              const isSelected = currentTemplate === t.id;
              return (
                <div
                  key={t.id}
                  className={`relative border-2 rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => isManager && handleSelect(t.id)}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3">
                      <Badge variant="default" className="gap-1 text-xs">
                        <Check className="h-3 w-3" /> Activa
                      </Badge>
                    </div>
                  )}
                  {/* Mini preview */}
                  <div
                    className="w-full bg-white rounded-lg border border-border mb-3 overflow-hidden"
                    style={{ aspectRatio: "210/297" }}
                  >
                    <iframe
                      srcDoc={renderInvoiceHtml(t.id, sampleData)}
                      title={`Preview ${t.name}`}
                      className="w-full h-full border-0 pointer-events-none"
                      sandbox="allow-same-origin"
                    />
                  </div>
                  <h3 className="font-semibold text-foreground">{t.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                  {!isSelected && isManager && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3"
                      disabled={saving}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(t.id);
                      }}
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      Seleccionar
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Full-size preview */}
      {previewTemplate && (
        <Card>
          <CardHeader>
            <CardTitle>Vista previa — {INVOICE_TEMPLATES.find(t => t.id === previewTemplate)?.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full max-w-[700px] mx-auto shadow-lg rounded-lg overflow-hidden bg-white" style={{ aspectRatio: "210/297" }}>
              <iframe
                srcDoc={renderInvoiceHtml(previewTemplate, sampleData)}
                title="Full preview"
                className="w-full h-full border-0"
                sandbox="allow-same-origin"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InvoiceTemplateTab;
