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

const AppAttendance = () => {
  const { user, accountId, role } = useAuth();
  const queryClient = useQueryClient();
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";
  const isMasterAdmin = role === "MASTER_ADMIN";

  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedClientAccountId, setSelectedClientAccountId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"my" | "team">("my");

  const effectiveAccountId = isMasterAdmin ? (selectedClientAccountId || accountId) : accountId;

  // Fetch account settings
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

  // My attendance (month)
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
        .order("work_date");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!effectiveAccountId,
  });

  // Team attendance
  const { data: teamRecords = [], isLoading: teamLoading } = useQuery({
    queryKey: ["team-attendance", effectiveAccountId, format(monthStart, "yyyy-MM")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("account_id", effectiveAccountId!)
        .gte("work_date", format(monthStart, "yyyy-MM-dd"))
        .lte("work_date", format(monthEnd, "yyyy-MM-dd"))
        .order("work_date");
      if (error) throw error;
      return data || [];
    },
    enabled: isManager && !!effectiveAccountId && activeTab === "team",
  });

  // Team profiles
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

  // Monthly calculations
  const expectedWorkDaysInMonth = monthDays.filter(d => {
    const dayCode = DAY_CODES[d.getDay()];
    return workDays.includes(dayCode) && d <= new Date();
  }).length;
  const expectedMonthMins = expectedWorkDaysInMonth * dailyExpectedMins;

  const workedMonthMins = myMonthRecords.reduce((acc, r) => {
    if (r.check_in && r.check_out) {
      return acc + differenceInMinutes(new Date(r.check_out), new Date(r.check_in));
    }
    return acc;
  }, 0);

  const balanceMins = workedMonthMins - expectedMonthMins;

  // Weekly chart data
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
      const rec = myMonthRecords.find(r => r.work_date === format(day, "yyyy-MM-dd"));
      if (rec?.check_in && rec?.check_out) {
        weeksMap[key].worked += differenceInMinutes(new Date(rec.check_out), new Date(rec.check_in)) / 60;
      }
    });
    return Object.entries(weeksMap).map(([key, val]) => ({
      name: key, label: val.label,
      worked: Math.round(val.worked * 10) / 10,
      expected: Math.round(val.expected * 10) / 10,
    }));
  }, [monthDays, myMonthRecords, workDays, dailyExpectedMins]);

  // Today
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayRecord = myMonthRecords.find(r => r.work_date === todayStr);
  const hasCheckedIn = !!todayRecord?.check_in;
  const hasCheckedOut = !!todayRecord?.check_out;

  // Mutations
  const checkInMutation = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      if (todayRecord) {
        const { error } = await supabase.from("attendance_records").update({ check_in: now }).eq("id", todayRecord.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendance_records").insert({ user_id: user!.id, account_id: accountId!, work_date: todayStr, check_in: now });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast({ title: "Entrada registrada" }); queryClient.invalidateQueries({ queryKey: ["my-attendance-month"] }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      if (!todayRecord) throw new Error("No hay entrada registrada");
      const { error } = await supabase.from("attendance_records").update({ check_out: new Date().toISOString() }).eq("id", todayRecord.id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Salida registrada" }); queryClient.invalidateQueries({ queryKey: ["my-attendance-month"] }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const manualMutation = useMutation({
    mutationFn: async ({ date, checkIn, checkOut }: { date: string; checkIn: string; checkOut: string }) => {
      const ciISO = `${date}T${checkIn}:00`;
      const coISO = `${date}T${checkOut}:00`;
      const existing = myMonthRecords.find(r => r.work_date === date);
      if (existing) {
        const { error } = await supabase.from("attendance_records").update({ check_in: ciISO, check_out: coISO }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendance_records").insert({ user_id: user!.id, account_id: accountId!, work_date: date, check_in: ciISO, check_out: coISO });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast({ title: "Fichaje guardado" }); queryClient.invalidateQueries({ queryKey: ["my-attendance-month"] }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Team summary
  const teamSummary = useMemo(() => {
    const map: Record<string, { worked: number; days: number }> = {};
    teamRecords.forEach(r => {
      if (!map[r.user_id]) map[r.user_id] = { worked: 0, days: 0 };
      if (r.check_in && r.check_out) {
        map[r.user_id].worked += differenceInMinutes(new Date(r.check_out), new Date(r.check_in));
        map[r.user_id].days += 1;
      }
    });
    return Object.entries(map).map(([userId, data]) => ({
      userId, email: teamEmailMap[userId] || userId.slice(0, 8), ...data,
    }));
  }, [teamRecords, teamEmailMap]);

  // Export CSV
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Asistencia</h1>
        {isManager && (
          <div className="flex gap-2">
            <Button variant={activeTab === "my" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("my")}>
              <Clock className="h-4 w-4 mr-1" /> Mis Fichajes
            </Button>
            <Button variant={activeTab === "team" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("team")}>
              <Users className="h-4 w-4 mr-1" /> Equipo
            </Button>
          </div>
        )}
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium capitalize min-w-[140px] text-center">
          {format(selectedMonth, "MMMM yyyy", { locale: es })}
        </span>
        <Button variant="outline" size="icon" onClick={() => setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}>
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
          todayRecord={todayRecord}
          hasCheckedIn={hasCheckedIn}
          hasCheckedOut={hasCheckedOut}
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
