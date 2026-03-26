import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, Loader2, Users, Building2, Clock, Check, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import MasterAccountSelector from "@/components/shared/MasterAccountSelector";

interface TeamMember {
  userId: string;
  email: string;
  worked: number;
  days: number;
}

interface PendingDeleteRequest {
  id: string;
  attendance_id: string;
  reason: string;
  created_at: string;
}

interface TeamAttendanceViewProps {
  isMasterAdmin: boolean;
  selectedClientAccountId: string | null;
  onSelectClient: (id: string) => void;
  teamLoading: boolean;
  teamSummary: TeamMember[];
  teamRecordsCount: number;
  selectedMonth: Date;
  onExport: () => void;
  formatMinutes: (mins: number) => string;
  pendingDeleteRequests: PendingDeleteRequest[];
  teamRecords: any[];
  teamEmailMap: Record<string, string>;
  onApproveDelete: (requestId: string, attendanceId: string) => void;
  onRejectDelete: (requestId: string) => void;
}

const TeamAttendanceView = ({
  isMasterAdmin, selectedClientAccountId, onSelectClient,
  teamLoading, teamSummary, teamRecordsCount,
  selectedMonth, onExport, formatMinutes,
  pendingDeleteRequests, teamRecords, teamEmailMap,
  onApproveDelete, onRejectDelete,
}: TeamAttendanceViewProps) => {
  // Find attendance record info for a pending request
  const getRecordInfo = (attendanceId: string) => {
    const record = teamRecords.find((r: any) => r.id === attendanceId);
    if (!record) return null;
    const email = teamEmailMap[record.user_id] || record.user_id.slice(0, 8);
    return { ...record, email };
  };

  return (
    <div className="space-y-5">
      {isMasterAdmin && (
        <MasterAccountSelector
          title="Asistencia"
          variant="inline"
          selectedAccountId={selectedClientAccountId || undefined}
          onSelect={onSelectClient}
        />
      )}

      {isMasterAdmin && !selectedClientAccountId ? (
        <Card className="border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Building2 className="h-5 w-5" />
            </div>
            <p className="text-sm">Selecciona un cliente para ver la asistencia de su equipo</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Pending delete requests */}
          {pendingDeleteRequests.length > 0 && (
            <Card className="border border-amber-200 bg-amber-50/50 shadow-sm">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-100">{pendingDeleteRequests.length}</Badge>
                  Solicitudes de eliminación pendientes
                </h3>
                <div className="space-y-2">
                  {pendingDeleteRequests.map(req => {
                    const info = getRecordInfo(req.attendance_id);
                    return (
                      <div key={req.id} className="flex items-center justify-between bg-card rounded-lg border p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{info?.email || "Empleado"}</p>
                          <p className="text-xs text-muted-foreground">
                            {info ? `${info.work_date} · ${info.check_in ? format(new Date(info.check_in), "HH:mm") : "—"} → ${info.check_out ? format(new Date(info.check_out), "HH:mm") : "en curso"}` : "Registro no encontrado"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">Motivo: {req.reason}</p>
                        </div>
                        <div className="flex items-center gap-1.5 ml-3">
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/10"
                            onClick={() => onApproveDelete(req.id, req.attendance_id)}>
                            <Check className="h-3 w-3" /> Aprobar
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:bg-destructive/10"
                            onClick={() => onRejectDelete(req.id)}>
                            <X className="h-3 w-3" /> Rechazar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Header with export */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold capitalize">
              {format(selectedMonth, "MMMM yyyy", { locale: es })}
            </h3>
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={onExport} disabled={teamRecordsCount === 0}>
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </Button>
          </div>

          {teamLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : teamSummary.length === 0 ? (
            <Card className="border shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Users className="h-5 w-5" />
                </div>
                <p className="text-sm">No hay registros de asistencia para este mes</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Empleado</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Días</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Horas totales</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Media diaria</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamSummary.map(emp => (
                    <TableRow key={emp.userId}>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary">
                            {emp.email.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium">{emp.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-sm tabular-nums">{emp.days}</TableCell>
                      <TableCell className="py-3 text-sm font-medium tabular-nums">{formatMinutes(emp.worked)}</TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground tabular-nums">
                        {emp.days > 0 ? formatMinutes(Math.round(emp.worked / emp.days)) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default TeamAttendanceView;
