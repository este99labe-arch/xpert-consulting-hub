import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Loader2, KeyRound, UserPlus, AlertCircle, Users, Building2, ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const MasterSettings = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedAccountFilter, setSelectedAccountFilter] = useState("ALL");
  const [showResetDialog, setShowResetDialog] = useState<any>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // Create user form
  const [newEmail, setNewEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("MANAGER");
  const [newUserAccount, setNewUserAccount] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin_reset_password", {
        body: { action: "list_users" },
      });
      if (error) throw error;
      return data?.users || [];
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["master-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("id, name, type").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const clientAccounts = accounts.filter((a) => a.type === "CLIENT");

  const filteredUsers = selectedAccountFilter === "ALL"
    ? users
    : users.filter((u: any) => u.account_id === selectedAccountFilter);

  const handleResetPassword = async () => {
    if (!showResetDialog || !newPassword) return;
    setResetLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin_reset_password", {
        body: { action: "reset_password", target_user_id: showResetDialog.user_id, new_password: newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Contraseña actualizada", description: `Se ha reseteado la contraseña de ${showResetDialog.email}` });
      setShowResetDialog(null);
      setNewPassword("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setResetLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!newUserAccount) { setCreateError("Selecciona una cuenta"); return; }
    setCreateLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin_reset_password", {
        body: {
          action: "create_user",
          email: newEmail,
          new_password: newUserPassword,
          role_code: newUserRole,
          account_id: newUserAccount,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Usuario creado" });
      setShowCreateDialog(false);
      setNewEmail("");
      setNewUserPassword("");
      setNewUserRole("MANAGER");
      setNewUserAccount("");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeactivateUser = async (targetUserId: string) => {
    if (!confirm("¿Desactivar este usuario?")) return;
    try {
      const { data, error } = await supabase.functions.invoke("admin_reset_password", {
        body: { action: "deactivate_user", target_user_id: targetUserId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Usuario desactivado" });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configuración</h1>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" /> Usuarios
          </TabsTrigger>
          <TabsTrigger value="account" className="gap-2">
            <Building2 className="h-4 w-4" /> Cuenta
          </TabsTrigger>
        </TabsList>

        {/* USERS TAB */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <Select value={selectedAccountFilter} onValueChange={setSelectedAccountFilter}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Filtrar por cuenta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las cuentas</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setShowCreateDialog(true)}>
              <UserPlus className="h-4 w-4 mr-2" /> Nuevo Usuario
            </Button>
          </div>

          {usersLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {filteredUsers.map((u: any) => (
                <Card key={u.user_id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm truncate">{u.email}</span>
                    <Badge variant={u.is_active ? "default" : "outline"} className="shrink-0">
                      {u.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{u.account_name}</span>
                    <Badge variant={u.role === "MASTER_ADMIN" ? "default" : "secondary"}>
                      <ShieldCheck className="h-3 w-3 mr-1" />{u.role}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 pt-1 border-t">
                    <Button variant="outline" size="sm" onClick={() => setShowResetDialog(u)}>
                      <KeyRound className="h-3 w-3 mr-1" /> Reset
                    </Button>
                    {u.is_active && u.user_id !== user?.id && (
                      <Button variant="outline" size="sm" onClick={() => handleDeactivateUser(u.user_id)}>
                        Desactivar
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            {/* Desktop table */}
            <Card className="hidden md:block">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Cuenta</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u: any) => (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">{u.email}</TableCell>
                        <TableCell className="text-muted-foreground">{u.account_name}</TableCell>
                        <TableCell>
                          <Badge variant={u.role === "MASTER_ADMIN" ? "default" : "secondary"}>
                            <ShieldCheck className="h-3 w-3 mr-1" />{u.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.is_active ? "default" : "outline"}>
                            {u.is_active ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="outline" size="sm" onClick={() => setShowResetDialog(u)}>
                            <KeyRound className="h-3 w-3 mr-1" /> Reset
                          </Button>
                          {u.is_active && u.user_id !== user?.id && (
                            <Button variant="outline" size="sm" onClick={() => handleDeactivateUser(u.user_id)}>
                              Desactivar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            </>
          )}
        </TabsContent>

        {/* ACCOUNT TAB */}
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Cuenta Matriz</CardTitle>
              <CardDescription>Información de la cuenta XpertConsulting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Email administrador</Label>
                  <p className="text-sm font-medium">{user?.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Total cuentas cliente</Label>
                  <p className="text-sm font-medium">{clientAccounts.length}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Total usuarios</Label>
                  <p className="text-sm font-medium">{users.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reset Password Dialog */}
      <Dialog open={!!showResetDialog} onOpenChange={() => { setShowResetDialog(null); setNewPassword(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Resetear Contraseña</DialogTitle>
            <DialogDescription>Nueva contraseña para {showResetDialog?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nueva contraseña</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} />
            </div>
            <Button className="w-full" onClick={handleResetPassword} disabled={resetLoading || newPassword.length < 6}>
              {resetLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Resetear
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Usuario</DialogTitle>
            <DialogDescription>Crear un usuario y asignarlo a una cuenta</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            {createError && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" /> {createError}
              </div>
            )}
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Contraseña</Label>
              <Input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} required minLength={6} />
            </div>
            <div className="space-y-2">
              <Label>Cuenta</Label>
              <Select value={newUserAccount} onValueChange={setNewUserAccount}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MASTER_ADMIN">Master Admin</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="EMPLOYEE">Empleado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={createLoading}>
              {createLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Crear Usuario
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MasterSettings;
