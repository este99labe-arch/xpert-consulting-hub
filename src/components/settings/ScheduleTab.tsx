import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Loader2, KeyRound, UserPlus, AlertCircle, Users, CalendarDays,
  Clock, ShieldCheck, Save, User, Lock, Unlock, Check, X, Mail, ShieldAlert,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { roleLabel } from "@/lib/roles";
import ScheduleTemplatesCard from "@/components/settings/ScheduleTemplatesCard";
import HolidaysCard from "@/components/settings/HolidaysCard";

const WEEKDAYS = [
  { code: "MON", label: "Lunes" },
  { code: "TUE", label: "Martes" },
  { code: "WED", label: "Miércoles" },
  { code: "THU", label: "Jueves" },
  { code: "FRI", label: "Viernes" },
  { code: "SAT", label: "Sábado" },
  { code: "SUN", label: "Domingo" },
];

// ─── HORARIO TAB ─────────────────────────────────────────
const ScheduleTab = ({ accountId, isManager }: { accountId: string; isManager: boolean }) => {
  const queryClient = useQueryClient();
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("18:00");
  const [workDays, setWorkDays] = useState<string[]>(["MON", "TUE", "WED", "THU", "FRI"]);
  const [vacationDays, setVacationDays] = useState(22);
  const [saving, setSaving] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["account-settings", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_settings").select("*").eq("account_id", accountId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  useEffect(() => {
    if (settings) {
      setWorkStart(settings.work_start_time?.slice(0, 5) || "09:00");
      setWorkEnd(settings.work_end_time?.slice(0, 5) || "18:00");
      setWorkDays(settings.work_days || ["MON", "TUE", "WED", "THU", "FRI"]);
      setVacationDays(settings.vacation_days_per_year ?? 22);
    }
  }, [settings]);

  const toggleDay = (code: string) => {
    setWorkDays((prev) => prev.includes(code) ? prev.filter((d) => d !== code) : [...prev, code]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        work_start_time: workStart,
        work_end_time: workEnd,
        work_days: workDays,
        vacation_days_per_year: vacationDays,
        updated_at: new Date().toISOString(),
      };
      if (settings) {
        const { error } = await supabase.from("account_settings").update(payload).eq("account_id", accountId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("account_settings").insert({ account_id: accountId, ...payload });
        if (error) throw error;
      }
      toast({ title: "Configuración guardada" });
      queryClient.invalidateQueries({ queryKey: ["account-settings"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Horario Laboral</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hora inicio</Label>
              <Input type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} disabled={!isManager} />
            </div>
            <div className="space-y-2">
              <Label>Hora fin</Label>
              <Input type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} disabled={!isManager} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Días laborales</Label>
            <div className="grid grid-cols-2 gap-2">
              {WEEKDAYS.map((day) => (
                <label key={day.code} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent/50 transition-colors">
                  <Checkbox
                    checked={workDays.includes(day.code)}
                    onCheckedChange={() => isManager && toggleDay(day.code)}
                    disabled={!isManager}
                  />
                  <span className="text-sm">{day.label}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Vacaciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Días de vacaciones al año</Label>
            <Input type="number" min={0} max={365} value={vacationDays}
              onChange={(e) => setVacationDays(parseInt(e.target.value) || 0)} disabled={!isManager} />
          </div>
          {isManager && (
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar Configuración
            </Button>
          )}
        </CardContent>
      </Card>
      <ScheduleTemplatesCard accountId={accountId} isManager={isManager} />
      <HolidaysCard accountId={accountId} isManager={isManager} />
    </div>
  );
};


export default ScheduleTab;
