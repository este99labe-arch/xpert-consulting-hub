import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CalendarClock, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { WEEKDAYS_ISO, summarizeSlots, type TemplateSlot } from "@/lib/schedule";

const KIND_OPTIONS = [
  { value: "PARTIDA", label: "Jornada partida" },
  { value: "INTENSIVA", label: "Jornada intensiva" },
  { value: "MANANA", label: "Turno mañana" },
  { value: "TARDE", label: "Turno tarde" },
  { value: "NOCHE", label: "Turno noche" },
  { value: "ROTATIVO", label: "Rotativo" },
  { value: "PERSONALIZADO", label: "Personalizado" },
];

interface Props {
  accountId: string;
  isManager: boolean;
}

const ScheduleTemplatesCard = ({ accountId, isManager }: Props) => {
  const qc = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [kind, setKind] = useState("PERSONALIZADO");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [t1s, setT1s] = useState("09:00");
  const [t1e, setT1e] = useState("14:00");
  const [hasT2, setHasT2] = useState(false);
  const [t2s, setT2s] = useState("15:00");
  const [t2e, setT2e] = useState("18:00");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["schedule-templates", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_templates")
        .select("*, schedule_template_slots(*)")
        .eq("account_id", accountId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const openNew = () => {
    setEditingId(null);
    setName(""); setKind("PERSONALIZADO"); setDays([1, 2, 3, 4, 5]);
    setT1s("09:00"); setT1e("14:00"); setHasT2(false); setT2s("15:00"); setT2e("18:00");
    setEditorOpen(true);
  };

  const openEdit = (tpl: any) => {
    setEditingId(tpl.id);
    setName(tpl.name);
    setKind(tpl.kind);
    const slots: TemplateSlot[] = tpl.schedule_template_slots || [];
    const uniqueDays = [...new Set(slots.map((s) => s.weekday))].sort();
    setDays(uniqueDays.length ? uniqueDays : [1, 2, 3, 4, 5]);
    const firstDay = uniqueDays[0];
    const daySlots = slots
      .filter((s) => s.weekday === firstDay)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    setT1s(daySlots[0]?.start_time?.slice(0, 5) || "09:00");
    setT1e(daySlots[0]?.end_time?.slice(0, 5) || "14:00");
    setHasT2(daySlots.length > 1);
    setT2s(daySlots[1]?.start_time?.slice(0, 5) || "15:00");
    setT2e(daySlots[1]?.end_time?.slice(0, 5) || "18:00");
    setEditorOpen(true);
  };

  const toggleDay = (wd: number) =>
    setDays((prev) => (prev.includes(wd) ? prev.filter((d) => d !== wd) : [...prev, wd].sort()));

  const handleSave = async () => {
    if (!name.trim() || days.length === 0) {
      toast({ title: "Completa el nombre y al menos un día", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let templateId = editingId;
      if (templateId) {
        const { error } = await supabase.from("schedule_templates")
          .update({ name: name.trim(), kind }).eq("id", templateId);
        if (error) throw error;
        const { error: delErr } = await supabase.from("schedule_template_slots")
          .delete().eq("template_id", templateId);
        if (delErr) throw delErr;
      } else {
        const { data, error } = await supabase.from("schedule_templates")
          .insert({ account_id: accountId, name: name.trim(), kind })
          .select("id").single();
        if (error) throw error;
        templateId = data.id;
      }
      const slots = days.flatMap((wd) => {
        const rows = [{ template_id: templateId!, weekday: wd, start_time: t1s, end_time: t1e }];
        if (hasT2) rows.push({ template_id: templateId!, weekday: wd, start_time: t2s, end_time: t2e });
        return rows;
      });
      const { error: insErr } = await supabase.from("schedule_template_slots").insert(slots);
      if (insErr) throw insErr;
      toast({ title: editingId ? "Plantilla actualizada" : "Plantilla creada" });
      qc.invalidateQueries({ queryKey: ["schedule-templates", accountId] });
      setEditorOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Plantilla eliminada" });
      qc.invalidateQueries({ queryKey: ["schedule-templates", accountId] });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" /> Plantillas de horario</CardTitle>
          <CardDescription>Turnos y jornadas reutilizables. Asigna una plantilla a cada empleado desde Recursos Humanos.</CardDescription>
        </div>
        {isManager && (
          <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Nueva plantilla</Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : templates.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No hay plantillas. Crea la primera.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {templates.map((tpl: any) => (
              <div key={tpl.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{tpl.name}</p>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {KIND_OPTIONS.find((k) => k.value === tpl.kind)?.label || tpl.kind}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {summarizeSlots(tpl.schedule_template_slots || [])}
                  </p>
                </div>
                {isManager && (
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tpl)} aria-label="Editar plantilla">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget(tpl)} aria-label="Eliminar plantilla">
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar plantilla" : "Nueva plantilla de horario"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Turno mañana" />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KIND_OPTIONS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Días</Label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS_ISO.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    className={`h-9 w-11 rounded-md border text-xs font-medium transition-colors ${
                      days.includes(d.value)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {d.label.slice(0, 2)}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tramo 1 · inicio</Label>
                <Input type="time" value={t1s} onChange={(e) => setT1s(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Tramo 1 · fin</Label>
                <Input type="time" value={t1e} onChange={(e) => setT1e(e.target.value)} />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={hasT2} onCheckedChange={(v) => setHasT2(!!v)} />
              Segundo tramo (jornada partida)
            </label>
            {hasT2 && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Tramo 2 · inicio</Label>
                  <Input type="time" value={t2s} onChange={(e) => setT2s(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tramo 2 · fin</Label>
                  <Input type="time" value={t2e} onChange={(e) => setT2e(e.target.value)} />
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Si el fin es anterior al inicio (ej. 22:00–06:00), se interpreta como turno nocturno que cruza la medianoche.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditorOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación de borrado */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la plantilla "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Los empleados que la tengan asignada pasarán a usar el horario general de la empresa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMut.mutate(deleteTarget.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default ScheduleTemplatesCard;
