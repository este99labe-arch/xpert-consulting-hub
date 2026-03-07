import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, differenceInBusinessDays, parseISO, isSameDay, isWithinInterval, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { es } from "date-fns/locale";
import {
  Users, CalendarIcon, FileText, Plus, Search, Loader2, Upload, Download, Trash2,
  Clock, CalendarDays, AlertCircle, UserCheck, UserX, File,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

/* ============================================================
   MAIN HR MODULE
   ============================================================ */
const AppHR = () => {
  const { role } = useAuth();
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Recursos Humanos</h1>
      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList>
          <TabsTrigger value="employees">
            <Users className="h-4 w-4 mr-2" />Empleados
          </TabsTrigger>
          <TabsTrigger value="leave">
            <CalendarDays className="h-4 w-4 mr-2" />Ausencias
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarIcon className="h-4 w-4 mr-2" />Calendario
          </TabsTrigger>
          {isManager && (
            <TabsTrigger value="documents">
              <FileText className="h-4 w-4 mr-2" />Documentación
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="employees"><EmployeesTab /></TabsContent>
        <TabsContent value="leave"><LeaveTab /></TabsContent>
        <TabsContent value="calendar"><VacationCalendarTab /></TabsContent>
        {isManager && <TabsContent value="documents"><DocumentsTab /></TabsContent>}
      </Tabs>
    </div>
  );
};

/* ============================================================
   EMPLOYEES TAB
   ============================================================ */
const EmployeesTab = () => {
  const { accountId, role, user } = useAuth();
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";
  const [search, setSearch] = useState("");
  const [showCreateUser, setShowCreateUser] = useState(false);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["hr-employees", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_accounts")
        .select("id, user_id, is_active, role_id, created_at, roles(code)")
        .eq("account_id", accountId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  // Get emails for all user_ids (only for admin roles allowed by edge function)
  const userIds = employees.map((e: any) => e.user_id);
  const { data: profiles = [] } = useQuery({
    queryKey: ["hr-employee-emails", userIds, isManager],
    queryFn: async () => {
      if (!isManager) return [] as { user_id: string; email: string }[];
      try {
        const res = await supabase.functions.invoke("admin_reset_password", {
          body: { action: "list_users" },
        });
        if (res.error || res.data?.error) return [] as { user_id: string; email: string }[];
        return ((res.data?.users || []) as { user_id: string; email: string }[]).filter((u) => userIds.includes(u.user_id));
      } catch {
        return [] as { user_id: string; email: string }[];
      }
    },
    enabled: isManager && userIds.length > 0,
  });

  const emailMap = new Map<string, string>(profiles.map((p) => [p.user_id, p.email]));
  if (!isManager && user?.id && user?.email) emailMap.set(user.id, user.email);

  const filtered = employees.filter((e: any) => {
    const email = emailMap.get(e.user_id) || "";
    const role = (e as any).roles?.code || "";
    return email.toLowerCase().includes(search.toLowerCase()) || role.toLowerCase().includes(search.toLowerCase());
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por email o rol..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {isManager && (
          <Button onClick={() => setShowCreateUser(true)}>
            <Plus className="h-4 w-4 mr-2" />Dar de Alta
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Alta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No se encontraron empleados</TableCell></TableRow>
              ) : (
                filtered.map((emp: any) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emailMap.get(emp.user_id) || emp.user_id}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{(emp as any).roles?.code || "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      {emp.is_active ? (
                        <span className="flex items-center gap-1 text-sm"><UserCheck className="h-4 w-4 text-primary" />Activo</span>
                      ) : (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground"><UserX className="h-4 w-4" />Inactivo</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{new Date(emp.created_at).toLocaleDateString("es-ES")}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isManager && <CreateEmployeeDialog open={showCreateUser} onOpenChange={setShowCreateUser} />}
    </div>
  );
};

/* ---------- Create Employee Dialog ---------- */
const CreateEmployeeDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const { accountId } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleCode, setRoleCode] = useState("EMPLOYEE");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const res = await supabase.functions.invoke("admin_reset_password", {
        body: { action: "create_user", email, new_password: password, role_code: roleCode, account_id: accountId },
      });
      if (res.error || res.data?.error) throw new Error(res.data?.error || res.error?.message);
      toast({ title: "Empleado creado correctamente" });
      queryClient.invalidateQueries({ queryKey: ["hr-employees"] });
      queryClient.invalidateQueries({ queryKey: ["hr-employee-emails"] });
      setEmail("");
      setPassword("");
      setRoleCode("EMPLOYEE");
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dar de Alta Empleado</DialogTitle>
          <DialogDescription>Crea una cuenta para un nuevo miembro del equipo</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="empleado@empresa.com" required />
          </div>
          <div className="space-y-2">
            <Label>Contraseña</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} />
          </div>
          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={roleCode} onValueChange={setRoleCode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EMPLOYEE">Empleado</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Crear Empleado
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/* ============================================================
   LEAVE REQUESTS TAB
   ============================================================ */
const LEAVE_TYPES = [
  { value: "VACATION", label: "Vacaciones" },
  { value: "SICK", label: "Baja médica" },
  { value: "PERSONAL", label: "Asunto personal" },
  { value: "MATERNITY", label: "Maternidad/Paternidad" },
  { value: "OTHER", label: "Otro" },
];

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pendiente", variant: "outline" },
  APPROVED: { label: "Aprobada", variant: "default" },
  REJECTED: { label: "Rechazada", variant: "destructive" },
};

const LeaveTab = () => {
  const { accountId, user, role } = useAuth();
  const queryClient = useQueryClient();
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";
  const [showCreate, setShowCreate] = useState(false);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["leave-requests", accountId],
    queryFn: async () => {
      let q = supabase.from("leave_requests").select("*").order("created_at", { ascending: false });
      if (isManager) {
        q = q.eq("account_id", accountId!);
      } else {
        q = q.eq("user_id", user!.id);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId && !!user,
  });

  // Fetch emails for leave request owners (managers only)
  const leaveUserIds = [...new Set(requests.map((r: any) => r.user_id))];
  const { data: leaveProfiles = [] } = useQuery({
    queryKey: ["leave-user-emails", leaveUserIds, isManager],
    queryFn: async () => {
      if (!isManager) return [] as { user_id: string; email: string }[];
      try {
        const res = await supabase.functions.invoke("admin_reset_password", {
          body: { action: "list_users" },
        });
        if (res.error || res.data?.error) return [] as { user_id: string; email: string }[];
        return ((res.data?.users || []) as { user_id: string; email: string }[]).filter((u) => leaveUserIds.includes(u.user_id));
      } catch {
        return [] as { user_id: string; email: string }[];
      }
    },
    enabled: isManager && leaveUserIds.length > 0,
  });
  const leaveEmailMap = new Map<string, string>(leaveProfiles.map((p) => [p.user_id, p.email]));

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("leave_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      toast({ title: "Estado actualizado" });
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{requests.length} solicitudes</p>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />Nueva Solicitud</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {isManager && <TableHead>Solicitante</TableHead>}
                <TableHead>Tipo</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead>Hasta</TableHead>
                <TableHead>Días</TableHead>
                <TableHead>Estado</TableHead>
                {isManager && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow><TableCell colSpan={isManager ? 8 : 5} className="text-center text-muted-foreground py-8">No hay solicitudes de ausencia</TableCell></TableRow>
              ) : (
                requests.map((r: any) => {
                  const days = differenceInBusinessDays(parseISO(r.end_date), parseISO(r.start_date)) + 1;
                  const typeLabel = LEAVE_TYPES.find(t => t.value === r.type)?.label || r.type;
                  const st = STATUS_MAP[r.status] || { label: r.status, variant: "outline" as const };
                    return (
                    <TableRow key={r.id}>
                      {isManager && (
                        <TableCell className="font-medium">
                          {leaveEmailMap.get(r.user_id)?.split("@")[0] || r.user_id.slice(0, 8)}
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{typeLabel}</TableCell>
                      <TableCell>{format(parseISO(r.start_date), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{format(parseISO(r.end_date), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{days}</TableCell>
                      <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                      {isManager && (
                        <TableCell className="text-right space-x-1">
                          {r.status === "PENDING" && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate({ id: r.id, status: "APPROVED" })}>Aprobar</Button>
                              <Button size="sm" variant="destructive" onClick={() => updateStatusMutation.mutate({ id: r.id, status: "REJECTED" })}>Rechazar</Button>
                            </>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateLeaveDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
};

/* ---------- Create Leave Dialog ---------- */
const CreateLeaveDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const { accountId, user } = useAuth();
  const queryClient = useQueryClient();
  const [type, setType] = useState("VACATION");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("leave_requests").insert({
        account_id: accountId!,
        user_id: user!.id,
        type,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
      });
      if (error) throw error;
      toast({ title: "Solicitud creada" });
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva Solicitud de Ausencia</DialogTitle>
          <DialogDescription>Selecciona tipo y fechas</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DatePickerField label="Desde" date={startDate} onSelect={setStartDate} />
            <DatePickerField label="Hasta" date={endDate} onSelect={setEndDate} />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !startDate || !endDate}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Enviar Solicitud
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const DatePickerField = ({ label, date, onSelect }: { label: string; date?: Date; onSelect: (d: Date | undefined) => void }) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "dd/MM/yyyy") : "Seleccionar"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={onSelect} initialFocus className="p-3 pointer-events-auto" locale={es} />
      </PopoverContent>
    </Popover>
  </div>
);

/* ============================================================
   VACATION CALENDAR TAB
   ============================================================ */
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

  // Get emails for leave owners
  const userIds = [...new Set(allLeaves.map((l: any) => l.user_id))];
  const { data: userProfiles = [] } = useQuery({
    queryKey: ["leave-user-profiles", userIds],
    queryFn: async () => {
      try {
        const res = await supabase.functions.invoke("admin_reset_password", {
          body: { action: "list_users" },
        });
        if (res.error || res.data?.error) return [];
        return (res.data?.users || []).filter((u: any) => userIds.includes(u.user_id));
      } catch {
        return [];
      }
    },
    enabled: userIds.length > 0 && isManager,
  });
  const emailMap = new Map<string, string>(userProfiles.map((p: any) => [p.user_id, p.email]));

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });

  const leavesForDay = (day: Date) =>
    allLeaves.filter((l: any) =>
      isWithinInterval(day, { start: parseISO(l.start_date), end: parseISO(l.end_date) })
    );

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
            {/* Offset for first day */}
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

/* ============================================================
   DOCUMENTS TAB (Manager only)
   ============================================================ */
const DOC_CATEGORIES = [
  { value: "CONTRACT", label: "Contrato" },
  { value: "ID", label: "Identificación" },
  { value: "PAYSLIP", label: "Nómina" },
  { value: "CERTIFICATE", label: "Certificado" },
  { value: "OTHER", label: "Otro" },
];

const DocumentsTab = () => {
  const { accountId, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEmployee, setSelectedEmployee] = useState<string>("ALL");
  const [showUpload, setShowUpload] = useState(false);

  // Get employees
  const { data: employees = [] } = useQuery({
    queryKey: ["hr-doc-employees", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_accounts")
        .select("user_id, roles(code)")
        .eq("account_id", accountId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const empUserIds = employees.map((e: any) => e.user_id);
  const { data: empProfiles = [] } = useQuery({
    queryKey: ["hr-doc-profiles", empUserIds],
    queryFn: async () => {
      try {
        const res = await supabase.functions.invoke("admin_reset_password", {
          body: { action: "list_users" },
        });
        if (res.error || res.data?.error) return [] as { user_id: string; email: string }[];
        return ((res.data?.users || []) as { user_id: string; email: string }[]).filter((u) => empUserIds.includes(u.user_id));
      } catch {
        return [] as { user_id: string; email: string }[];
      }
    },
    enabled: empUserIds.length > 0,
  });
  const empEmailMap = new Map<string, string>(empProfiles.map((p) => [p.user_id, p.email]));

  // Get documents
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["employee-documents", accountId, selectedEmployee],
    queryFn: async () => {
      let q = supabase.from("employee_documents").select("*").eq("account_id", accountId!).order("created_at", { ascending: false });
      if (selectedEmployee !== "ALL") q = q.eq("user_id", selectedEmployee);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: any) => {
      // Delete from storage first
      await supabase.storage.from("employee-documents").remove([doc.file_path]);
      const { error } = await supabase.from("employee_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-documents"] });
      toast({ title: "Documento eliminado" });
    },
  });

  const handleDownload = async (doc: any) => {
    const { data } = await supabase.storage.from("employee-documents").createSignedUrl(doc.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Filtrar por empleado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los empleados</SelectItem>
            {employees.map((e: any) => (
              <SelectItem key={e.user_id} value={e.user_id}>
                {empEmailMap.get(e.user_id) || e.user_id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowUpload(true)}><Upload className="h-4 w-4 mr-2" />Subir Documento</Button>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="h-10 w-10 mb-3" />
            <p>No hay documentos</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc: any) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <File className="h-4 w-4 text-muted-foreground" />{doc.name}
                    </TableCell>
                    <TableCell>{empEmailMap.get(doc.user_id) || doc.user_id}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{DOC_CATEGORIES.find(c => c.value === doc.category)?.label || doc.category}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{new Date(doc.created_at).toLocaleDateString("es-ES")}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)}><Download className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("¿Eliminar documento?")) deleteMutation.mutate(doc); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <UploadDocumentDialog
        open={showUpload}
        onOpenChange={setShowUpload}
        employees={employees}
        emailMap={empEmailMap}
      />
    </div>
  );
};

/* ---------- Upload Document Dialog ---------- */
const UploadDocumentDialog = ({
  open, onOpenChange, employees, emailMap,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employees: any[];
  emailMap: Map<string, string>;
}) => {
  const { accountId, user } = useAuth();
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !employeeId) return;
    setLoading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${employeeId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("employee-documents").upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("employee_documents").insert({
        account_id: accountId!,
        user_id: employeeId,
        name: name || file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        category,
        uploaded_by: user!.id,
      });
      if (insertError) throw insertError;

      toast({ title: "Documento subido" });
      queryClient.invalidateQueries({ queryKey: ["employee-documents"] });
      onOpenChange(false);
      setFile(null);
      setName("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Subir Documento</DialogTitle>
          <DialogDescription>Adjunta un archivo al expediente del empleado</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Empleado</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Selecciona empleado" /></SelectTrigger>
              <SelectContent>
                {employees.map((e: any) => (
                  <SelectItem key={e.user_id} value={e.user_id}>{emailMap.get(e.user_id) || e.user_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nombre del documento</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Contrato 2026" />
          </div>
          <div className="space-y-2">
            <Label>Archivo</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !file || !employeeId}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Subir
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AppHR;
