import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, Loader2, Users, Building2, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import MasterAccountSelector from "@/components/shared/MasterAccountSelector";

interface TeamMember {
  userId: string;
  email: string;
  worked: number;
  days: number;
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
}

const TeamAttendanceView = ({
  isMasterAdmin, selectedClientAccountId, onSelectClient,
  teamLoading, teamSummary, teamRecordsCount,
  selectedMonth, onExport, formatMinutes,
}: TeamAttendanceViewProps) => (
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

export default TeamAttendanceView;
