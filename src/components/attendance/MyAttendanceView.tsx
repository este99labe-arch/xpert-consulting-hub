import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  LogIn, LogOut, Loader2, ChevronLeft, ChevronRight, Timer, TrendingUp, TrendingDown, Minus, Play, Square, CheckCircle2, Pencil, X, Save,
} from "lucide-react";
import {
  startOfWeek, endOfWeek, addWeeks, subWeeks, format, eachDayOfInterval,
  differenceInMinutes, isToday,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface AttendanceRecord {
  id: string;
  user_id: string;
  account_id: string;
  work_date: string;
  check_in: string | null;
  check_out: string | null;
  created_at: string;
  source?: string;
  location_lat?: number | null;
  location_lng?: number | null;
  phone_number?: string | null;
}

interface MyAttendanceViewProps {
  myMonthRecords: AttendanceRecord[];
  myMonthLoading: boolean;
  workedMonthMins: number;
  expectedMonthMins: number;
  balanceMins: number;
  weeklyChartData: { name: string; label: string; worked: number; expected: number }[];
  todayRecord: AttendanceRecord | undefined;
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  checkInMutation: { mutate: () => void; isPending: boolean };
  checkOutMutation: { mutate: () => void; isPending: boolean };
  manualMutation: { mutate: (args: { date: string; checkIn: string; checkOut: string }) => void; isPending: boolean };
  workDays: string[];
  workStart: string;
  workEnd: string;
  dailyExpectedMins: number;
  DAY_CODES: Record<number, string>;
  formatMinutes: (mins: number) => string;
}

const chartConfig = {
  worked: { label: "Trabajadas", color: "hsl(var(--primary))" },
  expected: { label: "Esperadas", color: "hsl(var(--border))" },
};

const MyAttendanceView = ({
  myMonthRecords, myMonthLoading,
  workedMonthMins, expectedMonthMins, balanceMins,
  weeklyChartData, todayRecord, hasCheckedIn, hasCheckedOut,
  checkInMutation, checkOutMutation, manualMutation,
  workDays, workStart, workEnd, dailyExpectedMins,
  DAY_CODES, formatMinutes,
}: MyAttendanceViewProps) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [manualIn, setManualIn] = useState("");
  const [manualOut, setManualOut] = useState("");

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const workedHours = Math.floor(workedMonthMins / 60);
  const workedMins = workedMonthMins % 60;
  const expectedHours = Math.floor(expectedMonthMins / 60);
  const expectedMins = expectedMonthMins % 60;

  const progressPercent = expectedMonthMins > 0
    ? Math.min(100, Math.round((workedMonthMins / expectedMonthMins) * 100))
    : 0;

  const todayWorkedMins = useMemo(() => {
    if (!todayRecord?.check_in) return 0;
    const checkIn = new Date(todayRecord.check_in);
    const end = todayRecord.check_out ? new Date(todayRecord.check_out) : new Date();
    return Math.max(0, differenceInMinutes(end, checkIn));
  }, [todayRecord]);

  const todayProgress = dailyExpectedMins > 0 ? Math.min(100, Math.round((todayWorkedMins / dailyExpectedMins) * 100)) : 0;

  return (
    <div className="space-y-5">
      {/* Clock-in Hero Card */}
      <Card className="border-0 bg-gradient-to-br from-primary/[0.03] to-primary/[0.08] shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            {/* Left: Today info */}
            <div className="flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
              </p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-bold tracking-tight tabular-nums">
                  {Math.floor(todayWorkedMins / 60)}:{(todayWorkedMins % 60).toString().padStart(2, "0")}
                </span>
                <span className="text-sm text-muted-foreground">
                  / {Math.floor(dailyExpectedMins / 60)}:{(dailyExpectedMins % 60).toString().padStart(2, "0")} h
                </span>
              </div>

              {/* Today progress bar */}
              <div className="mt-3 w-full max-w-xs">
                <div className="h-1.5 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                    style={{ width: `${todayProgress}%` }}
                  />
                </div>
              </div>

              {/* Check-in/out times */}
              {todayRecord?.check_in && (
                <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <LogIn className="h-3 w-3" />
                    {format(new Date(todayRecord.check_in), "HH:mm")}
                  </span>
                  {todayRecord.check_out && (
                    <span className="flex items-center gap-1">
                      <LogOut className="h-3 w-3" />
                      {format(new Date(todayRecord.check_out), "HH:mm")}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Right: Action button */}
            <div className="flex flex-col items-center gap-2">
              {!hasCheckedIn && (
                <Button
                  size="lg"
                  className="h-14 w-14 rounded-full shadow-md"
                  onClick={() => checkInMutation.mutate()}
                  disabled={checkInMutation.isPending}
                >
                  {checkInMutation.isPending
                    ? <Loader2 className="h-5 w-5 animate-spin" />
                    : <Play className="h-5 w-5 ml-0.5" />
                  }
                </Button>
              )}
              {hasCheckedIn && !hasCheckedOut && (
                <Button
                  size="lg"
                  variant="destructive"
                  className="h-14 w-14 rounded-full shadow-md"
                  onClick={() => checkOutMutation.mutate()}
                  disabled={checkOutMutation.isPending}
                >
                  {checkOutMutation.isPending
                    ? <Loader2 className="h-5 w-5 animate-spin" />
                    : <Square className="h-4 w-4" />
                  }
                </Button>
              )}
              {hasCheckedOut && (
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
              )}
              <span className="text-[11px] font-medium text-muted-foreground">
                {!hasCheckedIn ? "Iniciar jornada" : hasCheckedIn && !hasCheckedOut ? "Finalizar" : "Completada"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="shadow-sm border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Fichadas</p>
                <p className="text-2xl font-bold mt-0.5 tabular-nums">
                  {workedHours}<span className="text-base font-medium text-muted-foreground">h</span>{" "}
                  {workedMins.toString().padStart(2, "0")}<span className="text-base font-medium text-muted-foreground">m</span>
                </p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Timer className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Esperadas</p>
                <p className="text-2xl font-bold mt-0.5 tabular-nums">
                  {expectedHours}<span className="text-base font-medium text-muted-foreground">h</span>{" "}
                  {expectedMins.toString().padStart(2, "0")}<span className="text-base font-medium text-muted-foreground">m</span>
                </p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                <Timer className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Balance</p>
                <p className={`text-2xl font-bold mt-0.5 tabular-nums ${balanceMins >= 0 ? "text-primary" : "text-destructive"}`}>
                  {balanceMins >= 0 ? "+" : ""}{formatMinutes(balanceMins)}
                </p>
              </div>
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${balanceMins >= 0 ? "bg-primary/10" : "bg-destructive/10"}`}>
                {balanceMins > 0 ? <TrendingUp className="h-4 w-4 text-primary" /> :
                  balanceMins < 0 ? <TrendingDown className="h-4 w-4 text-destructive" /> :
                    <Minus className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>{progressPercent}%</span>
              </div>
              <div className="h-1 rounded-full bg-border overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${balanceMins >= 0 ? "bg-primary" : "bg-destructive"}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly chart */}
      <Card className="shadow-sm border">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Horas por semana</h3>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Trabajadas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-border" /> Esperadas
              </span>
            </div>
          </div>
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <BarChart data={weeklyChartData} barGap={2} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}h`} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
              <Bar dataKey="expected" name="Esperadas" fill="hsl(var(--border))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="worked" name="Trabajadas" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Weekly detail table */}
      <Card className="shadow-sm border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold">Detalle semanal</h3>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentWeek(prev => subWeeks(prev, 1))}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-medium min-w-[150px] text-center text-muted-foreground">
              {format(weekStart, "d MMM", { locale: es })} — {format(weekEnd, "d MMM yyyy", { locale: es })}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentWeek(prev => addWeeks(prev, 1))}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {myMonthLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-muted/20">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Día</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Entrada</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Salida</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Total</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Esperado</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Fuente</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[80px]" />
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
                  <TableRow
                    key={dateStr}
                    className={`
                      ${isTodayDay ? "bg-primary/[0.04]" : !isWorkDay ? "bg-muted/20" : ""}
                      ${isTodayDay ? "border-l-2 border-l-primary" : ""}
                    `}
                  >
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium capitalize">{format(day, "EEE", { locale: es })}</span>
                        <span className="text-xs text-muted-foreground">{format(day, "d")}</span>
                        {isTodayDay && (
                          <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">Hoy</span>
                        )}
                      </div>
                    </TableCell>
                    {isEditing ? (
                      <>
                        <TableCell className="py-2.5">
                          <Input type="time" className="w-24 h-8 text-xs" value={manualIn} onChange={e => setManualIn(e.target.value)} />
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Input type="time" className="w-24 h-8 text-xs" value={manualOut} onChange={e => setManualOut(e.target.value)} />
                        </TableCell>
                        <TableCell colSpan={3} className="py-2.5">
                          <div className="flex gap-1.5">
                            <Button size="sm" className="h-8 text-xs gap-1" disabled={!manualIn || !manualOut || manualMutation.isPending}
                              onClick={() => manualMutation.mutate({ date: dateStr, checkIn: manualIn, checkOut: manualOut })}>
                              {manualMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                              Guardar
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={() => setEditingDay(null)}>
                              <X className="h-3 w-3" /> Cancelar
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="py-2.5 text-sm tabular-nums">
                          {record?.check_in ? format(new Date(record.check_in), "HH:mm") : <span className="text-muted-foreground/50">—</span>}
                        </TableCell>
                        <TableCell className="py-2.5 text-sm tabular-nums">
                          {record?.check_out ? format(new Date(record.check_out), "HH:mm") : <span className="text-muted-foreground/50">—</span>}
                        </TableCell>
                        <TableCell className="py-2.5 text-sm font-medium tabular-nums">
                          {workedMins > 0 ? formatMinutes(workedMins) : <span className="text-muted-foreground/50">—</span>}
                        </TableCell>
                        <TableCell className="py-2.5 text-sm text-muted-foreground tabular-nums">
                          {isWorkDay ? formatMinutes(dailyExpectedMins) : (
                            <span className="text-xs text-muted-foreground/60">Libre</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5">
                          {record?.source && record.source !== "APP" ? (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                              {record.source === "WHATSAPP" ? "WhatsApp" : record.source === "MIXED" ? "Mixto" : record.source}
                            </Badge>
                          ) : record ? (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">Web</Badge>
                          ) : null}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="py-2.5 text-right">
                      {!isEditing && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setEditingDay(dateStr);
                            setManualIn(record?.check_in ? format(new Date(record.check_in), "HH:mm") : workStart);
                            setManualOut(record?.check_out ? format(new Date(record.check_out), "HH:mm") : workEnd);
                          }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
};

export default MyAttendanceView;
