import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { WEEKDAYS_ISO } from "@/lib/schedule";

type DayMode = "TEMPLATE" | "CUSTOM" | "OFF";

interface DayState {
  mode: DayMode;
  t1s: string; t1e: string;
  hasT2: boolean; t2s: string; t2e: string;
}

const defaultDay = (): DayState => ({
  mode: "TEMPLATE", t1s: "09:00", t1e: "14:00", hasT2: false, t2s: "15:00", t2e: "18:00",
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accountId: string;
  userId: string;
  label: string;
}

const EmployeeScheduleDialog = ({ open, onOpenChange, accountId, userId, label }: Props) => {
  const qc = useQueryClient();
  const [templateId, setTemplateId] = useState<string>("DEFAULT");
  const [days, setDays] = useState<Record<number, DayState>>({});
  const [saving, setSaving] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ["schedule-templates", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_templates").select("id, name, kind")
        .eq("account_id", accountId).eq("is_active", true).order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId && open,
  });

  const { data: profile } = useQuery({
    queryKey: ["employee-schedule-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_profiles").select("id, schedule_template_id")
        .eq("user_id", userId).eq("account_id", accountId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId && open,
  });

  const { data: overrides = [], isLoading: loadingOverrides } = useQuery({
    queryKey: ["employee-schedule-overrides", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_schedule_overrides").select("*")
        .eq("account_id", accountId).eq("user_id", userId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && open,
  });

  useEffect(() => {
    if (!open) return;
    setTemplateId(profile?.schedule_template_id || "DEFAULT");
    const next: Record<number, DayState> = {};
    for (const d of WEEKDAYS_ISO) next[d.value] = defaultDay();
    const byDay = new Map<number, any[]>();
    overrides.forEach((o: any) => byDay.set(o.weekday, [...(byDay.get(o.weekday) || []), o]));
    for (const [wd, rows] of byDay) {
      if (rows.some((r) => r.day_off)) {
        next[wd] = { ...defaultDay(), mode: "OFF" };
      } else {
        const sorted = rows
          .filter((r) => r.start_time && r.end_time)
          .sort((a, b) => a.start_time.localeCompare(b.start_time));
        next[wd] = {
          mode: "CUSTOM",
          t1s: sorted[0]?.start_time?.slice(0, 5) || "09:00",
          t1e: sorted[0]?.end_time?.slice(0, 5) || "14:00",
          hasT2: sorted.length > 1,
          t2s: sorted[1]?.start_time?.slice(0, 5) || "15:00",
          t2e: sorted[1]?.end_time?.slice(0, 5) || "18:00",
        };
      }
    }
    setDays(next);
  }, [open, profile, overrides]);

  const setDay = (wd: number, patch: Partial<DayState>) =>
    setDays((prev) => ({ ...prev, [wd]: { ...(prev[wd] || defaultDay()), ...patch } }));

  const handleSave = async () => {
    if (!profile?.id) {
      toast({ title: "Este usuario no tiene ficha de empleado", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error: updErr } = await supabase.from("employee_profiles")
        .update({ schedule_template_id: templateId === "DEFAULT" ? null : templateId })
        .eq("id", profile.id);
      if (updErr) throw updErr;

      const { error: delErr } = await supabase.from("employee_schedule_overrides")
        .delete().eq("account_id", accountId).eq("user_id", userId);
      if (delErr) throw delErr;

      const rows: any[] = [];
      for (const d of WEEKDAYS_ISO) {
        const st = days[d.value];
        if (!st || st.mode === "TEMPLATE") continue;
        if (st.mode === "OFF") {
          rows.push({ account_id: accountId, user_id: userId, weekday: d.value, day_off: true });
        } else {
          rows.push({ account_id: accountId, user_id: userId, weekday: d.value, day_off: false, start_time: st.t1s, end_time: st.t1e });
          if (st.hasT2) rows.push({ account_id: accountId, user_id: userId, weekday: d.value, day_off: false, start_time: st.t2s, end_time: st.t2e });
        }
      }
      if (rows.length > 0) {
        const { error: insErr } = await supabase.from("employee_schedule_overrides").insert(rows);
        if (insErr) throw insErr;
      }
      toast({ title: "Horario del empleado guardado" });
      qc.invalidateQueries({ queryKey: ["employee-schedule-overrides", userId] });
      qc.invalidateQueries({ queryKey: ["hr-employees"] });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="flex-shrink-0 space-y-0 border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg">Horario del empleado</DialogTitle>
              <p className="truncate text-sm text-muted-foreground">{label}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto bg-muted/30 px-6 py-5">
          <div className="space-y-1.5">
            <Label>Plantilla de horario</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DEFAULT">Horario general de la empresa</SelectItem>
                {templates.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              El empleado hereda la plantilla; abajo puedes personalizar días concretos.
            </p>
          </div>

          {loadingOverrides ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-2">
              <Label>Personalización por día</Label>
              {WEEKDAYS_ISO.map((d) => {
                const st = days[d.value] || defaultDay();
                return (
                  <div key={d.value} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-center gap-3">
                      <span className="w-20 shrink-0 text-sm font-medium">{d.label}</span>
                      <Select value={st.mode} onValueChange={(v) => setDay(d.value, { mode: v as DayMode })}>
                        <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TEMPLATE">Según plantilla</SelectItem>
                          <SelectItem value="CUSTOM">Personalizado</SelectItem>
                          <SelectItem value="OFF">Libre</SelectItem>
                        </SelectContent>
                      </Select>
                      {st.mode === "CUSTOM" && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Input type="time" value={st.t1s} onChange={(e) => setDay(d.value, { t1s: e.target.value })} className="h-8 w-[104px] text-xs" />
                          <span className="text-xs text-muted-foreground">–</span>
                          <Input type="time" value={st.t1e} onChange={(e) => setDay(d.value, { t1e: e.target.value })} className="h-8 w-[104px] text-xs" />
                          {st.hasT2 ? (
                            <>
                              <span className="text-xs text-muted-foreground">y</span>
                              <Input type="time" value={st.t2s} onChange={(e) => setDay(d.value, { t2s: e.target.value })} className="h-8 w-[104px] text-xs" />
                              <span className="text-xs text-muted-foreground">–</span>
                              <Input type="time" value={st.t2e} onChange={(e) => setDay(d.value, { t2e: e.target.value })} className="h-8 w-[104px] text-xs" />
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setDay(d.value, { hasT2: false })}>Quitar tramo</Button>
                            </>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setDay(d.value, { hasT2: true })}>+ Tramo</Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 flex-row items-center justify-end gap-2 border-t border-border bg-background px-6 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar horario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeScheduleDialog;
