import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Pencil, Trash2, Tag, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { INVOICE_TEMPLATES, type InvoiceTemplateId } from "@/components/invoices/invoiceTemplates";
import EmptyState from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";

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

const EMPTY = {
  name: "",
  color: "#4A7BD4",
  logo_url: "",
  invoice_template: "classic" as InvoiceTemplateId,
  legal_footer: "",
  display_name: "",
  is_active: true,
};

/**
 * Marcas comerciales de la cuenta.
 *
 * Una marca es una identidad de facturación —nombre, logotipo y plantilla—,
 * no una empresa aparte: el emisor fiscal y la serie de numeración siguen
 * siendo los de la cuenta. Lo que sí decide la marca es qué se ve: los
 * módulos que tenga habilitados determinan si aparece en el conmutador o si
 * solo sirve para emitir facturas a su nombre.
 */
const BrandsTab = ({ accountId, isManager }: Props) => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<BrandRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<BrandRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [modules, setModules] = useState<Set<string>>(new Set());
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

  /* Solo se ofrecen los módulos que la cuenta tiene contratados: habilitar en
     una marca algo que la cuenta no tiene sería prometer lo que no hay. */
  const { data: accountModules = [] } = useQuery({
    queryKey: ["account-modules-catalog", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_modules")
        .select("module_id, is_enabled, service_modules(id, code, name)")
        .eq("account_id", accountId).eq("is_enabled", true);
      if (error) throw error;
      return (data || []).map((m: any) => ({ id: m.module_id, name: m.service_modules?.name, code: m.service_modules?.code }));
    },
    enabled: !!accountId,
  });

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

  const openCreate = () => {
    setForm({ ...EMPTY });
    setModules(new Set(accountModules.map((m) => m.id)));
    setCreating(true);
  };

  const openEdit = (b: BrandRow) => {
    setForm({
      name: b.name,
      color: b.color || "#4A7BD4",
      logo_url: b.logo_url || "",
      invoice_template: (b.invoice_template as InvoiceTemplateId) || "classic",
      legal_footer: b.legal_footer || "",
      display_name: b.invoice_template_options?.displayName || "",
      is_active: b.is_active,
    });
    setModules(new Set(
      brandModules.filter((m: any) => m.brand_id === b.id && m.is_enabled).map((m: any) => m.module_id),
    ));
    setEditing(b);
  };

  const closeDialog = () => { setEditing(null); setCreating(false); };

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: "La marca necesita un nombre", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        account_id: accountId,
        name: form.name.trim(),
        color: form.color || null,
        logo_url: form.logo_url.trim() || null,
        invoice_template: form.invoice_template,
        legal_footer: form.legal_footer.trim() || null,
        is_active: form.is_active,
        // El nombre que sale como emisor en la factura, si difiere del de la marca
        invoice_template_options: {
          ...(editing?.invoice_template_options || {}),
          displayName: form.display_name.trim() || undefined,
          accentColor: form.color || undefined,
        },
        updated_at: new Date().toISOString(),
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

      // Módulos: se reescribe el conjunto de la marca en lugar de calcular
      // altas y bajas, que con cuatro filas no compensa.
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
      qc.invalidateQueries({ queryKey: ["brands", accountId] });
      qc.invalidateQueries({ queryKey: ["brand-modules", accountId] });
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
        description: "Lo que tuviera asignado se queda sin marca; podrás reasignarlo desde cada ficha.",
      });
      qc.invalidateQueries({ queryKey: ["brands", accountId] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-faint" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-[560px] text-[11.5px] leading-[1.6] text-muted-foreground">
          Una marca factura con su propio nombre y plantilla, pero bajo el NIF y la numeración de
          la cuenta. Los módulos que le habilites deciden si se puede trabajar dentro de ella;
          una marca sin módulos sirve solo para emitir facturas a su nombre.
        </p>
        {isManager && (
          <Button onClick={openCreate} className="shrink-0">
            <Plus /> Nueva marca
          </Button>
        )}
      </div>

      {brands.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="Todavía no hay marcas"
          description="Crea una marca para facturar con un nombre y una plantilla distintos."
          actionLabel={isManager ? "Nueva marca" : undefined}
          onAction={isManager ? openCreate : undefined}
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
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(b)} aria-label={`Editar ${b.name}`}>
                        <Pencil />
                      </Button>
                      {/* La marca principal recoge lo que no tiene marca propia: sin
                          ella, los datos se quedarían huérfanos. */}
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
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Alta y edición ─────────────────────────────────── */}
      <Dialog open={creating || !!editing} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle>{editing ? `Editar ${editing.name}` : "Nueva marca"}</DialogTitle>
            <DialogDescription>
              Identidad comercial y módulos disponibles. El NIF y la numeración siguen siendo los
              de la cuenta.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-5 overflow-y-auto bg-muted/30 px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="brand-name">Nombre de la marca</Label>
                <Input
                  id="brand-name" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Xpert Prevention"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brand-display">Nombre en la factura</Label>
                <Input
                  id="brand-display" value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
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
                    id="brand-color" type="color" value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="h-8 w-10 cursor-pointer rounded-control border border-input bg-muted p-1"
                  />
                  <Input
                    value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="tnum flex-1"
                  />
                </div>
                <p className="text-[10.5px] text-muted-foreground">
                  Identifica la marca en la aplicación y tiñe el acento de sus facturas.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brand-logo">Logotipo (URL)</Label>
                <Input
                  id="brand-logo" value={form.logo_url}
                  onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                  placeholder="https://…/logo.png"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="brand-footer">Pie legal de sus facturas</Label>
              <Textarea
                id="brand-footer" value={form.legal_footer}
                onChange={(e) => setForm({ ...form, legal_footer: e.target.value })}
                placeholder="Inscrita en el Registro Mercantil de…"
              />
            </div>

            <div className="space-y-2">
              <Label>Plantilla de factura</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {INVOICE_TEMPLATES.map((t) => {
                  const active = form.invoice_template === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setForm({ ...form, invoice_template: t.id })}
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
                            v ? next.add(m.id) : next.delete(m.id);
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
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
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
              sin marca y podrás reasignarlos. Esta acción no se puede deshacer.
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

export default BrandsTab;
