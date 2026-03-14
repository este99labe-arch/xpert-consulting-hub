import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Loader2, Trash2, Users, AlertCircle, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import EmptyState from "@/components/shared/EmptyState";
import DeleteConfirmDialog from "@/components/shared/DeleteConfirmDialog";
import PaginationControls from "@/components/shared/PaginationControls";
import { usePagination } from "@/hooks/use-pagination";

const AppClients = () => {
  const { accountId } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);

  const { data: account } = useQuery({
    queryKey: ["my-account-info", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("id, name, tax_id").eq("id", accountId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["business-clients", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_clients")
        .select("*")
        .eq("account_id", accountId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const externalClients = clients.filter((c: any) => {
    if (!account) return true;
    const isSelf = c.name === account.name && (c.tax_id === account.tax_id || c.tax_id === "PROPIA");
    return !isSelf;
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("business_clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-clients"] });
      toast({ title: "Cliente eliminado" });
      setDeletingClientId(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = externalClients.filter((c: any) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.tax_id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pagination = usePagination(filtered);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Cliente
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

      {filtered.length === 0 ? (
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>NIF/CIF</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedItems.map((client: any) => (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/app/clients/${client.id}`)}
                  >
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>{client.tax_id}</TableCell>
                    <TableCell className="text-muted-foreground">{client.email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={client.status === "ACTIVE" ? "default" : "secondary"}>
                        {client.status === "ACTIVE" ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
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

      <CreateClientDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        accountId={accountId!}
        onSuccess={() => {
          setShowCreate(false);
          queryClient.invalidateQueries({ queryKey: ["business-clients"] });
        }}
      />

      <DeleteConfirmDialog
        open={!!deletingClientId}
        onConfirm={() => deletingClientId && deleteMutation.mutate(deletingClientId)}
        onCancel={() => setDeletingClientId(null)}
        title="¿Eliminar este cliente?"
        description="Se eliminará el cliente permanentemente. Esta acción no se puede deshacer."
        loading={deleteMutation.isPending}
      />
    </div>
  );
};

/* ---------- Create Dialog (simplified) ---------- */

const CreateClientDialog = ({
  open, onOpenChange, accountId, onSuccess,
}: { open: boolean; onOpenChange: (v: boolean) => void; accountId: string; onSuccess: () => void }) => {
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: insertError } = await supabase
        .from("business_clients")
        .insert({ name, tax_id: taxId, email: email || null, status: "ACTIVE", account_id: accountId });
      if (insertError) throw insertError;
      toast({ title: "Cliente creado" });
      setName(""); setTaxId(""); setEmail("");
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo Cliente</DialogTitle>
          <DialogDescription>Introduce los datos básicos. Podrás completar el resto desde la ficha del cliente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label>Nombre / Razón Social</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>NIF / CIF</Label>
            <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Crear Cliente
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AppClients;
