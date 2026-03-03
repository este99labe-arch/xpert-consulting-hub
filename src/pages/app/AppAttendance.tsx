import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Clock, LogIn, LogOut, Loader2, ChevronLeft, ChevronRight, Download, Users, Timer, TrendingUp, TrendingDown, Minus, Building2
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  startOfWeek, endOfWeek, addWeeks, subWeeks, format, eachDayOfInterval,
  startOfMonth, endOfMonth, isSameDay, parseISO, differenceInMinutes, isToday,
  getISOWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

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

  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [manualIn, setManualIn] = useState("");
  const [manualOut, setManualOut] = useState("");
  const [selectedClientAccountId, setSelectedClientAccountId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"my" | "team">("my");

  const effectiveAccountId = isMasterAdmin ? (selectedClientAccountId || accountId) : accountId;

  // Fetch account settings for expected hours
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

  // ---- Month range ----
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  // ---- Week range ----
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // ---- My attendance (month) ----
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

  // ---- Client accounts for MASTER_ADMIN ----
  const { data: clientAccounts = [] } = useQuery({
    queryKey: ["master-client-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, name")
        .eq("type", "CLIENT")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: isMasterAdmin,
  });

  // ---- Team attendance (for managers) ----
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

  // ---- Team user emails ----
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

  // ---- Monthly summary calculations ----
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
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

  // ---- Weekly chart data ----
  const chartConfig = {
    worked: { label: "Trabajadas", color: "hsl(var(--primary))" },
    expected: { label: "Esperadas", color: "hsl(var(--muted))" },
  };

  const weeklyChartData = useMemo(() => {
    const weeksMap: Record<string, { worked: number; expected: number; label: string }> = {};
    monthDays.forEach(day => {
      const wk = getISOWeek(day);
      const ws = startOfWeek(day, { weekStartsOn: 1 });
      const key = `S${wk}`;
      if (!weeksMap[key]) {
        weeksMap[key] = {
          worked: 0,
          expected: 0,
          label: `${format(ws, "d MMM", { locale: es })}`,
        };
      }
      const dayCode = DAY_CODES[day.getDay()];
      if (workDays.includes(dayCode)) {
        weeksMap[key].expected += dailyExpectedMins / 60;
      }
      const rec = myMonthRecords.find(r => r.work_date === format(day, "yyyy-MM-dd"));
      if (rec?.check_in && rec?.check_out) {
        weeksMap[key].worked += differenceInMinutes(new Date(rec.check_out), new Date(rec.check_in)) / 60;
      }
    });
    return Object.entries(weeksMap).map(([key, val]) => ({
      name: key,
      label: val.label,
      worked: Math.round(val.worked * 10) / 10,
      expected: Math.round(val.expected * 10) / 10,
    }));
  }, [monthDays, myMonthRecords, workDays, dailyExpectedMins]);

  // ---- Check-in / Check-out ----
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayRecord = myMonthRecords.find(r => r.work_date === todayStr);
  const hasCheckedIn = !!todayRecord?.check_in;
  const hasCheckedOut = !!todayRecord?.check_out;

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      if (todayRecord) {
        const { error } = await supabase
          .from("attendance_records")
          .update({ check_in: now })
          .eq("id", todayRecord.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("attendance_records")
          .insert({ user_id: user!.id, account_id: accountId!, work_date: todayStr, check_in: now });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Entrada registrada" });
      queryClient.invalidateQueries({ queryKey: ["my-attendance-month"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      if (!todayRecord) throw new Error("No hay entrada registrada");
      const { error } = await supabase
        .from("attendance_records")
        .update({ check_out: new Date().toISOString() })
        .eq("id", todayRecord.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Salida registrada" });
      queryClient.invalidateQueries({ queryKey: ["my-attendance-month"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // ---- Manual entry ----
  const manualMutation = useMutation({
    mutationFn: async ({ date, checkIn, checkOut }: { date: string; checkIn: string; checkOut: string }) => {
      const ciISO = `${date}T${checkIn}:00`;
      const coISO = `${date}T${checkOut}:00`;
      const existing = myMonthRecords.find(r => r.work_date === date);
      if (existing) {
        const { error } = await supabase
          .from("attendance_records")
          .update({ check_in: ciISO, check_out: coISO })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("attendance_records")
          .insert({ user_id: user!.id, account_id: accountId!, work_date: date, check_in: ciISO, check_out: coISO });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Fichaje guardado" });
      setEditingDay(null);
      setManualIn("");
      setManualOut("");
      queryClient.invalidateQueries({ queryKey: ["my-attendance-month"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // ---- Team summary for managers ----
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
      userId,
      email: teamEmailMap[userId] || userId.slice(0, 8),
      ...data,
    }));
  }, [teamRecords, teamEmailMap]);

  // ---- Export CSV ----
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
            <Button
              variant={activeTab === "my" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("my")}
            >
              <Clock className="h-4 w-4 mr-1" /> Mis Fichajes
            </Button>
            <Button
              variant={activeTab === "team" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("team")}
            >
              <Users className="h-4 w-4 mr-1" /> Equipo
            </Button>
          </div>
        )}
      </div>

      {/* Master Admin client selector */}
      {isMasterAdmin && activeTab === "team" && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <Select
                value={selectedClientAccountId || ""}
                onValueChange={(v) => setSelectedClientAccountId(v || null)}
              >
                <SelectTrigger className="w-72">
                  <SelectValue placeholder="Selecciona un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientAccounts.map((acc: any) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

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
        <>
          {/* Monthly summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Timer className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Horas Fichadas</p>
                    <p className="text-xl font-bold">{formatMinutes(workedMonthMins)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-accent p-2">
                    <Clock className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Horas Esperadas</p>
                    <p className="text-xl font-bold">{formatMinutes(expectedMonthMins)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-full p-2 ${balanceMins >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
                    {balanceMins > 0 ? <TrendingUp className="h-5 w-5 text-success" /> :
                      balanceMins < 0 ? <TrendingDown className="h-5 w-5 text-destructive" /> :
                        <Minus className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <p className={`text-xl font-bold ${balanceMins >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatMinutes(balanceMins)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Weekly hours chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Horas por Semana</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart data={weeklyChartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}h`} />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    cursor={{ fill: "hsl(var(--muted) / 0.2)" }}
                  />
                  <Legend />
                  <Bar dataKey="expected" name="Esperadas" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="worked" name="Trabajadas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Check-in / Check-out buttons */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Hoy — {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}</p>
                  {todayRecord?.check_in && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Entrada: {format(new Date(todayRecord.check_in), "HH:mm")}
                      {todayRecord.check_out && ` · Salida: ${format(new Date(todayRecord.check_out), "HH:mm")}`}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {!hasCheckedIn && (
                    <Button onClick={() => checkInMutation.mutate()} disabled={checkInMutation.isPending}>
                      {checkInMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <LogIn className="h-4 w-4 mr-1" />}
                      Fichar Entrada
                    </Button>
                  )}
                  {hasCheckedIn && !hasCheckedOut && (
                    <Button variant="destructive" onClick={() => checkOutMutation.mutate()} disabled={checkOutMutation.isPending}>
                      {checkOutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <LogOut className="h-4 w-4 mr-1" />}
                      Fichar Salida
                    </Button>
                  )}
                  {hasCheckedOut && (
                    <Badge variant="outline" className="text-success border-success">Jornada completa</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weekly view */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Vista Semanal</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentWeek(prev => subWeeks(prev, 1))}>
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <span className="text-xs min-w-[140px] text-center">
                    {format(weekStart, "d MMM", { locale: es })} — {format(weekEnd, "d MMM yyyy", { locale: es })}
                  </span>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentWeek(prev => addWeeks(prev, 1))}>
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {myMonthLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Día</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Salida</TableHead>
                      <TableHead>Horas</TableHead>
                      <TableHead>Esperado</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weekDays.map(day => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const record = myMonthRecords.find(r => r.work_date === dateStr);
                      const dayCode = DAY_CODES[day.getDay()];
                      const isWorkDay = workDays.includes(dayCode);
                      const workedMins = record?.check_in && record?.check_out
                        ? differenceInMinutes(new Date(record.check_out), new Date(record.check_in)) : 0;
                      const isEditing = editingDay === dateStr;
                      const isTodayDay = isToday(day);

                      return (
                        <TableRow key={dateStr} className={isTodayDay ? "bg-primary/5" : !isWorkDay ? "bg-muted/30" : ""}>
                          <TableCell>
                            <div>
                              <span className="text-sm font-medium capitalize">{format(day, "EEE", { locale: es })}</span>
                              <span className="text-xs text-muted-foreground ml-1">{format(day, "d")}</span>
                              {isTodayDay && <Badge className="ml-2 text-[10px] px-1 py-0" variant="default">Hoy</Badge>}
                            </div>
                          </TableCell>
                          {isEditing ? (
                            <>
                              <TableCell>
                                <Input type="time" className="w-24 h-7 text-xs" value={manualIn} onChange={e => setManualIn(e.target.value)} />
                              </TableCell>
                              <TableCell>
                                <Input type="time" className="w-24 h-7 text-xs" value={manualOut} onChange={e => setManualOut(e.target.value)} />
                              </TableCell>
                              <TableCell colSpan={2}>
                                <div className="flex gap-1">
                                  <Button size="sm" className="h-7 text-xs" disabled={!manualIn || !manualOut || manualMutation.isPending}
                                    onClick={() => manualMutation.mutate({ date: dateStr, checkIn: manualIn, checkOut: manualOut })}>
                                    {manualMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingDay(null)}>Cancelar</Button>
                                </div>
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="text-sm">
                                {record?.check_in ? format(new Date(record.check_in), "HH:mm") : "—"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {record?.check_out ? format(new Date(record.check_out), "HH:mm") : "—"}
                              </TableCell>
                              <TableCell className="text-sm font-medium">
                                {workedMins > 0 ? formatMinutes(workedMins) : "—"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {isWorkDay ? formatMinutes(dailyExpectedMins) : "Libre"}
                              </TableCell>
                            </>
                          )}
                          <TableCell className="text-right">
                            {!isEditing && (
                              <Button variant="ghost" size="sm" className="h-7 text-xs"
                                onClick={() => {
                                  setEditingDay(dateStr);
                                  setManualIn(record?.check_in ? format(new Date(record.check_in), "HH:mm") : workStart);
                                  setManualOut(record?.check_out ? format(new Date(record.check_out), "HH:mm") : workEnd);
                                }}>
                                Editar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ---- TEAM TAB ---- */}
      {activeTab === "team" && isManager && (
        <>
          {isMasterAdmin && !selectedClientAccountId ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Building2 className="h-10 w-10 mb-3 opacity-50" />
                <p>Selecciona un cliente para ver la asistencia de sus empleados</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Export button */}
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handleExport} disabled={teamRecords.length === 0}>
                  <Download className="h-4 w-4 mr-1" /> Exportar CSV
                </Button>
              </div>

              {/* Team summary */}
              {teamLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : teamSummary.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Users className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">No hay registros de asistencia para este mes</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Resumen del Equipo — {format(selectedMonth, "MMMM yyyy", { locale: es })}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Empleado</TableHead>
                          <TableHead>Días Fichados</TableHead>
                          <TableHead>Horas Trabajadas</TableHead>
                          <TableHead>Media Diaria</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamSummary.map(emp => (
                          <TableRow key={emp.userId}>
                            <TableCell className="font-medium">{emp.email}</TableCell>
                            <TableCell>{emp.days}</TableCell>
                            <TableCell>{formatMinutes(emp.worked)}</TableCell>
                            <TableCell>{emp.days > 0 ? formatMinutes(Math.round(emp.worked / emp.days)) : "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default AppAttendance;
