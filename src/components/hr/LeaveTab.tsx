import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, differenceInBusinessDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Loader2, CalendarIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import PaginationControls from "@/components/shared/PaginationControls";
import { usePagination } from "@/hooks/use-pagination";

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

const LeaveTab = () => {
  const { accountId, user, role } = useAuth();
  const queryClient = useQueryClient();
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";
  const [showCreate, setShowCreate] = useState(false);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["leave-requests", accountId],
    queryFn: async () => {
      let q = supabase.from("leave_requests").select("*").order("created_at", { ascending: false });
      if (isManager) q = q.eq("account_id", accountId!);
      else q = q.eq("user_id", user!.id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId && !!user,
  });

  const leaveUserIds = [...new Set(requests.map((r: any) => r.user_id))];
  const { data: leaveProfiles = [] } = useQuery({
    queryKey: ["leave-user-emails", leaveUserIds, isManager],
    queryFn: async () => {
      if (!isManager) return [] as { user_id: string; email: string }[];
      try {
        const res = await supabase.functions.invoke("admin_reset_password", { body: { action: "list_users" } });
        if (res.error || res.data?.error) return [] as { user_id: string; email: string }[];
        return ((res.data?.users || []) as { user_id: string; email: string }[]).filter((u) => leaveUserIds.includes(u.user_id));
      } catch { return [] as { user_id: string; email: string }[]; }
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

  const pagination = usePagination(requests);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{requests.length} solicitudes</p>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />Nueva Solicitud</Button>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {requests.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">No hay solicitudes de ausencia</Card>
        ) : (
          pagination.paginatedItems.map((r: any) => {
            const days = differenceInBusinessDays(parseISO(r.end_date), parseISO(r.start_date)) + 1;
            const typeLabel = LEAVE_TYPES.find(t => t.value === r.type)?.label || r.type;
            const st = STATUS_MAP[r.status] || { label: r.status, variant: "outline" as const };
            return (
              <Card key={r.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{typeLabel}</span>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </div>
                {isManager && <p className="text-xs text-muted-foreground">{leaveEmailMap.get(r.user_id)?.split("@")[0] || r.user_id.slice(0, 8)}</p>}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{format(parseISO(r.start_date), "dd/MM/yyyy")} → {format(parseISO(r.end_date), "dd/MM/yyyy")}</span>
                  <span>{days} días</span>
                </div>
                {isManager && r.status === "PENDING" && (
                  <div className="flex items-center gap-1 pt-1 border-t">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => updateStatusMutation.mutate({ id: r.id, status: "APPROVED" })}>Aprobar</Button>
                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => updateStatusMutation.mutate({ id: r.id, status: "REJECTED" })}>Rechazar</Button>
                  </div>
                )}
              </Card>
            );
          })
        )}
        {requests.length > 0 && (
          <PaginationControls
            currentPage={pagination.currentPage} totalPages={pagination.totalPages}
            totalItems={pagination.totalItems} pageSize={pagination.pageSize}
            startIndex={pagination.startIndex} endIndex={pagination.endIndex}
            onPageChange={pagination.setCurrentPage} onPageSizeChange={pagination.setPageSize}
            pageSizeOptions={pagination.pageSizeOptions}
          />
        )}
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
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
                pagination.paginatedItems.map((r: any) => {
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
          {requests.length > 0 && (
            <div className="px-4 pb-4">
              <PaginationControls
                currentPage={pagination.currentPage} totalPages={pagination.totalPages}
                totalItems={pagination.totalItems} pageSize={pagination.pageSize}
                startIndex={pagination.startIndex} endIndex={pagination.endIndex}
                onPageChange={pagination.setCurrentPage} onPageSizeChange={pagination.setPageSize}
                pageSizeOptions={pagination.pageSizeOptions}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <CreateLeaveDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
};

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
        account_id: accountId!, user_id: user!.id, type,
        start_date: format(startDate, "yyyy-MM-dd"), end_date: format(endDate, "yyyy-MM-dd"),
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

export default LeaveTab;
