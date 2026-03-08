import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Clock, LogIn, LogOut, Loader2, ChevronLeft, ChevronRight, Timer, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import {
  startOfWeek, endOfWeek, addWeeks, subWeeks, format, eachDayOfInterval,
  differenceInMinutes, isToday,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
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
  expected: { label: "Esperadas", color: "hsl(var(--muted))" },
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

  return (
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
              <div className={`rounded-full p-2 ${balanceMins >= 0 ? "bg-primary/10" : "bg-destructive/10"}`}>
                {balanceMins > 0 ? <TrendingUp className="h-5 w-5 text-primary" /> :
                  balanceMins < 0 ? <TrendingDown className="h-5 w-5 text-destructive" /> :
                    <Minus className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className={`text-xl font-bold ${balanceMins >= 0 ? "text-primary" : "text-destructive"}`}>
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
                <Badge variant="outline" className="text-primary border-primary">Jornada completa</Badge>
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
                  <TableHead>Fuente</TableHead>
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
                          <TableCell>
                            {record?.source && record.source !== "APP" ? (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {record.source === "WHATSAPP" ? "📱 WA" : record.source === "MIXED" ? "🔀 Mixto" : record.source}
                              </Badge>
                            ) : record ? (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">App</Badge>
                            ) : null}
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
  );
};

export default MyAttendanceView;
