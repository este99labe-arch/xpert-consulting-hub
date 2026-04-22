import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Loader2, Trash2, Users, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import EmptyState from "@/components/shared/EmptyState";
import PaginationControls from "@/components/shared/PaginationControls";
import { useServerPagination } from "@/hooks/use-server-pagination";
import CreateBusinessClientDialog from "@/components/clients/CreateBusinessClientDialog";
import DeleteClientDialog from "@/components/clients/DeleteClientDialog";

const AppClients = () => {
  const { accountId } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Auto-open create dialog from dashboard quick actions
  useEffect(() => {
    const state = location.state as any;
    if (state?.openCreate) {
      setShowCreate(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const { data: account } = useQuery({
    queryKey: ["my-account-info", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("id, name, tax_id").eq("id", accountId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  const pagination = useServerPagination();

  // Server-side paginated + filtered query
  const { data: clientResult, isLoading } = useQuery({
    queryKey: ["business-clients", accountId, pagination.currentPage, pagination.pageSize, debouncedSearch, statusFilter],
    queryFn: async () => {
      if (!accountId) return { data: [], count: 0 };
      let query = supabase
        .from("business_clients")
        .select("*", { count: "exact" })
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });

      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,tax_id.ilike.%${debouncedSearch}%`);
      }
      if (statusFilter !== "ALL") query = query.eq("status", statusFilter);

      query = query.range(pagination.rangeFrom, pagination.rangeTo);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    enabled: !!accountId,
  });

  useEffect(() => {
    if (clientResult) pagination.setTotalItems(clientResult.count);
  }, [clientResult?.count]);

  const clients = clientResult?.data || [];

  // Filter out self-client from display
  const externalClients = clients.filter((c: any) => {
    if (!account) return true;
    const isSelf = c.name === account.name && (c.tax_id === account.tax_id || c.tax_id === "PROPIA");
    return !isSelf;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Nuevo Cliente</span>
          <span className="sm:hidden">Nuevo</span>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o NIF/CIF..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); pagination.resetPage(); }}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); pagination.resetPage(); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="ACTIVE">Activos</SelectItem>
            <SelectItem value="INACTIVE">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {externalClients.length === 0 && pagination.totalItems === 0 ? (
        <EmptyState
          icon={Users}
          title="No hay clientes"
          description="Crea tu primer cliente para comenzar a facturar"
          actionLabel="Nuevo Cliente"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden sm:table-cell">NIF/CIF</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden lg:table-cell">Creado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {externalClients.map((client: any) => (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/app/clients/${client.id}`)}
                  >
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">{client.tax_id}</TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">{client.email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={client.status === "ACTIVE" ? "default" : "secondary"}>
                        {client.status === "ACTIVE" ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell">
                      {new Date(client.created_at).toLocaleDateString("es-ES")}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); navigate(`/app/clients/${client.id}`); }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); setDeletingClientId(client.id); }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
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
          </CardContent>
        </Card>
      )}

      <CreateBusinessClientDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        accountId={accountId!}
        onSuccess={() => {
          setShowCreate(false);
          queryClient.invalidateQueries({ queryKey: ["business-clients"] });
        }}
      />

      <DeleteClientDialog
        open={!!deletingClientId}
        clientId={deletingClientId}
        onClose={() => setDeletingClientId(null)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["business-clients"] })}
      />
    </div>
  );
};

export default AppClients;
