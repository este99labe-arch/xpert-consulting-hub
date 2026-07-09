import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Check, Loader2, Save, Palette, RotateCcw, QrCode } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  INVOICE_TEMPLATES, renderInvoiceHtml,
  type InvoiceTemplateId, type InvoiceData, type InvoiceTemplateOptions,
} from "@/components/invoices/invoiceTemplates";

interface Props {
  accountId: string;
  isManager: boolean;
}

// QR de muestra (cuadrado con patrón simple) para previsualizar la posición del QR VERI*FACTU
const SAMPLE_QR =
  "data:image/svg+xml;base64," +
  btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 33 33"><rect width="33" height="33" fill="#fff"/><path fill="#000" d="M0 0h9v9H0zM2 2v5h5V2zM24 0h9v9h-9zm2 2v5h5V2zM0 24h9v9H0zm2 2v5h5v-5zM12 0h2v2h-2zM16 2h2v4h-2zM20 0h2v6h-2zM12 4h3v3h-3zM12 9h5v2h-5zM20 8h4v3h-4zM0 12h4v2H0zM6 12h4v3H6zM12 13h4v4h-4zM18 14h3v2h-3zM23 12h3v3h-3zM28 13h5v2h-5zM0 16h3v4H0zM5 17h3v3H5zM18 18h4v4h-4zM24 17h2v5h-2zM28 17h3v3h-3zM12 19h4v2h-4zM12 23h2v4h-2zM16 24h4v2h-4zM22 24h3v3h-3zM27 22h6v2h-6zM12 29h3v4h-3zM17 28h2v5h-2zM21 29h4v2h-4zM27 26h2v4h-2zM31 26h2v7h-2zM24 31h3v2h-3z"/></svg>`);

const sampleData: InvoiceData = {
  typeLabel: "FACTURA",
  invoiceNumber: "FAC-2026-001",
  issueDate: "15 de marzo de 2026",
  operationDate: "12 de marzo de 2026",
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
  payments: [{ amount: 500, date: "20/03/2026", method: "Transferencia" }],
};

const TOGGLES: { key: keyof InvoiceTemplateOptions; label: string; desc: string }[] = [
  { key: "showStatus", label: "Etiqueta de estado", desc: "Muestra Borrador/Enviada/Pagada en la cabecera" },
  { key: "showOperationDate", label: "Fecha de operación", desc: "Tercera casilla junto a nº y fecha de emisión" },
  { key: "showPayments", label: "Pagos registrados", desc: "Listado de cobros parciales" },
  { key: "showSpecialMentions", label: "Menciones especiales", desc: "Recuadro con menciones legales (IRPF, exenciones...)" },
];

