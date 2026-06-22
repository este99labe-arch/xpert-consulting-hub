import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Search, Loader2, Trash2, Users, Eye, UserCheck, UserX, X } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import PaginationControls from "@/components/shared/PaginationControls";
import { useServerPagination } from "@/hooks/use-server-pagination";
import CreateBusinessClientDialog from "@/components/clients/CreateBusinessClientDialog";
import DeleteClientDialog from "@/components/clients/DeleteClientDialog";

// Iniciales a partir del nombre del cliente (máx. 2 caracteres)
const getInitials = (name: string) => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Color de avatar determinista a partir del nombre, usando los charts del tema
const AVATAR_COLORS = [
  "bg-[hsl(var(--chart-1))]/15 text-[hsl(var(--chart-1))]",
  "bg-[hsl(var(--chart-2))]/15 text-[hsl(var(--chart-2))]",
  "bg-[hsl(var(--chart-3))]/15 text-[hsl(var(--chart-3))]",
  "bg-[hsl(var(--chart-4))]/15 text-[hsl(var(--chart-4))]",
  "bg-[hsl(var(--chart-5))]/15 text-[hsl(var(--chart-5))]",
];
const colorForName = (name: string) => {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

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

  // Lectura vía RPC con datos descifrados (GDPR Fase 1).
  // Se obtienen todas las filas y el filtrado/paginación se hace en cliente.
  const { data: allRows = [], isLoading } = useQuery({
    queryKey: ["business-clients-decrypted", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase.rpc("list_business_clients_decrypted", {
        _account_id: accountId,
      });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!accountId,
  });

  // Excluir el auto-cliente (la propia cuenta) de la lista mostrada
  const externalClients = useMemo(() => {
    return (allRows as any[]).filter((c: any) => {
      if (!account) return true;
      const isSelf = c.name === account.name && (c.tax_id === account.tax_id || c.tax_id === "PROPIA");
      return !isSelf;
    });
  }, [allRows, account]);

  // Estadísticas (sobre toda la cartera, independientes de los filtros activos)
  const stats = useMemo(() => {
    const total = externalClients.length;
    const active = externalClients.filter((c: any) => c.status === "ACTIVE").length;
    return { total, active, inactive: total - active };
  }, [externalClients]);

  // Filtrado por búsqueda y estado
  const filtered = useMemo(() => {
    let rows = externalClients;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      rows = rows.filter(
        (r: any) =>
          (r.name || "").toLowerCase().includes(q) ||
          (r.tax_id || "").toLowerCase().includes(q) ||
          (r.email || "").toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "ALL") rows = rows.filter((r: any) => r.status === statusFilter);
    return rows;
  }, [externalClients, debouncedSearch, statusFilter]);

  useEffect(() => {
    pagination.setTotalItems(filtered.length);
  }, [filtered.length]);

  const pageRows = filtered.slice(pagination.rangeFrom, pagination.rangeTo + 1);
  const hasFiltersApplied = debouncedSearch !== "" || statusFilter !== "ALL";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    pagination.resetPage();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statCards = [
    { key: "total", label: "Total clientes", value: stats.total, icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { key: "active", label: "Activos", value: stats.active, icon: UserCheck, color: "text-[hsl(var(--success))]", bg: "bg-[hsl(var(--success))]/10" },
    { key: "inactive", label: "Inactivos", value: stats.inactive, icon: UserX, color: "text-muted-foreground", bg: "bg-muted" },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gestiona tu cartera de clientes y su facturación
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="shadow-sm">
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Nuevo Cliente</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
        </div>

        {/* Tarjetas de estadísticas */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="grid gap-4 grid-cols-3"
        >
          {statCards.map((s) => (
            <Card key={s.key} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.bg}`}>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">{s.label}</p>
                  <p className={`text-2xl font-bold tracking-tight ${s.color}`}>{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Barra de búsqueda y filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, NIF/CIF o email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); pagination.resetPage(); }}
              className="pl-9 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(""); pagination.resetPage(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); pagination.resetPage(); }}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="ACTIVE">Activos</SelectItem>
              <SelectItem value="INACTIVE">Inactivos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {externalClients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No hay clientes"
            description="Crea tu primer cliente para comenzar a facturar"
            actionLabel="Nuevo Cliente"
            onAction={() => setShowCreate(true)}
          />
        ) : filtered.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="h-10 w-10 mb-3" />
              <p className="text-lg font-medium">Sin resultados</p>
              <p className="text-sm mt-1">No se encontraron clientes con los filtros aplicados</p>
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            </CardContent>
          </Card>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05 }}
          >
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Cliente</TableHead>
                        <TableHead className="hidden sm:table-cell">NIF/CIF</TableHead>
                        <TableHead className="hidden md:table-cell">Email</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="hidden lg:table-cell">Creado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageRows.map((client: any) => {
                        const isActive = client.status === "ACTIVE";
                        return (
                          <TableRow
                            key={client.id}
                            className="cursor-pointer group transition-colors"
                            onClick={() => navigate(`/app/clients/${client.id}`)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarFallback className={`text-xs font-semibold ${colorForName(client.name)}`}>
                                    {getInitials(client.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="font-medium truncate group-hover:text-primary transition-colors">
                                    {client.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground sm:hidden truncate">
                                    {client.tax_id}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell font-mono text-sm text-muted-foreground">
                              {client.tax_id}
                            </TableCell>
                            <TableCell className="text-muted-foreground hidden md:table-cell">
                              {client.email || "—"}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  isActive
                                    ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    isActive ? "bg-[hsl(var(--success))]" : "bg-muted-foreground"
                                  }`}
                                />
                                {isActive ? "Activo" : "Inactivo"}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground hidden lg:table-cell">
                              {new Date(client.created_at).toLocaleDateString("es-ES")}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => { e.stopPropagation(); navigate(`/app/clients/${client.id}`); }}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Ver detalle</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="hover:bg-destructive/10"
                                      onClick={(e) => { e.stopPropagation(); setDeletingClientId(client.id); }}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Eliminar</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="px-4 pb-4 pt-2">
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
          </motion.div>
        )}

        <CreateBusinessClientDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          accountId={accountId!}
          onSuccess={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ["business-clients-decrypted"] });
          }}
        />

        <DeleteClientDialog
          open={!!deletingClientId}
          clientId={deletingClientId}
          onClose={() => setDeletingClientId(null)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["business-clients-decrypted"] })}
        />
      </div>
    </TooltipProvider>
  );
};

export default AppClients;
