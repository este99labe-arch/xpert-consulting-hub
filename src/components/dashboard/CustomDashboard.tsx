import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  Pencil, Check, Plus, Trash2, Settings2, ArrowLeft, ArrowRight,
  TrendingUp, TrendingDown, LayoutDashboard, Divide,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  METRICS, METRIC_CATEGORIES, metricDef, metricSeries, metricTotal, formatMetric,
  monthKeys, DEFAULT_WIDGETS, widgetTitle,
  type DashboardWidget, type MetricDatasets, type WidgetType,
} from "@/lib/dashboardMetrics";

// Las tablas nuevas aún no están en los tipos generados
const db = supabase as any;

// ─── Datos base para las métricas (una sola carga) ───────────
const useMetricDatasets = (accountId?: string) =>
  useQuery({
    queryKey: ["custom-dash-datasets", accountId],
    queryFn: async (): Promise<MetricDatasets> => {
      const since = `${monthKeys(12)[0]}-01`;
      const [inv, cli, tsk, att, conv] = await Promise.all([
        supabase.from("invoices")
          .select("type, status, issue_date, due_date, amount_total, amount_net, amount_vat, client_id")
          .eq("account_id", accountId!).gte("issue_date", since),
        supabase.from("business_clients").select("created_at, status").eq("account_id", accountId!),
        supabase.from("reminders").select("created_at, completed_at, is_completed, origin").eq("account_id", accountId!).gte("created_at", since),
        supabase.from("attendance_records").select("work_date, check_in, check_out").eq("account_id", accountId!).gte("work_date", since),
        supabase.from("chat_conversations").select("created_at").eq("account_id", accountId!),
      ]);
      return {
        invoices: (inv.data || []) as any,
        clients: (cli.data || []) as any,
        tasks: (tsk.data || []) as any,
        attendance: (att.data || []) as any,
        conversations: (conv.data || []) as any,
      };
    },
    enabled: !!accountId,
    staleTime: 60_000,
  });

// ─── Widget individual ────────────────────────────────────────
const WidgetCard = ({
  widget, ds, editing, onEdit, onRemove, onMove, isFirst, isLast,
}: {
  widget: DashboardWidget;
  ds: MetricDatasets;
  editing: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}) => {
  const def = metricDef(widget.metric);
  const title = widgetTitle(widget);

  const series = useMemo(
    () => (widget.type === "kpi" || widget.type === "ratio" ? [] : metricSeries(widget.metric, ds, widget.months)),
    [widget, ds],
  );

  const chartConfig = { value: { label: def?.label || "Valor", color: "hsl(var(--primary))" } };

  const body = () => {
    if (widget.type === "kpi") {
      // Valor del mes actual vs mes anterior
      const currSeries = metricSeries(widget.metric, ds, 2);
      const curr = currSeries[1]?.value ?? 0;
      const prev = currSeries[0]?.value ?? 0;
      const pct = prev !== 0 ? Math.round(((curr - prev) / Math.abs(prev)) * 100) : curr > 0 ? 100 : 0;
      const up = pct >= 0;
      return (
        <div className="flex h-[160px] flex-col justify-center">
          <p className="text-3xl font-bold tabular-nums tracking-tight">{formatMetric(curr, def?.unit || "COUNT")}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            {up ? <TrendingUp className="h-3.5 w-3.5 text-[hsl(var(--success))]" /> : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
            <span className={up ? "text-[hsl(var(--success))]" : "text-destructive"}>{Math.abs(pct)}%</span>
            vs. mes anterior
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Mes en curso</p>
        </div>
      );
    }

    if (widget.type === "ratio") {
      const a = metricTotal(widget.metric, ds, widget.months);
      const b = metricTotal(widget.metricB || "", ds, widget.months);
      const value = b !== 0 ? a / b : 0;
      const shown = widget.percent
        ? formatMetric(value * 100, "PCT")
        : new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(value);
      const defB = metricDef(widget.metricB || "");
      return (
        <div className="flex h-[160px] flex-col justify-center">
          <p className="text-3xl font-bold tabular-nums tracking-tight">{shown}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatMetric(a, def?.unit || "COUNT")} / {formatMetric(b, defB?.unit || "COUNT")}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Últimos {widget.months} meses</p>
        </div>
      );
    }

    // Series temporales
    const common = {
      data: series,
      margin: { top: 5, right: 10, left: -10, bottom: 0 },
    };
    return (
      <div className="h-[160px] w-full">
        <ChartContainer config={chartConfig} className="!aspect-auto h-full w-full">
          {widget.type === "bar" ? (
            <BarChart {...common}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} className="text-muted-foreground" interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" width={46} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={widget.months > 6 ? 12 : 22} />
            </BarChart>
          ) : widget.type === "area" ? (
            <AreaChart {...common}>
              <defs>
                <linearGradient id={`grad-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} className="text-muted-foreground" interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" width={46} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill={`url(#grad-${widget.id})`} strokeWidth={2} />
            </AreaChart>
          ) : (
            <LineChart {...common}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} className="text-muted-foreground" interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" width={46} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          )}
        </ChartContainer>
      </div>
    );
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="truncate text-sm font-semibold">{title}</CardTitle>
        {editing && (
          <div className="flex shrink-0 items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMove(-1)} disabled={isFirst} aria-label="Mover a la izquierda">
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMove(1)} disabled={isLast} aria-label="Mover a la derecha">
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} aria-label="Editar widget">
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove} aria-label="Eliminar widget">
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="pb-4 pt-0">{body()}</CardContent>
    </Card>
  );
};

// ─── Editor de widget ─────────────────────────────────────────
const MetricSelect = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger><SelectValue placeholder={placeholder || "Métrica"} /></SelectTrigger>
    <SelectContent className="max-h-72">
      {METRIC_CATEGORIES.map((cat) => (
        <SelectGroup key={cat}>
          <SelectLabel>{cat}</SelectLabel>
          {METRICS.filter((m) => m.category === cat).map((m) => (
            <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
          ))}
        </SelectGroup>
      ))}
    </SelectContent>
  </Select>
);

