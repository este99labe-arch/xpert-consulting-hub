import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check } from "lucide-react";
import { INVOICE_TEMPLATES, type InvoiceTemplateId } from "@/components/invoices/invoiceTemplates";
import { cn } from "@/lib/utils";

/**
 * Identidad comercial de una marca: lo que sale impreso en sus facturas.
 *
 * Se comparte entre el Panel Admin —que da de alta y de baja las marcas— y la
 * configuración del cliente —que solo retoca su imagen—. Son dos pantallas con
 * permisos distintos pero los mismos campos, y separadas se desincronizarían a
 * la primera plantilla nueva.
 */
export interface BrandIdentity {
  name: string;
  display_name: string;
  color: string;
  logo_url: string;
  invoice_template: InvoiceTemplateId;
  legal_footer: string;
}

export const EMPTY_IDENTITY: BrandIdentity = {
  name: "",
  display_name: "",
  color: "#4A7BD4",
  logo_url: "",
  invoice_template: "classic",
  legal_footer: "",
};

/** Fila de `brands` → valores del formulario. */
export const identityFromRow = (b: any): BrandIdentity => ({
  name: b.name ?? "",
  display_name: b.invoice_template_options?.displayName ?? "",
  color: b.color || "#4A7BD4",
  logo_url: b.logo_url ?? "",
  invoice_template: (b.invoice_template as InvoiceTemplateId) || "classic",
  legal_footer: b.legal_footer ?? "",
});

/** Valores del formulario → columnas de `brands`. */
export const identityToPayload = (f: BrandIdentity, previousOptions?: any) => ({
  name: f.name.trim(),
  color: f.color || null,
  logo_url: f.logo_url.trim() || null,
  invoice_template: f.invoice_template,
  legal_footer: f.legal_footer.trim() || null,
  invoice_template_options: {
    ...(previousOptions || {}),
    displayName: f.display_name.trim() || undefined,
    accentColor: f.color || undefined,
  },
  updated_at: new Date().toISOString(),
});

interface Props {
  value: BrandIdentity;
  onChange: (next: BrandIdentity) => void;
  /** El nombre lo fija quien da de alta la marca; el cliente solo lo lee. */
  nameReadOnly?: boolean;
}

const BrandIdentityFields = ({ value, onChange, nameReadOnly }: Props) => {
  const set = (patch: Partial<BrandIdentity>) => onChange({ ...value, ...patch });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="brand-name">Nombre de la marca</Label>
          <Input
            id="brand-name"
            value={value.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Xpert Prevention"
            disabled={nameReadOnly}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="brand-display">Nombre en la factura</Label>
          <Input
            id="brand-display"
            value={value.display_name}
            onChange={(e) => set({ display_name: e.target.value })}
            placeholder="(el de la marca)"
          />
          <p className="text-[10.5px] text-muted-foreground">
            Solo si el emisor debe leerse distinto del nombre de la marca.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="brand-color">Color</Label>
          <div className="flex items-center gap-2">
            <input
              id="brand-color"
              type="color"
              value={value.color}
              onChange={(e) => set({ color: e.target.value })}
              className="h-8 w-10 cursor-pointer rounded-control border border-input bg-muted p-1"
            />
            <Input value={value.color} onChange={(e) => set({ color: e.target.value })} className="tnum flex-1" />
          </div>
          <p className="text-[10.5px] text-muted-foreground">
            Identifica la marca en la aplicación y tiñe el acento de sus facturas.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="brand-logo">Logotipo (URL)</Label>
          <Input
            id="brand-logo"
            value={value.logo_url}
            onChange={(e) => set({ logo_url: e.target.value })}
            placeholder="https://…/logo.png"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="brand-footer">Pie legal de sus facturas</Label>
        <Textarea
          id="brand-footer"
          value={value.legal_footer}
          onChange={(e) => set({ legal_footer: e.target.value })}
          placeholder="Inscrita en el Registro Mercantil de…"
        />
      </div>

      <div className="space-y-2">
        <Label>Plantilla de factura</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {INVOICE_TEMPLATES.map((t) => {
            const active = value.invoice_template === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => set({ invoice_template: t.id })}
                className={cn(
                  "rounded-control border p-2.5 text-left transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/[.16]",
                  active ? "border-primary bg-row-selected" : "border-border bg-card hover:bg-popover",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-foreground">{t.name}</span>
                  {active && <Check className="ml-auto h-3.5 w-3.5 stroke-[2.4] text-accent-foreground" />}
                </div>
                <p className="mt-0.5 text-[10.5px] leading-[1.5] text-muted-foreground">{t.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default BrandIdentityFields;
