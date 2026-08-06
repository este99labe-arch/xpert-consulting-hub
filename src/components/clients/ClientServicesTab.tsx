import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import EmptyState from "@/components/shared/EmptyState";
import { Layers, Plus, Package, Ban, PlayCircle, PauseCircle, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props { clientId: string; accountId: string; isAdmin: boolean; }

type Contract = {
  id: string; service_id: string; vertical_id: string;
  status: "ACTIVE" | "PAUSED" | "CANCELLED";
  start_date: string; end_date: string | null;
  price: number | null; notes: string | null;
  services: { name: string; price: number; billing_period: string } | null;
  verticals: { name: string } | null;
};

const STATUS: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  ACTIVE: { label: "Activo", variant: "success" },
  PAUSED: { label: "Pausado", variant: "warning" },
  CANCELLED: { label: "Baja", variant: "muted" },
};

const BILLING_LABELS: Record<string, string> = {
  MONTHLY: "Mensual", QUARTERLY: "Trimestral", YEARLY: "Anual", ONE_OFF: "Pago único",
};

const EUR = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const fmt = (d: string) => format(new Date(d), "d MMM yyyy", { locale: es });

/**
 * Servicios que el cliente tiene contratados, agrupados por vertical.
 *
 * Las bajas no se borran: pasan a estado CANCELLED con fecha de baja, para
 * conservar el histórico (y porque la BD impide borrar un servicio contratado).
 */
