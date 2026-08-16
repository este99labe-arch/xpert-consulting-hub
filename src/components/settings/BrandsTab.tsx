import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Pencil, Tag } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { INVOICE_TEMPLATES } from "@/components/invoices/invoiceTemplates";
import EmptyState from "@/components/shared/EmptyState";
import BrandIdentityFields, {
  identityFromRow, identityToPayload, EMPTY_IDENTITY, type BrandIdentity,
} from "@/components/brands/BrandIdentityFields";

interface Props {
  accountId: string;
  isManager: boolean;
}

interface BrandRow {
  id: string;
  name: string;
  color: string | null;
  logo_url: string | null;
  invoice_template: string;
  invoice_template_options: any;
  legal_footer: string | null;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
}

/**
 * Marcas comerciales de la cuenta.
 *
 * Una marca es una identidad de facturación —nombre, logotipo y plantilla—, no
 * una empresa aparte: el emisor fiscal, la serie de numeración y la
 * contabilidad siguen siendo los de la cuenta principal.
 *
 * Aquí solo se retoca su imagen. Qué marcas existen y qué módulos tiene cada
 * una lo decide XpertConsulting desde el Panel Admin, porque es parte de lo
 * que se contrata. Es también la razón de que no haya botones de crear ni de
 * eliminar: las RLS los rechazarían, así que ofrecerlos sería mentir.
 */
const BrandsTab = ({ accountId, isManager }: Props) => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<BrandRow | null>(null);
  const [identity, setIdentity] = useState<BrandIdentity>({ ...EMPTY_IDENTITY });
  const [saving, setSaving] = useState(false);

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ["brands", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands").select("*").eq("account_id", accountId)
        .order("is_default", { ascending: false }).order("sort_order").order("name");
      if (error) throw error;
      return data as BrandRow[];
    },
    enabled: !!accountId,
  });

  /* Los módulos se muestran, pero no se tocan: sirven para entender qué es
     cada marca sin dar a entender que se pueden cambiar desde aquí. */
  const { data: brandModules = [] } = useQuery({
    queryKey: ["brand-modules", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_modules").select("brand_id, module_id, is_enabled").eq("account_id", accountId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const moduleCount = (brandId: string) =>
    brandModules.filter((m: any) => m.brand_id === brandId && m.is_enabled).length;

  const openEdit = (b: BrandRow) => {
    setIdentity(identityFromRow(b));
    setEditing(b);
  };

  const save = async () => {
    if (!editing) return;
    if (!identity.name.trim()) {
      toast({ title: "La marca necesita un nombre", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("brands")
        .update(identityToPayload(identity, editing.invoice_template_options))
        .eq("id", editing.id);
      if (error) throw error;

      toast({ title: "Marca actualizada" });
      qc.invalidateQueries({ queryKey: ["brands", accountId] });
      setEditing(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-faint" /></div>;
  }

  return (
    <div className="space-y-4">
      <p className="max-w-[560px] text-[11.5px] leading-[1.6] text-muted-foreground">
        Una marca factura con su propio nombre y plantilla, pero bajo el NIF, la numeración y la
        contabilidad de la cuenta. Aquí ajustas su imagen; para dar de alta una marca nueva o
        cambiar los módulos de una existente, habla con XpertConsulting.
      </p>

      {brands.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="Todavía no hay marcas"
          description="Las marcas las da de alta XpertConsulting. Escríbenos si necesitas facturar con otro nombre."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {brands.map((b) => {
            const mods = moduleCount(b.id);
            return (
              <Card key={b.id} className="px-[18px] py-4">
                <div className="flex items-start gap-3">
                  <span
                    className="mt-0.5 h-7 w-7 shrink-0 rounded-control border border-border-strong"
                    style={{ background: b.color || "hsl(var(--muted))" }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[12.5px] font-semibold text-foreground">{b.name}</p>
                      {b.is_default && <Badge variant="info">Principal</Badge>}
                      {!b.is_active && <Badge variant="muted">Inactiva</Badge>}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Plantilla {INVOICE_TEMPLATES.find((t) => t.id === b.invoice_template)?.name ?? b.invoice_template}
                      {" · "}
                      {mods === 0
                        ? "solo facturación"
                        : `${mods} ${mods === 1 ? "módulo" : "módulos"}`}
                    </p>
                  </div>
                  {isManager && (
                    <Button variant="ghost" size="icon" onClick={() => openEdit(b)} aria-label={`Editar ${b.name}`}>
                      <Pencil />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Edición de la identidad ─────────────────────────── */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle>Editar {editing?.name}</DialogTitle>
            <DialogDescription>
              Cómo se presenta esta marca en sus facturas. El NIF y la numeración siguen siendo
              los de la cuenta.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-5 overflow-y-auto bg-muted/30 px-6 py-5">
            <BrandIdentityFields value={identity} onChange={setIdentity} />
          </div>

          <DialogFooter className="border-t border-border px-6 py-4">
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BrandsTab;
