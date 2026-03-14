import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Activity } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import PaginationControls from "@/components/shared/PaginationControls";
import { usePagination } from "@/hooks/use-pagination";

const actionLabels: Record<string, string> = {
  CREATE: "Crear",
  UPDATE: "Actualizar",
  DELETE: "Eliminar",
};

const actionColors: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  UPDATE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const entityLabels: Record<string, string> = {
  invoice: "Factura",
  journal_entry: "Asiento",
  product: "Producto",
  stock_movement: "Mov. stock",
  purchase_order: "Orden compra",
  business_client: "Cliente",
  employee: "Empleado",
  leave_request: "Solicitud ausencia",
  attendance: "Asistencia",
  account_settings: "Configuración",
};

interface AuditActivityTabProps {
  accountId: string;
}

const AuditActivityTab = ({ accountId }: AuditActivityTabProps) => {
  const [entityFilter, setEntityFilter] = useState<string>("ALL");
  const [actionFilter, setActionFilter] = useState<string>("ALL");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", accountId, entityFilter, actionFilter],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(500);

      if (entityFilter !== "ALL") {
        query = query.eq("entity_type", entityFilter);
      }
      if (actionFilter !== "ALL") {
        query = query.eq("action", actionFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const pagination = usePagination(logs);

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Registro de Actividad
        </CardTitle>
        <CardDescription>Historial de acciones realizadas en el sistema</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Select value={entityFilter} onValueChange={v => { setEntityFilter(v); pagination.resetPage(); }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Tipo de entidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas las entidades</SelectItem>
              {Object.entries(entityLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={v => { setActionFilter(v); pagination.resetPage(); }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Acción" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas las acciones</SelectItem>
              {Object.entries(actionLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Sin registros de actividad</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead className="hidden md:table-cell">Detalles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedItems.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {format(new Date(log.created_at), "dd MMM yyyy HH:mm", { locale: es })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-xs ${actionColors[log.action] || ""}`}>
                        {actionLabels[log.action] || log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {entityLabels[log.entity_type] || log.entity_type}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-xs truncate">
                      {log.details && Object.keys(log.details).length > 0
                        ? Object.entries(log.details)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ")
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="px-4 pb-4">
              <PaginationControls
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                pageSize={pagination.pageSize}
                startIndex={pagination.startIndex}
                endIndex={pagination.endIndex}
                onPageChange={pagination.setCurrentPage}
                onPageSizeChange={pagination.setPageSize}
                pageSizeOptions={pagination.pageSizeOptions}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AuditActivityTab;
