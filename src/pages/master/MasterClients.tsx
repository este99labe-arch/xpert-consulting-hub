import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import CreateClientForm from "@/components/master/CreateClientForm";
import ModuleManager from "@/components/master/ModuleManager";

const MasterClients = () => {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteMode, setDeleteMode] = useState<"account_only" | "all">("account_only");
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading, error } = useQuery({
    queryKey: ["master-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("type", "CLIENT")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("accounts")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["master-clients"] }),
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete_client_account", {
        body: {
          account_id: deleteTarget.id,
          delete_all: deleteMode === "all",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message || "Cliente eliminado correctamente");
      queryClient.invalidateQueries({ queryKey: ["master-clients"] });
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error("Error al eliminar: " + (err.message || "Error desconocido"));
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-destructive/10 p-4 text-destructive">
        Error al cargar clientes: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestión de Cuentas</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Cuenta
        </Button>
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-lg">No hay cuentas registradas</p>
            <p className="text-sm">Crea tu primera cuenta para comenzar</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>
                      <Badge variant={client.is_active ? "default" : "secondary"}>
                        {client.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(client.created_at).toLocaleDateString("es-ES")}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={client.is_active}
                        onCheckedChange={(checked) =>
                          toggleActive.mutate({ id: client.id, is_active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedAccountId(client.id)}
                        >
                          Gestionar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 border-destructive/30"
                          onClick={() => {
                            setDeleteTarget({ id: client.id, name: client.name });
                            setDeleteMode("account_only");
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Nueva Cuenta</DialogTitle>
            <DialogDescription>Introduce los datos de la nueva cuenta</DialogDescription>
          </DialogHeader>
          <CreateClientForm onSuccess={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ["master-clients"] });
          }} />
        </DialogContent>
      </Dialog>

      {/* Modules dialog */}
      <Dialog open={!!selectedAccountId} onOpenChange={() => setSelectedAccountId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gestionar Módulos</DialogTitle>
            <DialogDescription>Activa o desactiva módulos para esta cuenta</DialogDescription>
          </DialogHeader>
          {selectedAccountId && <ModuleManager accountId={selectedAccountId} />}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar cuenta: {deleteTarget?.name}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>¿Qué deseas eliminar? Esta acción no se puede deshacer.</p>
              <RadioGroup
                value={deleteMode}
                onValueChange={(v) => setDeleteMode(v as "account_only" | "all")}
                className="mt-4 space-y-3"
              >
                <div className="flex items-start space-x-3 rounded-md border p-3">
                  <RadioGroupItem value="account_only" id="del-account" className="mt-0.5" />
                  <Label htmlFor="del-account" className="cursor-pointer">
                    <span className="font-medium">Solo la cuenta</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Elimina la cuenta, sus módulos y usuarios asociados. Los datos (facturas, asientos, etc.) se perderán si no están vinculados a otra cuenta.
                    </p>
                  </Label>
                </div>
                <div className="flex items-start space-x-3 rounded-md border border-destructive/30 p-3 bg-destructive/5">
                  <RadioGroupItem value="all" id="del-all" className="mt-0.5" />
                  <Label htmlFor="del-all" className="cursor-pointer">
                    <span className="font-medium text-destructive">Cuenta y todos los datos</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Elimina la cuenta y TODA la información relacionada: facturas, gastos, asientos contables, clientes, productos, inventario, documentos, registros de asistencia, empleados, recordatorios, webhooks, etc.
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MasterClients;
