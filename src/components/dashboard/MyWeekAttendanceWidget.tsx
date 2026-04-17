import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { startOfWeek, addDays, format, differenceInMinutes, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const MyWeekAttendanceWidget = () => {
  const { user, accountId } = useAuth();
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);

  const { data: records = [] } = useQuery({
    queryKey: ["my-week-attendance", user?.id, format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", user!.id)
        .eq("account_id", accountId!)
        .gte("work_date", format(weekStart, "yyyy-MM-dd"))
        .lte("work_date", format(weekEnd, "yyyy-MM-dd"));
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!accountId,
  });

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      const ds = format(d, "yyyy-MM-dd");
      const dayRecs = (records as any[]).filter(r => r.work_date === ds);
      const mins = dayRecs.reduce((acc, r) => {
        if (!r.check_in) return acc;
        const ci = parseISO(r.check_in);
        const co = r.check_out ? parseISO(r.check_out) : new Date();
        return acc + Math.max(0, differenceInMinutes(co, ci));
      }, 0);
      return { label: format(d, "EEE", { locale: es }).slice(0, 3), hours: mins / 60, isToday: ds === format(new Date(), "yyyy-MM-dd") };
    });
  }, [records, weekStart]);

  const max = Math.max(8, ...days.map(d => d.hours));
  const totalH = days.reduce((acc, d) => acc + d.hours, 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Mi semana
          </CardTitle>
          <span className="text-xs text-muted-foreground">{totalH.toFixed(1)}h totales</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-end justify-between gap-2 h-32 pt-3">
          {days.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full">
              <div className="flex-1 w-full flex items-end">
                <div
                  className={`w-full rounded-t transition-all ${d.isToday ? "bg-primary" : "bg-primary/40"}`}
                  style={{ height: `${(d.hours / max) * 100}%`, minHeight: d.hours > 0 ? "4px" : "0" }}
                  title={`${d.hours.toFixed(1)}h`}
                />
              </div>
              <span className={`text-[10px] capitalize ${d.isToday ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                {d.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default MyWeekAttendanceWidget;