const InvoiceTemplateTab = ({ accountId, isManager }: Props) => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState<InvoiceTemplateId>("classic");
  const [opts, setOpts] = useState<InvoiceTemplateOptions>({});
  const [dirty, setDirty] = useState(false);

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

  // Cargar valores guardados
  useEffect(() => {
    if (settings) {
      setTemplate(((settings as any).invoice_template as InvoiceTemplateId) || "classic");
      setOpts(((settings as any).invoice_template_options as InvoiceTemplateOptions) || {});
      setDirty(false);
    }
  }, [settings]);

  const set = (patch: Partial<InvoiceTemplateOptions>) => {
    setOpts((o) => ({ ...o, ...patch }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!isManager) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("account_settings")
        .update({ invoice_template: template, invoice_template_options: opts } as any)
        .eq("account_id", accountId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["account-settings"] });
      setDirty(false);
      toast({ title: "Plantilla guardada", description: "Se aplicará a la vista previa, impresión y envío de tus facturas y gastos." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Vista previa con las opciones actuales (incluye QR de muestra si está activo)
  const previewHtml = useMemo(() => {
    const data = { ...sampleData, qrDataUrl: opts.showQr !== false ? SAMPLE_QR : undefined };
    return renderInvoiceHtml(template, data, opts);
  }, [template, opts]);

  return (
    <div className="space-y-6">
      {/* ─── Galería de plantillas ─── */}
      <Card>
        <CardHeader>
          <CardTitle>Plantilla de factura</CardTitle>
          <CardDescription>
            Elige el diseño para la emisión de tus facturas y gastos. Después personalízalo más abajo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {INVOICE_TEMPLATES.map((t) => {
              const isSelected = template === t.id;
              return (
                <div
                  key={t.id}
                  className={`relative cursor-pointer rounded-xl border-2 p-3 transition-all hover:shadow-md ${
                    isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => { if (isManager) { setTemplate(t.id); setDirty(true); } }}
                >
                  {isSelected && (
                    <div className="absolute right-2 top-2 z-10">
                      <Badge variant="default" className="gap-1 text-xs"><Check className="h-3 w-3" /> Activa</Badge>
                    </div>
                  )}
                  <div className="mb-2 w-full overflow-hidden rounded-lg border border-border bg-white" style={{ aspectRatio: "210/297" }}>
                    <iframe
                      srcDoc={renderInvoiceHtml(t.id, sampleData, opts)}
                      title={`Preview ${t.name}`}
                      className="pointer-events-none h-full w-full border-0"
                      sandbox="allow-same-origin"
                      loading="lazy"
                    />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{t.name}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ─── Personalización ─── */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4 text-primary" /> Personalización</CardTitle>
            <CardDescription>Ajusta el nombre, el color y los datos que aparecen en el documento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nombre en la factura</Label>
                <Input
                  value={opts.displayName || ""}
                  onChange={(e) => set({ displayName: e.target.value })}
                  placeholder="(nombre de tu empresa)"
                  disabled={!isManager}
                />
                <p className="text-xs text-muted-foreground">Déjalo vacío para usar el nombre fiscal de la cuenta.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Color de acento</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={opts.accentColor || "#3860AA"}
                    onChange={(e) => set({ accentColor: e.target.value })}
                    className="h-9 w-12 cursor-pointer rounded border-0 p-0"
                    disabled={!isManager}
                  />
                  {opts.accentColor ? (
                    <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => set({ accentColor: undefined })}>
                      <RotateCcw className="h-3 w-3" /> Color de la plantilla
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Usando el color propio de la plantilla</span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Texto del pie de página</Label>
              <Input
                value={opts.footerText || ""}
                onChange={(e) => set({ footerText: e.target.value })}
                placeholder="Documento generado automáticamente"
                disabled={!isManager}
              />
            </div>

            <div className="space-y-2">
              <Label>Datos que aparecen</Label>
              {TOGGLES.map((t) => (
                <div key={String(t.key)} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                  </div>
                  <Switch
                    checked={(opts as any)[t.key] !== false}
                    onCheckedChange={(v) => set({ [t.key]: v } as any)}
                    disabled={!isManager}
                  />
                </div>
              ))}
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-medium"><QrCode className="h-3.5 w-3.5" /> QR tributario VERI*FACTU</p>
                  <p className="text-xs text-muted-foreground">
                    Se imprime al inicio del documento cuando la factura tiene QR. Obligatorio si emites con VERI*FACTU.
                  </p>
                </div>
                <Switch
                  checked={opts.showQr !== false}
                  onCheckedChange={(v) => set({ showQr: v })}
                  disabled={!isManager}
                />
              </div>
            </div>

            {isManager && (
              <div className="flex justify-end border-t border-border pt-4">
                <Button onClick={handleSave} disabled={saving || !dirty} className="gap-1.5">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar cambios
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Vista previa en vivo ─── */}
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vista previa</CardTitle>
            <CardDescription>{INVOICE_TEMPLATES.find((t) => t.id === template)?.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-hidden rounded-lg border border-border bg-white shadow-sm" style={{ aspectRatio: "210/297" }}>
              <iframe
                srcDoc={previewHtml}
                title="Vista previa personalizada"
                className="h-full w-full border-0"
                sandbox="allow-same-origin"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InvoiceTemplateTab;
