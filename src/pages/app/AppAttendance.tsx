import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Clock, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  startOfMonth, endOfMonth, format, eachDayOfInterval,
  differenceInMinutes, getISOWeek, startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import MyAttendanceView from "@/components/attendance/MyAttendanceView";
import TeamAttendanceView from "@/components/attendance/TeamAttendanceView";

const DAY_CODES: Record<number, string> = { 1: "MON", 2: "TUE", 3: "WED", 4: "THU", 5: "FRI", 6: "SAT", 0: "SUN" };

function formatMinutes(mins: number) {
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  const sign = mins < 0 ? "-" : "";
  return `${sign}${h}h ${m.toString().padStart(2, "0")}m`;
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Sum worked minutes from an array of records for a given day */
export function sumDayWorkedMins(records: any[], now?: Date) {
  return records.reduce((acc: number, r: any) => {
    if (!r.check_in) return acc;
    const ci = new Date(r.check_in);
    const co = r.check_out ? new Date(r.check_out) : (now || new Date());
    return acc + Math.max(0, differenceInMinutes(co, ci));
  }, 0);
}

const AppAttendance = () => {
  const { user, accountId, role } = useAuth();
  const queryClient = useQueryClient();
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";
  const isMasterAdmin = role === "MASTER_ADMIN";

  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedClientAccountId, setSelectedClientAccountId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"my" | "team">("my");

  const effectiveAccountId = isMasterAdmin ? (selectedClientAccountId || accountId) : accountId;

  const { data: settings } = useQuery({
    queryKey: ["account-settings", effectiveAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_settings")
        .select("*")
        .eq("account_id", effectiveAccountId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveAccountId,
  });

  const workDays = settings?.work_days || ["MON", "TUE", "WED", "THU", "FRI"];
  const workStart = settings?.work_start_time?.slice(0, 5) || "09:00";
  const workEnd = settings?.work_end_time?.slice(0, 5) || "18:00";
  const dailyExpectedMins = timeToMinutes(workEnd) - timeToMinutes(workStart);

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const { data: myMonthRecords = [], isLoading: myMonthLoading } = useQuery({
    queryKey: ["my-attendance-month", user?.id, format(monthStart, "yyyy-MM"), effectiveAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", user!.id)
        .eq("account_id", effectiveAccountId!)
        .gte("work_date", format(monthStart, "yyyy-MM-dd"))
        .lte("work_date", format(monthEnd, "yyyy-MM-dd"))
        .order("work_date")
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!effectiveAccountId,
  });

  const { data: teamRecords = [], isLoading: teamLoading } = useQuery({
    queryKey: ["team-attendance", effectiveAccountId, format(monthStart, "yyyy-MM")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("account_id", effectiveAccountId!)
        .gte("work_date", format(monthStart, "yyyy-MM-dd"))
        .lte("work_date", format(monthEnd, "yyyy-MM-dd"))
        .order("work_date")
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
    enabled: isManager && !!effectiveAccountId && activeTab === "team",
  });

  const teamUserIds = useMemo(() => [...new Set(teamRecords.map(r => r.user_id))], [teamRecords]);
  const { data: teamProfiles = [] } = useQuery({
    queryKey: ["team-profiles", teamUserIds, isManager],
    queryFn: async () => {
      if (!isManager || teamUserIds.length === 0) return [];
      try {
        const { data, error } = await supabase.functions.invoke("admin_reset_password", {
          body: { action: "list_users", account_id: effectiveAccountId },
        });
        if (error) return [];
        return data?.users || [];
      } catch { return []; }
    },
    enabled: isManager && teamUserIds.length > 0,
  });

  const teamEmailMap = useMemo(() => {
    const map: Record<string, string> = {};
    teamProfiles.forEach((p: any) => { map[p.user_id] = p.email; });
    return map;
  }, [teamProfiles]);

  const expectedWorkDaysInMonth = monthDays.filter(d => {
    const dayCode = DAY_CODES[d.getDay()];
    return workDays.includes(dayCode) && d <= new Date();
  }).length;
  const expectedMonthMins = expectedWorkDaysInMonth * dailyExpectedMins;

  // Sum all completed records
  const workedMonthMins = myMonthRecords.reduce((acc, r) => {
    if (r.check_in && r.check_out) {
      return acc + differenceInMinutes(new Date(r.check_out), new Date(r.check_in));
    }
    return acc;
  }, 0);

  const balanceMins = workedMonthMins - expectedMonthMins;

  const weeklyChartData = useMemo(() => {
    const weeksMap: Record<string, { worked: number; expected: number; label: string }> = {};
    monthDays.forEach(day => {
      const wk = getISOWeek(day);
      const ws = startOfWeek(day, { weekStartsOn: 1 });
      const key = `S${wk}`;
      if (!weeksMap[key]) {
        weeksMap[key] = { worked: 0, expected: 0, label: `${format(ws, "d MMM", { locale: es })}` };
      }
      const dayCode = DAY_CODES[day.getDay()];
      if (workDays.includes(dayCode)) weeksMap[key].expected += dailyExpectedMins / 60;
      // Sum ALL records for this day
      const dayStr = format(day, "yyyy-MM-dd");
      const dayRecords = myMonthRecords.filter(r => r.work_date === dayStr);
      dayRecords.forEach(rec => {
        if (rec.check_in && rec.check_out) {
          weeksMap[key].worked += differenceInMinutes(new Date(rec.check_out), new Date(rec.check_in)) / 60;
        }
      });
    });
    return Object.entries(weeksMap).map(([key, val]) => ({
      name: key, label: val.label,
      worked: Math.round(val.worked * 10) / 10,
      expected: Math.round(val.expected * 10) / 10,
    }));
  }, [monthDays, myMonthRecords, workDays, dailyExpectedMins]);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  // Multiple records for today
  const todayRecords = myMonthRecords.filter(r => r.work_date === todayStr);
  // Active record = one with check_in but no check_out
  const activeRecord = todayRecords.find(r => r.check_in && !r.check_out);
  const hasActiveSession = !!activeRecord;
  // Can check in if there's no active (open) session
  const canCheckIn = !hasActiveSession;

  const checkInMutation = useMutation({
    mutationFn: async () => {
      // Always create a new record for a new session
      const now = new Date().toISOString();
      const { error } = await supabase.from("attendance_records").insert({
        user_id: user!.id, account_id: accountId!, work_date: todayStr, check_in: now,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Entrada registrada" }); queryClient.invalidateQueries({ queryKey: ["my-attendance-month"] }); queryClient.invalidateQueries({ queryKey: ["dash-today-attendance"] }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      if (!activeRecord) throw new Error("No hay entrada activa");
      const { error } = await supabase.from("attendance_records").update({ check_out: new Date().toISOString() }).eq("id", activeRecord.id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Salida registrada" }); queryClient.invalidateQueries({ queryKey: ["my-attendance-month"] }); queryClient.invalidateQueries({ queryKey: ["dash-today-attendance"] }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const manualMutation = useMutation({
    mutationFn: async ({ date, checkIn, checkOut }: { date: string; checkIn: string; checkOut: string }) => {
      const ciISO = `${date}T${checkIn}:00`;
      const coISO = `${date}T${checkOut}:00`;
      // Always add a new record for manual entry
      const { error } = await supabase.from("attendance_records").insert({
        user_id: user!.id, account_id: accountId!, work_date: date, check_in: ciISO, check_out: coISO,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Fichaje guardado" }); queryClient.invalidateQueries({ queryKey: ["my-attendance-month"] }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const teamSummary = useMemo(() => {
    const map: Record<string, { worked: number; days: Set<string> }> = {};
    teamRecords.forEach(r => {
      if (!map[r.user_id]) map[r.user_id] = { worked: 0, days: new Set() };
      if (r.check_in && r.check_out) {
        map[r.user_id].worked += differenceInMinutes(new Date(r.check_out), new Date(r.check_in));
        map[r.user_id].days.add(r.work_date);
      }
    });
    return Object.entries(map).map(([userId, data]) => ({
      userId, email: teamEmailMap[userId] || userId.slice(0, 8), worked: data.worked, days: data.days.size,
    }));
  }, [teamRecords, teamEmailMap]);

  const handleExport = () => {
    const rows = [["Email", "Fecha", "Entrada", "Salida", "Horas"]];
    teamRecords.forEach(r => {
      const email = teamEmailMap[r.user_id] || r.user_id;
      const ci = r.check_in ? format(new Date(r.check_in), "HH:mm") : "";
      const co = r.check_out ? format(new Date(r.check_out), "HH:mm") : "";
      const mins = r.check_in && r.check_out ? differenceInMinutes(new Date(r.check_out), new Date(r.check_in)) : 0;
      rows.push([email, r.work_date, ci, co, formatMinutes(mins)]);
    });
    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asistencia_${format(monthStart, "yyyy-MM")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Control Horario</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestiona tus fichajes y consulta tu historial
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <div className="flex rounded-lg border border-border bg-muted/50 p-0.5">
              <button
                onClick={() => setActiveTab("my")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === "my"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                Mis Fichajes
              </button>
              <button
                onClick={() => setActiveTab("team")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === "team"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Equipo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Month navigator */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium capitalize min-w-[140px] text-center">
          {format(selectedMonth, "MMMM yyyy", { locale: es })}
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {activeTab === "my" && (
        <MyAttendanceView
          myMonthRecords={myMonthRecords}
          myMonthLoading={myMonthLoading}
          workedMonthMins={workedMonthMins}
          expectedMonthMins={expectedMonthMins}
          balanceMins={balanceMins}
          weeklyChartData={weeklyChartData}
          todayRecords={todayRecords}
          activeRecord={activeRecord}
          hasActiveSession={hasActiveSession}
          canCheckIn={canCheckIn}
          checkInMutation={checkInMutation}
          checkOutMutation={checkOutMutation}
          manualMutation={manualMutation}
          workDays={workDays}
          workStart={workStart}
          workEnd={workEnd}
          dailyExpectedMins={dailyExpectedMins}
          DAY_CODES={DAY_CODES}
          formatMinutes={formatMinutes}
        />
      )}

      {activeTab === "team" && isManager && (
        <TeamAttendanceView
          isMasterAdmin={isMasterAdmin}
          selectedClientAccountId={selectedClientAccountId}
          onSelectClient={(id) => setSelectedClientAccountId(id)}
          teamLoading={teamLoading}
          teamSummary={teamSummary}
          teamRecordsCount={teamRecords.length}
          selectedMonth={selectedMonth}
          onExport={handleExport}
          formatMinutes={formatMinutes}
        />
      )}
    </div>
  );
};

export default AppAttendance;
