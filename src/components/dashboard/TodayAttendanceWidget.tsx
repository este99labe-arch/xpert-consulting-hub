import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogIn, LogOut, Loader2, Clock } from "lucide-react";
import { format, differenceInMinutes, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

const DAY_CODES: Record<number, string> = { 1: "MON", 2: "TUE", 3: "WED", 4: "THU", 5: "FRI", 6: "SAT", 0: "SUN" };

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

const TodayAttendanceWidget = () => {
  const { user, accountId } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");

  // Account settings
  const { data: settings } = useQuery({
    queryKey: ["account-settings-dash", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_settings")
        .select("*")
        .eq("account_id", accountId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  const workStart = settings?.work_start_time?.slice(0, 5) || "09:00";
  const workEnd = settings?.work_end_time?.slice(0, 5) || "18:00";
  const dailyExpectedMins = timeToMinutes(workEnd) - timeToMinutes(workStart);

  // Today's record
  const { data: todayRecord, isLoading } = useQuery({
    queryKey: ["dash-today-attendance", user?.id, todayStr, accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", user!.id)
        .eq("account_id", accountId!)
        .eq("work_date", todayStr)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!accountId,
    refetchInterval: 60000, // refresh every minute for live timer
  });

  const hasCheckedIn = !!todayRecord?.check_in;
  const hasCheckedOut = !!todayRecord?.check_out;

  // Calculate worked minutes (live if still checked in)
  const workedMins = useMemo(() => {
    if (!todayRecord?.check_in) return 0;
    const checkIn = new Date(todayRecord.check_in);
    const end = todayRecord.check_out ? new Date(todayRecord.check_out) : now;
    return Math.max(0, differenceInMinutes(end, checkIn));
  }, [todayRecord, now]);

  // Progress percentage (capped at 100%)
  const progress = dailyExpectedMins > 0 ? Math.min(100, (workedMins / dailyExpectedMins) * 100) : 0;

  // SVG semi-circle gauge
  const radius = 80;
  const strokeWidth = 12;
  const circumference = Math.PI * radius; // half circle
  const dashOffset = circumference - (progress / 100) * circumference;

  // Hours/minutes display
  const hours = Math.floor(workedMins / 60);
  const mins = workedMins % 60;
  const expectedH = Math.floor(dailyExpectedMins / 60);
  const expectedM = dailyExpectedMins % 60;

  // Mutations
  const checkInMutation = useMutation({
    mutationFn: async () => {
      const nowISO = new Date().toISOString();
      if (todayRecord) {
        const { error } = await supabase.from("attendance_records").update({ check_in: nowISO }).eq("id", todayRecord.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendance_records").insert({
          user_id: user!.id, account_id: accountId!, work_date: todayStr, check_in: nowISO,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Entrada registrada" });
      queryClient.invalidateQueries({ queryKey: ["dash-today-attendance"] });
      queryClient.invalidateQueries({ queryKey: ["my-attendance-month"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      if (!todayRecord) throw new Error("No hay entrada registrada");
      const { error } = await supabase.from("attendance_records").update({ check_out: new Date().toISOString() }).eq("id", todayRecord.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Salida registrada" });
      queryClient.invalidateQueries({ queryKey: ["dash-today-attendance"] });
      queryClient.invalidateQueries({ queryKey: ["my-attendance-month"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Color based on progress
  const gaugeColor = hasCheckedOut
    ? "hsl(var(--primary))"
    : progress >= 75
      ? "hsl(var(--primary))"
      : progress >= 50
        ? "hsl(var(--warning, 45 93% 47%))"
        : "hsl(var(--muted-foreground))";

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Fichaje del día
          </CardTitle>
          <span className="text-xs text-muted-foreground capitalize">
            {format(now, "EEEE d MMM", { locale: es })}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col items-center">
          {/* Semi-circle gauge */}
          <div className="relative" style={{ width: radius * 2 + strokeWidth * 2, height: radius + strokeWidth + 20 }}>
            <svg
              width={radius * 2 + strokeWidth * 2}
              height={radius + strokeWidth + 10}
              viewBox={`0 0 ${radius * 2 + strokeWidth * 2} ${radius + strokeWidth + 10}`}
            >
              {/* Background arc */}
              <path
                d={`M ${strokeWidth} ${radius + strokeWidth / 2} A ${radius} ${radius} 0 0 1 ${radius * 2 + strokeWidth} ${radius + strokeWidth / 2}`}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
              {/* Progress arc */}
              <path
                d={`M ${strokeWidth} ${radius + strokeWidth / 2} A ${radius} ${radius} 0 0 1 ${radius * 2 + strokeWidth} ${radius + strokeWidth / 2}`}
                fill="none"
                stroke={gaugeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
              <span className="text-3xl font-bold tracking-tight">
                {hours}h {mins.toString().padStart(2, "0")}m
              </span>
              <span className="text-xs text-muted-foreground">
                de {expectedH}h {expectedM > 0 ? `${expectedM}m` : ""} esperadas
              </span>
            </div>
          </div>

          {/* Status & times */}
          <div className="flex items-center gap-4 mt-2 text-sm">
            {todayRecord?.check_in && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <LogIn className="h-3.5 w-3.5" />
                <span>{format(new Date(todayRecord.check_in), "HH:mm")}</span>
              </div>
            )}
            {todayRecord?.check_out && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <LogOut className="h-3.5 w-3.5" />
                <span>{format(new Date(todayRecord.check_out), "HH:mm")}</span>
              </div>
            )}
            {hasCheckedIn && !hasCheckedOut && (
              <Badge variant="default" className="text-[10px] animate-pulse">En curso</Badge>
            )}
            {hasCheckedOut && (
              <Badge variant="outline" className="text-[10px] text-primary border-primary">Completado</Badge>
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-4 w-full">
            {!hasCheckedIn && (
              <Button className="w-full" onClick={() => checkInMutation.mutate()} disabled={checkInMutation.isPending}>
                {checkInMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
                Fichar Entrada
              </Button>
            )}
            {hasCheckedIn && !hasCheckedOut && (
              <Button variant="destructive" className="w-full" onClick={() => checkOutMutation.mutate()} disabled={checkOutMutation.isPending}>
                {checkOutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
                Fichar Salida
              </Button>
            )}
            {hasCheckedOut && (
              <div className="text-center text-sm text-muted-foreground">
                Jornada finalizada · {Math.round(progress)}% completado
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TodayAttendanceWidget;