const TYPE_LABELS: { value: WidgetType; label: string }[] = [
  { value: "line", label: "Línea (por mes)" },
  { value: "bar", label: "Barras (por mes)" },
  { value: "area", label: "Área (por mes)" },
  { value: "kpi", label: "KPI (mes actual)" },
  { value: "ratio", label: "Ratio (A / B)" },
];

const WidgetEditorDialog = ({
  open, onOpenChange, widget, onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  widget: DashboardWidget | null;
  onSave: (w: DashboardWidget) => void;
}) => {
  const [draft, setDraft] = useState<DashboardWidget | null>(null);

  // Sincronizar al abrir
  useEffect(() => { if (open && widget) setDraft({ ...widget }); }, [open, widget]);

  if (!draft) return null;
  const set = (patch: Partial<DashboardWidget>) => setDraft((d) => ({ ...d!, ...patch }));
  const isRatio = draft.type === "ratio";
  const isSeries = draft.type === "line" || draft.type === "bar" || draft.type === "area";
  const valid = !!draft.metric && (!isRatio || !!draft.metricB);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" /> Configurar widget
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo de visualización</Label>
            <Select value={draft.type} onValueChange={(v) => set({ type: v as WidgetType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPE_LABELS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{isRatio ? "Numerador (A)" : "Métrica"}</Label>
            <MetricSelect value={draft.metric} onChange={(v) => set({ metric: v })} />
          </div>

          {isRatio && (
            <>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Divide className="h-3.5 w-3.5" /> Denominador (B)</Label>
                <MetricSelect value={draft.metricB || ""} onChange={(v) => set({ metricB: v })} placeholder="Elige el denominador" />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={draft.percent !== false} onCheckedChange={(v) => set({ percent: v })} />
                <Label className="cursor-pointer">Mostrar como porcentaje</Label>
              </div>
            </>
          )}

          {(isSeries || isRatio) && (
            <div className="space-y-1.5">
              <Label>Periodo</Label>
              <Select value={String(draft.months)} onValueChange={(v) => set({ months: Number(v) })}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Título (opcional)</Label>
            <Input value={draft.title || ""} onChange={(e) => set({ title: e.target.value })} placeholder={widgetTitle({ ...draft, title: "" })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => { onSave(draft); onOpenChange(false); }} disabled={!valid}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Sección principal ────────────────────────────────────────
const CustomDashboard = () => {
  const { accountId, user } = useAuth();
  const qc = useQueryClient();
  const { data: ds } = useMetricDatasets(accountId || undefined);
  const [editing, setEditing] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null);

  const { data: config } = useQuery({
    queryKey: ["dashboard-config", accountId, user?.id],
    queryFn: async () => {
      const { data } = await db
        .from("dashboard_configs")
        .select("widgets")
        .eq("account_id", accountId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!accountId && !!user,
  });

  const widgets: DashboardWidget[] = useMemo(() => {
    const saved = (config?.widgets as DashboardWidget[] | undefined) || null;
    return saved && saved.length > 0 ? saved : DEFAULT_WIDGETS;
  }, [config]);

  const save = useMutation({
    mutationFn: async (next: DashboardWidget[]) => {
      const { error } = await db.from("dashboard_configs").upsert(
        { account_id: accountId, user_id: user!.id, widgets: next, updated_at: new Date().toISOString() },
        { onConflict: "account_id,user_id" },
      );
      if (error) throw error;
    },
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ["dashboard-config", accountId, user?.id] });
      const prev = qc.getQueryData(["dashboard-config", accountId, user?.id]);
      qc.setQueryData(["dashboard-config", accountId, user?.id], { widgets: next });
      return { prev };
    },
    onError: (e: any, _next, ctx) => {
      if (ctx?.prev) qc.setQueryData(["dashboard-config", accountId, user?.id], ctx.prev);
      toast({ title: "No se pudo guardar el panel", description: e.message, variant: "destructive" });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["dashboard-config", accountId, user?.id] }),
  });

  const update = (fn: (list: DashboardWidget[]) => DashboardWidget[]) => save.mutate(fn([...widgets]));

  const addWidget = () => {
    const w: DashboardWidget = { id: crypto.randomUUID(), type: "line", metric: "ingresos", months: 12 };
    setEditingWidget(w);
    setEditorOpen(true);
  };

  const onSaveWidget = (w: DashboardWidget) => {
    update((list) => {
      const idx = list.findIndex((x) => x.id === w.id);
      if (idx >= 0) { list[idx] = w; return list; }
      return [...list, w];
    });
  };

  const move = (id: string, dir: -1 | 1) =>
    update((list) => {
      const idx = list.findIndex((x) => x.id === id);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= list.length) return list;
      [list[idx], list[j]] = [list[j], list[idx]];
      return list;
    });

  if (!ds) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Mi panel</p>
        <div className="flex items-center gap-2">
          {editing && (
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={addWidget}>
              <Plus className="h-3.5 w-3.5" /> Añadir widget
            </Button>
          )}
          <Button
            size="sm"
            variant={editing ? "default" : "ghost"}
            className="h-7 gap-1.5 text-xs"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            {editing ? "Hecho" : "Editar"}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {widgets.map((w, i) => (
          <WidgetCard
            key={w.id}
            widget={w}
            ds={ds}
            editing={editing}
            isFirst={i === 0}
            isLast={i === widgets.length - 1}
            onEdit={() => { setEditingWidget(w); setEditorOpen(true); }}
            onRemove={() => update((list) => list.filter((x) => x.id !== w.id))}
            onMove={(dir) => move(w.id, dir)}
          />
        ))}
        {editing && (
          <button
            type="button"
            onClick={addWidget}
            className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Plus className="h-6 w-6" />
            <span className="text-sm font-medium">Añadir widget</span>
          </button>
        )}
      </div>

      <WidgetEditorDialog open={editorOpen} onOpenChange={setEditorOpen} widget={editingWidget} onSave={onSaveWidget} />
    </div>
  );
};

export default CustomDashboard;
