import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { INVOICE_TEMPLATES } from "@/components/invoices/invoiceTemplates";
import BrandIdentityFields, {
  EMPTY_IDENTITY, identityFromRow, identityToPayload, type BrandIdentity,
} from "@/components/brands/BrandIdentityFields";

interface Props {
  accountId: string;
  accountName: string;
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
}

/**
 * Alta y baja de marcas de una cuenta cliente.
 *
 * Vive en el Panel Admin y no en la configuración del cliente porque qué
 * marcas tiene contratadas —y con qué módulos— es una decisión comercial de
 * XpertConsulting. Al cliente le queda retocar la imagen de las que ya tiene.
 *
 * Una marca no es una empresa aparte: el NIF y la serie de numeración siguen
 * siendo los de la cuenta principal, y la contabilidad se lleva entera desde
 * ella. Lo que cambia es con qué nombre se factura y qué se ve por dentro.
 */
const BrandManager = ({ accountId, accountName }: Props) => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<BrandRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<BrandRow | null>(null);
  const [identity, setIdentity] = useState<BrandIdentity>({ ...EMPTY_IDENTITY });
  const [isActive, setIsActive] = useState(true);
  const [modules, setModules] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ["master-brands", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands").select("*").eq("account_id", accountId)
        .order("is_default", { ascending: false }).order("sort_order").order("name");
      if (error) throw error;
      return data as BrandRow[];
    },
    enabled: !!accountId,
  });

  /* Solo los módulos que la cuenta tiene contratados: habilitar en una marca
     algo que la cuenta no ha comprado sería prometer lo que no hay. */
  const { data: accountModules = [] } = useQuery({
    queryKey: ["master-account-modules-catalog", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_modules")
        .select("module_id, service_modules(id, name)")
        .eq("account_id", accountId).eq("is_enabled", true);
      if (error) throw error;
      return (data || []).map((m: any) => ({ id: m.module_id, name: m.service_modules?.name }));
    },
    enabled: !!accountId,
  });

  const { data: brandModules = [] } = useQuery({
    queryKey: ["master-brand-modules", accountId],
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

  const openCreate = () => {
    setIdentity({ ...EMPTY_IDENTITY });
    setIsActive(true);
    // Una marca nueva nace con todo lo que la cuenta tiene: quitar es más
    // rápido que ir marcando módulo a módulo.
    setModules(new Set(accountModules.map((m) => m.id)));
    setCreating(true);
  };

  const openEdit = (b: BrandRow) => {
    setIdentity(identityFromRow(b));
    setIsActive(b.is_active);
    setModules(new Set(
      brandModules.filter((m: any) => m.brand_id === b.id && m.is_enabled).map((m: any) => m.module_id),
    ));
    setEditing(b);
  };

  const closeDialog = () => { setEditing(null); setCreating(false); };

  const save = async () => {
    if (!identity.name.trim()) {
      toast({ title: "La marca necesita un nombre", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...identityToPayload(identity, editing?.invoice_template_options),
        account_id: accountId,
        is_active: isActive,
      };

      let brandId = editing?.id;
      if (editing) {
        const { error } = await supabase.from("brands").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("brands").insert(payload).select("id").single();
        if (error) throw error;
        brandId = data.id;
      }

      // Se reescribe el conjunto de módulos en lugar de calcular altas y bajas:
      // con media docena de filas no compensa.
      if (brandId) {
        await supabase.from("brand_modules").delete().eq("brand_id", brandId);
        if (modules.size > 0) {
          const rows = Array.from(modules).map((module_id) => ({
            account_id: accountId, brand_id: brandId!, module_id, is_enabled: true,
          }));
          const { error } = await supabase.from("brand_modules").insert(rows);
          if (error) throw error;
        }
      }

      toast({ title: editing ? "Marca actualizada" : "Marca creada" });
      qc.invalidateQueries({ queryKey: ["master-brands", accountId] });
      qc.invalidateQueries({ queryKey: ["master-brand-modules", accountId] });
      closeDialog();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      const { error } = await supabase.from("brands").delete().eq("id", deleting.id);
      if (error) throw error;
      toast({
        title: "Marca eliminada",
        description: "Sus facturas y clientes no se borran: se quedan sin marca.",
      });
      qc.invalidateQueries({ queryKey: ["master-brands", accountId] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-faint" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-[440px] text-[11.5px] leading-[1.6] text-muted-foreground">
          Marcas con las que {accountName} puede facturar. Comparten NIF, numeración y
          contabilidad con la cuenta principal. Los módulos que le habilites deciden si se
          puede trabajar dentro de la marca; sin ninguno, solo emite facturas a su nombre.
        </p>
        <Button onClick={openCreate} className="shrink-0">
          <Plus /> Nueva marca
        </Button>
      </div>

      <div className="space-y-2">
        {brands.map((b) => {
          const mods = moduleCount(b.id);
          return (
            <Card key={b.id} className="flex items-start gap-3 px-4 py-3">
              <span
                className="mt-0.5 h-6 w-6 shrink-0 rounded-control border border-border-strong"
                style={{ background: b.color || "hsl(var(--muted))" }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[12.5px] font-semibold text-foreground">{b.name}</p>
                  {b.is_default && <Badge variant="info">Principal</Badge>}
                  {!b.is_active && <Badge variant="muted">Inactiva</Badge>}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Plantilla {INVOICE_TEMPLATES.find((t) => t.id === b.invoice_template)?.name ?? b.invoice_template}
                  {" · "}
                  {mods === 0 ? "solo facturación" : `${mods} ${mods === 1 ? "módulo" : "módulos"}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button variant="ghost" size="icon" onClick={() => openEdit(b)} aria-label={`Editar ${b.name}`}>
                  <Pencil />
                </Button>
                {/* La marca principal recoge lo que no tiene marca propia:
                    sin ella, esos datos se quedarían huérfanos. */}
                {!b.is_default && (
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => setDeleting(b)}
                    aria-label={`Eliminar ${b.name}`}
                    className="text-destructive-text hover:bg-destructive-surface"
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={creating || !!editing} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle>{editing ? `Editar ${editing.name}` : "Nueva marca"}</DialogTitle>
            <DialogDescription>
              Marca de {accountName}. El NIF y la numeración siguen siendo los de la cuenta.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-5 overflow-y-auto bg-muted/30 px-6 py-5">
            <BrandIdentityFields value={identity} onChange={setIdentity} />

            <div className="space-y-2">
              <Label>Módulos disponibles en la marca</Label>
              {accountModules.length === 0 ? (
                <p className="text-[11.5px] text-muted-foreground">
                  La cuenta no tiene módulos contratados.
                </p>
              ) : (
                <>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {accountModules.map((m) => (
                      <label
                        key={m.id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-control border border-border bg-card px-3 py-2 text-xs text-foreground transition-colors hover:bg-popover"
                      >
                        <Checkbox
                          checked={modules.has(m.id)}
                          onCheckedChange={(v) => {
                            const next = new Set(modules);
                            if (v) next.add(m.id); else next.delete(m.id);
                            setModules(next);
                          }}
                        />
                        {m.name}
                      </label>
                    ))}
                  </div>
                  <p className="text-[10.5px] leading-[1.6] text-muted-foreground">
                    Sin ningún módulo marcado, la marca no aparecerá en el conmutador y servirá
                    únicamente para emitir facturas a su nombre.
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center justify-between rounded-control border border-border bg-card px-3 py-2.5">
              <div>
                <p className="text-xs font-medium text-foreground">Marca activa</p>
                <p className="text-[10.5px] text-muted-foreground">
                  Una marca inactiva deja de ofrecerse al facturar.
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <DialogFooter className="border-t border-border px-6 py-4">
            <Button variant="ghost" onClick={closeDialog} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {editing ? "Guardar" : "Crear marca"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Las facturas, clientes y demás datos que tuviera asignados no se borran: se quedan
              sin marca y el cliente podrá reasignarlos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BrandManager;
