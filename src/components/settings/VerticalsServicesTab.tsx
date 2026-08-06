import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import EmptyState from "@/components/shared/EmptyState";
import { Layers, Plus, Pencil, Trash2, ChevronDown, ChevronUp, GripVertical, Package } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props { accountId: string; isManager: boolean; }

type Vertical = {
  id: string; name: string; description: string | null;
  sort_order: number; is_active: boolean;
};
type Service = {
  id: string; vertical_id: string; name: string; description: string | null;
  price: number; billing_period: string; sort_order: number; is_active: boolean;
  is_default_for_new_accounts: boolean;
};

const BILLING_LABELS: Record<string, string> = {
  MONTHLY: "Mensual", QUARTERLY: "Trimestral", YEARLY: "Anual", ONE_OFF: "Pago único",
};

const EUR = (n: number) =>
  n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

/**
 * Gestión de líneas de negocio (verticales) y sus servicios.
 *
 * Todo se lee de la base de datos: añadir una vertical o un servicio nuevo NO
 * requiere tocar código. Los borrados se apoyan en las restricciones de la BD
 * (no se puede borrar una vertical con servicios ni un servicio contratado).
 */
const VerticalsServicesTab = ({ accountId, isManager }: Props) => {
  const qc = useQueryClient();
  const [openVertical, setOpenVertical] = useState<string | null>(null);
  const [verticalForm, setVerticalForm] = useState<Partial<Vertical> | null>(null);
  const [serviceForm, setServiceForm] = useState<(Partial<Service> & { vertical_id?: string }) | null>(null);
  const [toDelete, setToDelete] = useState<{ kind: "vertical" | "service"; id: string; name: string } | null>(null);

  const { data: verticals = [], isLoading } = useQuery({
    queryKey: ["verticals", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verticals")
        .select("id, name, description, sort_order, is_active")
        .eq("account_id", accountId)
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data || []) as Vertical[];
    },
    enabled: !!accountId,
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, vertical_id, name, description, price, billing_period, sort_order, is_active, is_default_for_new_accounts")
        .eq("account_id", accountId)
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data || []) as Service[];
    },
    enabled: !!accountId,
  });

  /** Nº de servicios por vertical: gobierna si se puede borrar. */
  const servicesByVertical = useMemo(() => {
    const map = new Map<string, Service[]>();
    services.forEach((s) => {
      const list = map.get(s.vertical_id) || [];
      list.push(s);
      map.set(s.vertical_id, list);
    });
    return map;
  }, [services]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["verticals", accountId] });
    qc.invalidateQueries({ queryKey: ["services", accountId] });
  };

  const fail = (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" });

  // ----------------------------------------------------------- verticales
  const saveVertical = useMutation({
    mutationFn: async (v: Partial<Vertical>) => {
      const payload = {
        name: (v.name || "").trim(),
        description: v.description?.trim() || null,
        is_active: v.is_active ?? true,
      };
      if (!payload.name) throw new Error("El nombre es obligatorio");
      if (v.id) {
        const { error } = await supabase.from("verticals").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        const nextOrder = verticals.length
          ? Math.max(...verticals.map((x) => x.sort_order)) + 1
          : 0;
        const { error } = await supabase
          .from("verticals")
          .insert({ ...payload, account_id: accountId, sort_order: nextOrder });
        if (error) throw error;
      }
    },
    onSuccess: () => { setVerticalForm(null); refresh(); toast({ title: "Vertical guardada" }); },
    onError: fail,
  });

  const toggleVertical = useMutation({
    mutationFn: async (v: Vertical) => {
      const { error } = await supabase.from("verticals").update({ is_active: !v.is_active }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: fail,
  });

  const moveVertical = useMutation({
    mutationFn: async ({ v, dir }: { v: Vertical; dir: -1 | 1 }) => {
      const idx = verticals.findIndex((x) => x.id === v.id);
      const target = verticals[idx + dir];
      if (!target) return;
      // Intercambia el orden con el vecino.
      const a = supabase.from("verticals").update({ sort_order: target.sort_order }).eq("id", v.id);
      const b = supabase.from("verticals").update({ sort_order: v.sort_order }).eq("id", target.id);
      const [r1, r2] = await Promise.all([a, b]);
      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;
    },
    onSuccess: refresh,
    onError: fail,
  });

  // ------------------------------------------------------------- servicios
  const saveService = useMutation({
    mutationFn: async (s: Partial<Service> & { vertical_id?: string }) => {
      const name = (s.name || "").trim();
      if (!name) throw new Error("El nombre es obligatorio");
      if (!s.vertical_id) throw new Error("Selecciona una vertical");
      const payload = {
        name,
        description: s.description?.trim() || null,
        price: Number(s.price) || 0,
        billing_period: s.billing_period || "MONTHLY",
        vertical_id: s.vertical_id,
        is_active: s.is_active ?? true,
        is_default_for_new_accounts: s.is_default_for_new_accounts ?? false,
      };
      if (s.id) {
        const { error } = await supabase.from("services").update(payload).eq("id", s.id);
        if (error) throw error;
      } else {
        const siblings = servicesByVertical.get(s.vertical_id) || [];
        const nextOrder = siblings.length ? Math.max(...siblings.map((x) => x.sort_order)) + 1 : 0;
        const { error } = await supabase
          .from("services")
          .insert({ ...payload, account_id: accountId, sort_order: nextOrder });
        if (error) throw error;
      }
    },
    onSuccess: () => { setServiceForm(null); refresh(); toast({ title: "Servicio guardado" }); },
    onError: fail,
  });

  const toggleService = useMutation({
    mutationFn: async (s: Service) => {
      const { error } = await supabase.from("services").update({ is_active: !s.is_active }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: fail,
  });

  // --------------------------------------------------------------- borrado
  const remove = useMutation({
    mutationFn: async ({ kind, id }: { kind: "vertical" | "service"; id: string }) => {
      const { error } = await supabase.from(kind === "vertical" ? "verticals" : "services").delete().eq("id", id);
      // La BD impide borrar si hay dependencias (ON DELETE RESTRICT).
      if (error) {
        if (error.code === "23503") {
          throw new Error(
            kind === "vertical"
              ? "No se puede eliminar: la vertical tiene servicios asociados."
              : "No se puede eliminar: el servicio tiene contrataciones. Desactívalo en su lugar.",
          );
        }
        throw error;
      }
    },
    onSuccess: () => { setToDelete(null); refresh(); toast({ title: "Eliminado" }); },
    onError: (e: any) => { setToDelete(null); fail(e); },
  });

  if (!isManager) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Solo los administradores pueden gestionar las líneas de negocio.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-accent-foreground" />
                <CardTitle className="text-base">Líneas de negocio</CardTitle>
              </div>
              <CardDescription className="mt-1">
                Define tus verticales (ERP, Security, Hosting…) y los servicios de cada una.
                Después podrás contratárselos a cada cliente desde su ficha.
              </CardDescription>
            </div>
            <Button onClick={() => setVerticalForm({ is_active: true })} className="gap-1.5 shrink-0">
              <Plus className="h-4 w-4" /> Nueva vertical
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {isLoading && <p className="py-6 text-center text-xs text-muted-foreground">Cargando…</p>}

          {!isLoading && verticals.length === 0 && (
            <EmptyState
              bare
              icon={Layers}
              title="Aún no hay líneas de negocio"
              description="Crea tu primera vertical (por ejemplo ERP o Hosting) y añádele servicios."
              actionLabel="Nueva vertical"
              onAction={() => setVerticalForm({ is_active: true })}
            />
          )}

          {verticals.map((v, i) => {
            const list = servicesByVertical.get(v.id) || [];
            const isOpen = openVertical === v.id;
            return (
              <Collapsible
                key={v.id}
                open={isOpen}
                onOpenChange={(o) => setOpenVertical(o ? v.id : null)}
                className="rounded-lg border border-border"
              >
                <div className="flex items-center gap-2 p-3">
                  <div className="flex flex-col">
                    <Button
                      variant="ghost" size="icon" className="h-5 w-5"
                      disabled={i === 0}
                      onClick={() => moveVertical.mutate({ v, dir: -1 })}
                      aria-label="Subir"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-5 w-5"
                      disabled={i === verticals.length - 1}
                      onClick={() => moveVertical.mutate({ v, dir: 1 })}
                      aria-label="Bajar"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{v.name}</p>
                      {v.description && (
                        <p className="truncate text-xs text-muted-foreground">{v.description}</p>
                      )}
                    </div>
                    <Badge variant="muted" className="ml-1 shrink-0">{list.length}</Badge>
                    {!v.is_active && <Badge variant="warning" className="shrink-0">Inactiva</Badge>}
                  </CollapsibleTrigger>

                  <div className="flex shrink-0 items-center gap-1">
                    <Switch
                      checked={v.is_active}
                      onCheckedChange={() => toggleVertical.mutate(v)}
                      aria-label="Activar vertical"
                    />
                    <Button variant="ghost" size="icon" onClick={() => setVerticalForm(v)} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => setToDelete({ kind: "vertical", id: v.id, name: v.name })}
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>

                <CollapsibleContent className="border-t border-border bg-muted/30 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Servicios</p>
                    <Button
                      size="sm" variant="outline" className="gap-1.5"
                      onClick={() => setServiceForm({ vertical_id: v.id, is_active: true, billing_period: "MONTHLY", price: 0 })}
                    >
                      <Plus className="h-3.5 w-3.5" /> Añadir servicio
                    </Button>
                  </div>

                  {list.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      Esta vertical todavía no tiene servicios.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {list.map((s) => (
                        <div key={s.id} className="flex items-center gap-2 rounded-md bg-card p-2.5">
                          <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{s.name}</p>
                            {s.description && (
                              <p className="truncate text-xs text-muted-foreground">{s.description}</p>
                            )}
                          </div>
                          <span className="shrink-0 text-xs tabular-nums">{EUR(s.price)}</span>
                          <Badge variant="secondary" className="shrink-0">
                            {BILLING_LABELS[s.billing_period] ?? s.billing_period}
                          </Badge>
                          {s.is_default_for_new_accounts && (
                            <Badge variant="info" className="shrink-0" title="Se contrata solo en cuentas nuevas">
                              Por defecto
                            </Badge>
                          )}
                          {!s.is_active && <Badge variant="warning" className="shrink-0">Inactivo</Badge>}
                          <Switch
                            checked={s.is_active}
                            onCheckedChange={() => toggleService.mutate(s)}
                            aria-label="Activar servicio"
                          />
                          <Button variant="ghost" size="icon" onClick={() => setServiceForm(s)} aria-label="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => setToDelete({ kind: "service", id: s.id, name: s.name })}
                            aria-label="Eliminar"
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </CardContent>
      </Card>

      {/* ------------------------------------------------ diálogo de vertical */}
      <Dialog open={!!verticalForm} onOpenChange={(o) => !o && setVerticalForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{verticalForm?.id ? "Editar vertical" : "Nueva vertical"}</DialogTitle>
            <DialogDescription>
              Una vertical agrupa los servicios de una misma línea de negocio.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                value={verticalForm?.name ?? ""}
                onChange={(e) => setVerticalForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej.: Security"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea
                rows={2}
                value={verticalForm?.description ?? ""}
                onChange={(e) => setVerticalForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label>Activa</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Las inactivas no se ofrecen al contratar servicios nuevos.
                </p>
              </div>
              <Switch
                checked={verticalForm?.is_active ?? true}
                onCheckedChange={(v) => setVerticalForm((f) => ({ ...f, is_active: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerticalForm(null)}>Cancelar</Button>
            <Button
              onClick={() => verticalForm && saveVertical.mutate(verticalForm)}
              disabled={saveVertical.isPending}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------- diálogo de servicio */}
      <Dialog open={!!serviceForm} onOpenChange={(o) => !o && setServiceForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{serviceForm?.id ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
            <DialogDescription>
              El precio es el de catálogo; al contratarlo podrás pactar otro distinto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Vertical</Label>
              <Select
                value={serviceForm?.vertical_id ?? ""}
                onValueChange={(v) => setServiceForm((f) => ({ ...f, vertical_id: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>
                  {verticals.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                value={serviceForm?.name ?? ""}
                onChange={(e) => setServiceForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej.: Alarma Hogar"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea
                rows={2}
                value={serviceForm?.description ?? ""}
                onChange={(e) => setServiceForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Precio (€)</Label>
                <Input
                  type="number" min={0} step="0.01"
                  value={serviceForm?.price ?? 0}
                  onChange={(e) => setServiceForm((f) => ({ ...f, price: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Periodicidad</Label>
                <Select
                  value={serviceForm?.billing_period ?? "MONTHLY"}
                  onValueChange={(v) => setServiceForm((f) => ({ ...f, billing_period: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(BILLING_LABELS).map(([k, l]) => (
                      <SelectItem key={k} value={k}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label>Activo</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Los inactivos no aparecen al contratar, pero se conservan los contratos existentes.
                </p>
              </div>
              <Switch
                checked={serviceForm?.is_active ?? true}
                onCheckedChange={(v) => setServiceForm((f) => ({ ...f, is_active: v }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label>Contratar automáticamente en cuentas nuevas</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Al crear una cuenta ERP desde el Panel Admin, este servicio se dará de alta
                  solo para ese cliente.
                </p>
              </div>
              <Switch
                checked={serviceForm?.is_default_for_new_accounts ?? false}
                onCheckedChange={(v) => setServiceForm((f) => ({ ...f, is_default_for_new_accounts: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceForm(null)}>Cancelar</Button>
            <Button
              onClick={() => serviceForm && saveService.mutate(serviceForm)}
              disabled={saveService.isPending}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --------------------------------------------------- confirmar borrado */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{toDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.kind === "vertical"
                ? "Solo se puede eliminar si no tiene servicios asociados. Si quieres conservarla sin usarla, desactívala."
                : "Solo se puede eliminar si ningún cliente lo tiene contratado. Si ya se ha vendido, desactívalo para conservar el histórico."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toDelete && remove.mutate(toDelete)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VerticalsServicesTab;
