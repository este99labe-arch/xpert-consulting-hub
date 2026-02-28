import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, KeyRound, UserPlus, AlertCircle, Settings, Users, CalendarDays, Clock, ShieldCheck, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const WEEKDAYS = [
  { code: "MON", label: "Lunes" },
  { code: "TUE", label: "Martes" },
  { code: "WED", label: "Miércoles" },
  { code: "THU", label: "Jueves" },
  { code: "FRI", label: "Viernes" },
  { code: "SAT", label: "Sábado" },
  { code: "SUN", label: "Domingo" },
];

const AppSettings = () => {
  const { user, accountId, role } = useAuth();
  const queryClient = useQueryClient();
  const isManager = role === "MANAGER";

  // Settings state
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("18:00");
  const [workDays, setWorkDays] = useState<string[]>(["MON", "TUE", "WED", "THU", "FRI"]);
  const [vacationDays, setVacationDays] = useState(22);
  const [savingSettings, setSavingSettings] = useState(false);

  // User management
  const [showResetDialog, setShowResetDialog] = useState<any>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  // Fetch account settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["account-settings", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_settings")
        .select("*")
        .eq("account_id", accountId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  // Fetch account info
  const { data: account } = useQuery({
    queryKey: ["my-account", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("id", accountId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  // Fetch users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["account-users", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin_reset_password", {
        body: { action: "list_users", account_id: accountId },
      });
      if (error) throw error;
      return data?.users || [];
    },
    enabled: !!accountId && isManager,
  });

  // Sync settings to state
  useEffect(() => {
    if (settings) {
      setWorkStart(settings.work_start_time?.slice(0, 5) || "09:00");
      setWorkEnd(settings.work_end_time?.slice(0, 5) || "18:00");
      setWorkDays(settings.work_days || ["MON", "TUE", "WED", "THU", "FRI"]);
      setVacationDays(settings.vacation_days_per_year ?? 22);
    }
  }, [settings]);

  const toggleDay = (code: string) => {
    setWorkDays((prev) =>
      prev.includes(code) ? prev.filter((d) => d !== code) : [...prev, code]
    );
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      if (settings) {
        const { error } = await supabase
          .from("account_settings")
          .update({
            work_start_time: workStart,
            work_end_time: workEnd,
            work_days: workDays,
            vacation_days_per_year: vacationDays,
            updated_at: new Date().toISOString(),
          })
          .eq("account_id", accountId!);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("account_settings")
          .insert({
            account_id: accountId!,
            work_start_time: workStart,
            work_end_time: workEnd,
            work_days: workDays,
            vacation_days_per_year: vacationDays,
          });
        if (error) throw error;
      }
      toast({ title: "Configuración guardada" });
      queryClient.invalidateQueries({ queryKey: ["account-settings"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetPassword = async () => {
    if (!showResetDialog || !newPassword) return;
    setResetLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin_reset_password", {
        body: { action: "reset_password", target_user_id: showResetDialog.user_id, new_password: newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Contraseña actualizada" });
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
    setCreateLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin_reset_password", {
        body: {
          action: "create_user",
          email: newEmail,
          new_password: newUserPassword,
          role_code: "EMPLOYEE",
          account_id: accountId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Empleado creado" });
      setShowCreateDialog(false);
      setNewEmail("");
      setNewUserPassword("");
      queryClient.invalidateQueries({ queryKey: ["account-users"] });
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
      queryClient.invalidateQueries({ queryKey: ["account-users"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configuración</h1>

      <Tabs defaultValue="company" className="space-y-4">
        <TabsList>
          <TabsTrigger value="company" className="gap-2">
            <Settings className="h-4 w-4" /> Empresa
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-2">
            <Clock className="h-4 w-4" /> Horario
          </TabsTrigger>
          {isManager && (
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" /> Usuarios
            </TabsTrigger>
          )}
        </TabsList>

        {/* COMPANY TAB */}
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>Datos de la empresa</CardTitle>
              <CardDescription>Información general de tu cuenta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Nombre</Label>
                  <p className="text-sm font-medium">{account?.name || "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Estado</Label>
                  <p className="text-sm">
                    <Badge variant={account?.is_active ? "default" : "secondary"}>
                      {account?.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Email de gestión</Label>
                  <p className="text-sm font-medium">{user?.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Creado</Label>
                  <p className="text-sm font-medium">
                    {account?.created_at ? new Date(account.created_at).toLocaleDateString("es-ES") : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SCHEDULE TAB */}
        <TabsContent value="schedule">
          {settingsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Horario Laboral</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Hora inicio</Label>
                      <Input type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} disabled={!isManager} />
                    </div>
                    <div className="space-y-2">
                      <Label>Hora fin</Label>
                      <Input type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} disabled={!isManager} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Días laborales</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {WEEKDAYS.map((day) => (
                        <label key={day.code} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent/50 transition-colors">
                          <Checkbox
                            checked={workDays.includes(day.code)}
                            onCheckedChange={() => isManager && toggleDay(day.code)}
                            disabled={!isManager}
                          />
                          <span className="text-sm">{day.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Vacaciones</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Días de vacaciones al año</Label>
                    <Input
                      type="number"
                      min={0}
                      max={365}
                      value={vacationDays}
                      onChange={(e) => setVacationDays(parseInt(e.target.value) || 0)}
                      disabled={!isManager}
                    />
                  </div>
                  {isManager && (
                    <Button onClick={handleSaveSettings} disabled={savingSettings} className="w-full">
                      {savingSettings ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Guardar Configuración
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* USERS TAB (Manager only) */}
        {isManager && (
          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowCreateDialog(true)}>
                <UserPlus className="h-4 w-4 mr-2" /> Nuevo Empleado
              </Button>
            </div>

            {usersLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u: any) => (
                        <TableRow key={u.user_id}>
                          <TableCell className="font-medium">{u.email}</TableCell>
                          <TableCell>
                            <Badge variant={u.role === "MANAGER" ? "default" : "secondary"}>
                              <ShieldCheck className="h-3 w-3 mr-1" />
                              {u.role === "MANAGER" ? "Manager" : "Empleado"}
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
            )}
          </TabsContent>
        )}
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

      {/* Create Employee Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Empleado</DialogTitle>
            <DialogDescription>Crea un nuevo usuario empleado para tu cuenta</DialogDescription>
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
            <Button type="submit" className="w-full" disabled={createLoading}>
              {createLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Crear Empleado
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppSettings;
