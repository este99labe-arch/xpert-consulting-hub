import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const LEAVE_TYPES = [
  { value: "VACATION", label: "Vacaciones" },
  { value: "SICK", label: "Baja médica" },
  { value: "PERSONAL", label: "Asunto personal" },
  { value: "MATERNITY", label: "Maternidad/Paternidad" },
  { value: "OTHER", label: "Otro" },
];

const VacationCalendarTab = () => {
  const { accountId, role } = useAuth();
  const [month, setMonth] = useState(new Date());
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";

  const { data: allLeaves = [] } = useQuery({
    queryKey: ["calendar-leaves", accountId, month.getMonth(), month.getFullYear()],
    queryFn: async () => {
      const start = startOfMonth(month);
      const end = endOfMonth(month);
      let q = supabase.from("leave_requests").select("*").in("status", ["APPROVED", "PENDING"]);
      if (isManager) q = q.eq("account_id", accountId!);
      q = q.lte("start_date", format(end, "yyyy-MM-dd")).gte("end_date", format(start, "yyyy-MM-dd"));
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const userIds = [...new Set(allLeaves.map((l: any) => l.user_id))];
  const { data: userProfiles = [] } = useQuery({
    queryKey: ["leave-user-profiles", userIds],
    queryFn: async () => {
      try {
        const res = await supabase.functions.invoke("admin_reset_password", { body: { action: "list_users" } });
        if (res.error || res.data?.error) return [];
        return (res.data?.users || []).filter((u: any) => userIds.includes(u.user_id));
      } catch { return []; }
    },
    enabled: userIds.length > 0 && isManager,
  });
  const emailMap = new Map<string, string>(userProfiles.map((p: any) => [p.user_id, p.email]));

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const leavesForDay = (day: Date) =>
    allLeaves.filter((l: any) => isWithinInterval(day, { start: parseISO(l.start_date), end: parseISO(l.end_date) }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1))}>←</Button>
        <span className="font-semibold capitalize">{format(month, "MMMM yyyy", { locale: es })}</span>
        <Button variant="outline" size="sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1))}>→</Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-1">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
            {Array.from({ length: (daysInMonth[0].getDay() + 6) % 7 }).map((_, i) => <div key={`empty-${i}`} />)}
            {daysInMonth.map(day => {
              const leaves = leavesForDay(day);
              const hasApproved = leaves.some((l: any) => l.status === "APPROVED");
              const hasPending = leaves.some((l: any) => l.status === "PENDING");
              const isToday = isSameDay(day, new Date());
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[60px] rounded-md border p-1 text-xs transition-colors",
                    isToday && "border-primary",
                    isWeekend && "bg-muted/30",
                    hasApproved && "bg-primary/15 border-primary/40",
                    hasPending && !hasApproved && "shadow-md shadow-muted-foreground/20 border-dashed border-muted-foreground/40"
                  )}
                >
                  <div className="font-medium">{day.getDate()}</div>
                  {leaves.slice(0, 2).map((l: any) => {
                    const typeLabel = LEAVE_TYPES.find(t => t.value === l.type)?.label || l.type;
                    const email = emailMap.get(l.user_id);
                    const isPending = l.status === "PENDING";
                    return (
                      <div key={l.id} className={cn(
                        "truncate text-[10px]",
                        isPending ? "text-muted-foreground italic" : "text-primary font-medium"
                      )}>
                        {email ? email.split("@")[0] : ""} {typeLabel}
                        {isPending && " ⏳"}
                      </div>
                    );
                  })}
                  {leaves.length > 2 && <div className="text-[10px] text-muted-foreground">+{leaves.length - 2} más</div>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VacationCalendarTab;