const ClientServicesTab = ({ clientId, accountId, isAdmin }: Props) => {
  const qc = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ service_id: string; start_date: string; price: string; notes: string }>({
    service_id: "", start_date: new Date().toISOString().slice(0, 10), price: "", notes: "",
  });
  const [toCancel, setToCancel] = useState<Contract | null>(null);

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["client-services", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_services")
        .select("id, service_id, vertical_id, status, start_date, end_date, price, notes, services(name, price, billing_period), verticals(name)")
        .eq("client_id", clientId)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Contract[];
    },
    enabled: !!clientId,
  });

  /** Catálogo disponible: solo servicios y verticales activos. */
  const { data: catalog = [] } = useQuery({
    queryKey: ["services-catalog", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, price, billing_period, vertical_id, verticals(name, is_active)")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data || []).filter((s: any) => s.verticals?.is_active) as any[];
    },
    enabled: !!accountId && adding,
  });

  const visible = useMemo(
    () => contracts.filter((c) => (showHistory ? true : c.status !== "CANCELLED")),
    [contracts, showHistory],
  );

  /** Agrupa por vertical para que se lea como líneas de negocio. */
  const grouped = useMemo(() => {
    const map = new Map<string, Contract[]>();
    visible.forEach((c) => {
      const key = c.verticals?.name || "Sin vertical";
      const list = map.get(key) || [];
      list.push(c);
      map.set(key, list);
    });
    return Array.from(map.entries());
  }, [visible]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["client-services", clientId] });
  const fail = (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" });

  const add = useMutation({
    mutationFn: async () => {
      const svc = catalog.find((s) => s.id === form.service_id);
      if (!svc) throw new Error("Selecciona un servicio");
      const { error } = await supabase.from("client_services").insert({
        account_id: accountId,
        client_id: clientId,
        service_id: svc.id,
        // El trigger la recalcula igualmente; se envía para cumplir el NOT NULL.
        vertical_id: svc.vertical_id,
        start_date: form.start_date,
        price: form.price === "" ? null : Number(form.price),
        notes: form.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setAdding(false);
      setForm({ service_id: "", start_date: new Date().toISOString().slice(0, 10), price: "", notes: "" });
      refresh();
      toast({ title: "Servicio contratado" });
    },
    onError: fail,
  });

  const setStatus = useMutation({
    mutationFn: async ({ c, status }: { c: Contract; status: Contract["status"] }) => {
      const patch: Record<string, unknown> = { status };
      // Al dar de baja se fija la fecha si no la había; al reactivar se limpia.
      if (status === "CANCELLED" && !c.end_date) patch.end_date = new Date().toISOString().slice(0, 10);
      if (status === "ACTIVE") patch.end_date = null;
      const { error } = await supabase.from("client_services").update(patch).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => { setToCancel(null); refresh(); toast({ title: "Estado actualizado" }); },
    onError: (e: any) => { setToCancel(null); fail(e); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast({ title: "Contratación eliminada" }); },
    onError: fail,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-accent-foreground" />
                <CardTitle className="text-base">Servicios contratados</CardTitle>
              </div>
              <CardDescription className="mt-1">
                Líneas de negocio que este cliente tiene contratadas.
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch id="hist" checked={showHistory} onCheckedChange={setShowHistory} />
                <Label htmlFor="hist" className="text-xs text-muted-foreground">Ver bajas</Label>
              </div>
              {isAdmin && (
                <Button size="sm" className="gap-1.5" onClick={() => setAdding(true)}>
                  <Plus className="h-4 w-4" /> Añadir
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading && <p className="py-6 text-center text-xs text-muted-foreground">Cargando…</p>}

          {!isLoading && visible.length === 0 && (
            <EmptyState
              bare
              icon={Package}
              title={showHistory ? "Sin contrataciones" : "Sin servicios activos"}
              description={
                isAdmin
                  ? "Añade los servicios que tiene contratados. Antes debes crearlos en Configuración → Líneas de negocio."
                  : "Este cliente todavía no tiene servicios contratados."
              }
              actionLabel={isAdmin ? "Añadir servicio" : undefined}
              onAction={isAdmin ? () => setAdding(true) : undefined}
            />
          )}

          {grouped.map(([verticalName, list]) => (
            <div key={verticalName} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {verticalName}
              </p>
              <div className="space-y-1.5">
                {list.map((c) => {
                  const st = STATUS[c.status] ?? STATUS.ACTIVE;
                  const precio = c.price ?? c.services?.price ?? 0;
                  return (
                    <div
                      key={c.id}
                      className={`flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 ${
                        c.status === "CANCELLED" ? "opacity-60" : ""
                      }`}
                    >
                      <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{c.services?.name ?? "Servicio"}</p>
                        <p className="text-xs text-muted-foreground">
                          Alta {fmt(c.start_date)}
                          {c.end_date && ` · Baja ${fmt(c.end_date)}`}
                          {c.services?.billing_period && ` · ${BILLING_LABELS[c.services.billing_period] ?? ""}`}
                        </p>
                        {c.notes && <p className="mt-0.5 truncate text-xs italic text-muted-foreground">{c.notes}</p>}
                      </div>
                      <span className="shrink-0 text-xs tabular-nums">{EUR(precio)}</span>
                      <Badge variant={st.variant} className="shrink-0">{st.label}</Badge>

                      {isAdmin && (
                        <div className="flex shrink-0 items-center gap-1">
                          {c.status === "ACTIVE" && (
                            <Button
                              variant="ghost" size="icon" title="Pausar"
                              onClick={() => setStatus.mutate({ c, status: "PAUSED" })}
                            >
                              <PauseCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {c.status !== "ACTIVE" && (
                            <Button
                              variant="ghost" size="icon" title="Reactivar"
                              onClick={() => setStatus.mutate({ c, status: "ACTIVE" })}
                            >
                              <PlayCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {c.status !== "CANCELLED" && (
                            <Button
                              variant="ghost" size="icon" title="Dar de baja"
                              onClick={() => setToCancel(c)}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                          {c.status === "CANCELLED" && (
                            <Button
                              variant="ghost" size="icon" title="Eliminar del histórico"
                              onClick={() => remove.mutate(c.id)}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ---------------------------------------------------- añadir servicio */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contratar un servicio</DialogTitle>
            <DialogDescription>
              Solo se listan los servicios activos de verticales activas.
            </DialogDescription>
          </DialogHeader>

          {catalog.length === 0 ? (
            <p className="py-4 text-xs text-muted-foreground">
              No hay servicios disponibles. Créalos en <strong>Configuración → Líneas de negocio</strong>.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Servicio</Label>
                <Select
                  value={form.service_id}
                  onValueChange={(v) => {
                    const svc = catalog.find((s) => s.id === v);
                    setForm((f) => ({ ...f, service_id: v, price: svc ? String(svc.price) : f.price }));
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                  <SelectContent>
                    {catalog.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.verticals?.name} · {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Fecha de alta</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Precio pactado (€)</Label>
                  <Input
                    type="number" min={0} step="0.01"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder="Precio de catálogo"
                  />
                  <p className="text-xs text-muted-foreground">Déjalo vacío para usar el del catálogo.</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Observaciones</Label>
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button
              onClick={() => add.mutate()}
              disabled={!form.service_id || add.isPending || catalog.length === 0}
            >
              Contratar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------------- confirmar baja */}
      <AlertDialog open={!!toCancel} onOpenChange={(o) => !o && setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Dar de baja "{toCancel?.services?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Se marcará con fecha de baja de hoy. No se borra: seguirá en el histórico y
              podrás reactivarlo más adelante.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toCancel && setStatus.mutate({ c: toCancel, status: "CANCELLED" })}
            >
              Dar de baja
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientServicesTab;
