import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, CalendarCheck, Palmtree, Bell } from "lucide-react";
import { startOfWeek, startOfMonth, endOfMonth, format, differenceInMinutes, parseISO, differenceInDays } from "date-fns";
import TodayAttendanceWidget from "@/components/dashboard/TodayAttendanceWidget";
import RemindersWidget from "@/components/dashboard/RemindersWidget";
import MyVacationsWidget from "@/components/dashboard/MyVacationsWidget";
import MyWeekAttendanceWidget from "@/components/dashboard/MyWeekAttendanceWidget";
import MyDocumentsWidget from "@/components/dashboard/MyDocumentsWidget";

interface MiniKpi {
  label: string;
  value: string;
  icon: any;
  color: string;
  bg: string;
  hint?: string;
}

const EmployeeDashboard = () => {
  const { user, accountId } = useAuth();
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const { data: weekRecords = [] } = useQuery({
    queryKey: ["emp-week-records", user?.id, format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("check_in, check_out, work_date")
        .eq("user_id", user!.id)
        .eq("account_id", accountId!)
        .gte("work_date", format(weekStart, "yyyy-MM-dd"));
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!accountId,
  });

  const { data: monthRecords = [] } = useQuery({
    queryKey: ["emp-month-records", user?.id, format(monthStart, "yyyy-MM")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("check_in, check_out, work_date")
        .eq("user_id", user!.id)
        .eq("account_id", accountId!)
        .gte("work_date", format(monthStart, "yyyy-MM-dd"))
        .lte("work_date", format(monthEnd, "yyyy-MM-dd"));
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!accountId,
  });

  const { data: settings } = useQuery({
    queryKey: ["emp-settings", accountId],
    queryFn: async () => {
      const { data } = await supabase.from("account_settings").select("*").eq("account_id", accountId!).maybeSingle();
      return data;
    },
    enabled: !!accountId,
  });

  const { data: leave = [] } = useQuery({
    queryKey: ["emp-leave-summary", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("type, status, start_date, end_date")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const sumMins = (recs: any[]) =>
    recs.reduce((acc, r) => {
      if (!r.check_in) return acc;
      const ci = parseISO(r.check_in);
      const co = r.check_out ? parseISO(r.check_out) : new Date();
      return acc + Math.max(0, differenceInMinutes(co, ci));
    }, 0);

  const weekMins = sumMins(weekRecords as any[]);
  const monthMins = sumMins(monthRecords as any[]);

  // Expected: count work days in month vs settings
  const workDays: string[] = settings?.work_days || ["MON", "TUE", "WED", "THU", "FRI"];
  const dayCodes = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  let expectedHoursMonth = 0;
  const startTime = settings?.work_start_time?.slice(0, 5) || "09:00";
  const endTime = settings?.work_end_time?.slice(0, 5) || "18:00";
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const dailyHours = (eh + em / 60) - (sh + sm / 60);
  for (let d = new Date(monthStart); d <= now; d.setDate(d.getDate() + 1)) {
    if (workDays.includes(dayCodes[d.getDay()])) expectedHoursMonth += dailyHours;
  }
  const balanceMins = monthMins - expectedHoursMonth * 60;

  const yearStart = `${now.getFullYear()}-01-01`;
  const usedVacationDays = (leave as any[])
    .filter(l => l.type === "VACATION" && l.status === "APPROVED" && l.start_date >= yearStart)
    .reduce((acc, l) => acc + (differenceInDays(parseISO(l.end_date), parseISO(l.start_date)) + 1), 0);
  const totalVacation = settings?.vacation_days_per_year ?? 22;
  const availableVacation = totalVacation - usedVacationDays;

  const pendingLeaves = (leave as any[]).filter(l => l.status === "PENDING").length;

  const fmtH = (mins: number) => {
    const sign = mins < 0 ? "-" : "";
    const a = Math.abs(mins);
    return `${sign}${Math.floor(a / 60)}h ${(a % 60).toString().padStart(2, "0")}m`;
  };

  const kpis: MiniKpi[] = [
    { label: "Esta semana", value: fmtH(weekMins), icon: Clock, color: "text-primary", bg: "bg-primary/10" },
    {
      label: "Balance del mes", value: fmtH(balanceMins),
      icon: CalendarCheck,
      color: balanceMins >= 0 ? "text-[hsl(var(--success))]" : "text-destructive",
      bg: balanceMins >= 0 ? "bg-[hsl(var(--success))]/10" : "bg-destructive/10",
      hint: balanceMins >= 0 ? "A favor" : "Por recuperar",
    },
    {
      label: "Vacaciones disponibles", value: `${availableVacation} días`,
      icon: Palmtree, color: "text-primary", bg: "bg-primary/10",
      hint: `${usedVacationDays} / ${totalVacation} usados`,
    },
    {
      label: "Solicitudes pendientes", value: String(pendingLeaves),
      icon: Bell,
      color: pendingLeaves > 0 ? "text-[hsl(var(--warning))]" : "text-muted-foreground",
      bg: pendingLeaves > 0 ? "bg-[hsl(var(--warning))]/10" : "bg-muted",
    },
  ];

  const userName = user?.email?.split("@")[0] || "";

  return (
    <div className="space-y-5">
      {/* Hero header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hola{userName ? `, ${userName}` : ""} 👋</h1>
        <p className="text-sm text-muted-foreground">Aquí tienes tu jornada de hoy y lo importante de la semana.</p>
      </div>

      {/* Personal KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">{k.label}</span>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${k.bg}`}>
                  <k.icon className={`h-3.5 w-3.5 ${k.color}`} />
                </div>
              </div>
              <p className={`text-xl font-bold tracking-tight ${k.color}`}>{k.value}</p>
              {k.hint && <p className="text-[11px] text-muted-foreground mt-1">{k.hint}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Hero attendance + Reminders */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TodayAttendanceWidget />
        </div>
        <div className="lg:col-span-1">
          <RemindersWidget />
        </div>
      </div>

      {/* Week chart + Vacations + Documents */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <MyWeekAttendanceWidget />
        <MyVacationsWidget />
        <MyDocumentsWidget />
      </div>
    </div>
  );
};

export default EmployeeDashboard;
