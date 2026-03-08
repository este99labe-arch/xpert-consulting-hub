import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, Loader2, Users, Building2 } from "lucide-react";
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
  <>
    {/* Master Admin client selector */}
    {isMasterAdmin && (
      <MasterAccountSelector
        title="Asistencia"
        variant="inline"
        selectedAccountId={selectedClientAccountId || undefined}
        onSelect={onSelectClient}
      />
    )}

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
          <Button variant="outline" size="sm" onClick={onExport} disabled={teamRecordsCount === 0}>
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
);

export default TeamAttendanceView;
