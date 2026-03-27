import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Loader2, UserCheck, UserX } from "lucide-react";
import PaginationControls from "@/components/shared/PaginationControls";
import { usePagination } from "@/hooks/use-pagination";

const EmployeesTab = () => {
  const { accountId, role, user } = useAuth();
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";
  const [search, setSearch] = useState("");

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

  const pagination = usePagination(filtered);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por email o rol..." value={search} onChange={(e) => { setSearch(e.target.value); pagination.resetPage(); }} className="pl-9" />
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">No se encontraron empleados</Card>
        ) : (
          pagination.paginatedItems.map((emp: any) => (
            <Card key={emp.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm truncate">{emailMap.get(emp.user_id) || emp.user_id}</span>
                <Badge variant="outline">{(emp as any).roles?.code || "—"}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                {emp.is_active ? (
                  <span className="flex items-center gap-1"><UserCheck className="h-4 w-4 text-primary" />Activo</span>
                ) : (
                  <span className="flex items-center gap-1 text-muted-foreground"><UserX className="h-4 w-4" />Inactivo</span>
                )}
                <span className="text-muted-foreground text-xs">{new Date(emp.created_at).toLocaleDateString("es-ES")}</span>
              </div>
            </Card>
          ))
        )}
        {filtered.length > 0 && (
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
                pagination.paginatedItems.map((emp: any) => (
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
          {filtered.length > 0 && (
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
    </div>
  );
};

export default EmployeesTab;
