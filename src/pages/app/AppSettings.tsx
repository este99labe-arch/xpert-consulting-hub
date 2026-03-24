import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Loader2, KeyRound, UserPlus, AlertCircle, Settings, Users, CalendarDays,
  Clock, ShieldCheck, Save, User, Lock, Unlock, Check, X, Mail, Activity, Key, Webhook, MessageSquare, ShieldAlert,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import AuditActivityTab from "@/components/settings/AuditActivityTab";
import ApiKeysTab from "@/components/settings/ApiKeysTab";
import WebhooksTab from "@/components/settings/WebhooksTab";
import WhatsAppConfigTab from "@/components/settings/WhatsAppConfigTab";
import CreateEmployeeDialog from "@/components/hr/CreateEmployeeDialog";

const WEEKDAYS = [
  { code: "MON", label: "Lunes" },
  { code: "TUE", label: "Martes" },
  { code: "WED", label: "Miércoles" },
  { code: "THU", label: "Jueves" },
  { code: "FRI", label: "Viernes" },
  { code: "SAT", label: "Sábado" },
  { code: "SUN", label: "Domingo" },
];

const PROFILE_FIELD_LABELS: Record<string, string> = {
  first_name: "Nombre",
  last_name: "Apellidos",
  dni: "DNI/NIE",
  phone: "Teléfono",
  date_of_birth: "Fecha de nacimiento",
  address: "Dirección",
  postal_code: "Código postal",
  city: "Ciudad",
  department: "Departamento",
  position: "Puesto",
  social_security_number: "Nº Seguridad Social",
  start_date: "Fecha de inicio",
};

// Sensitive fields require unlock + confirmation
const SENSITIVE_PROFILE_FIELDS = new Set(["dni", "social_security_number"]);
// Manager-only fields: employees cannot edit these at all
const MANAGER_ONLY_FIELDS = new Set(["department", "position", "start_date"]);

// ─── EMPRESA TAB ─────────────────────────────────────────
const CompanyTab = ({ accountId, isManager }: { accountId: string; isManager: boolean }) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ tax_id: "", phone: "", email: "", address: "", city: "", postal_code: "" });

  const { data: account } = useQuery({
    queryKey: ["my-account", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").eq("id", accountId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  useEffect(() => {
    if (account) {
      setForm({
        tax_id: (account as any).tax_id || "",
        phone: (account as any).phone || "",
        email: (account as any).email || "",
        address: (account as any).address || "",
        city: (account as any).city || "",
        postal_code: (account as any).postal_code || "",
      });
    }
  }, [account]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("accounts").update({
        tax_id: form.tax_id || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        city: form.city || null,
        postal_code: form.postal_code || null,
      } as any).eq("id", accountId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["my-account"] });
      toast({ title: "Datos fiscales actualizados" });
      setEditing(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { key: "name", label: "Nombre", value: account?.name || "—", readonly: true },
    { key: "tax_id", label: "NIF/CIF", value: form.tax_id },
    { key: "phone", label: "Teléfono", value: form.phone },
    { key: "email", label: "Email", value: form.email },
    { key: "address", label: "Dirección fiscal", value: form.address },
    { key: "city", label: "Ciudad", value: form.city },
    { key: "postal_code", label: "Código postal", value: form.postal_code },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Datos de la empresa</CardTitle>
          <CardDescription>Información general y datos fiscales</CardDescription>
        </div>
        {isManager && !editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Editar</Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-muted-foreground text-xs">{f.label}</Label>
              {editing && !f.readonly ? (
                <Input
                  value={f.value}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.label}
                />
              ) : (
                <p className="text-sm font-medium">{f.value || "—"}</p>
              )}
            </div>
          ))}
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Estado</Label>
            <div>
              <Badge variant={account?.is_active ? "default" : "secondary"}>
                {account?.is_active ? "Activo" : "Inactivo"}
              </Badge>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Fecha de creación</Label>
            <p className="text-sm font-medium">
              {account?.created_at ? new Date(account.created_at).toLocaleDateString("es-ES") : "—"}
            </p>
          </div>
        </div>
        {editing && (
          <div className="flex gap-2 mt-6">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Guardar
            </Button>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ─── MI PERFIL TAB ───────────────────────────────────────
const ProfileTab = ({ userId, accountId, isManager }: { userId: string; accountId: string; isManager: boolean }) => {
  const queryClient = useQueryClient();
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [unlockedSensitive, setUnlockedSensitive] = useState<Set<string>>(new Set());
  const [confirmingField, setConfirmingField] = useState<string | null>(null);
  const [confirmValue, setConfirmValue] = useState("");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ["my-change-requests", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_change_requests")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "PENDING");
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && !isManager,
  });

  const doSave = async (fieldName: string, value: string) => {
    setSaving(true);
    try {
      if (isManager) {
        const { error } = await supabase
          .from("employee_profiles")
          .update({ [fieldName]: value || null, updated_at: new Date().toISOString() })
          .eq("user_id", userId);
        if (error) throw error;
        toast({ title: "Perfil actualizado" });
        queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      } else {
        const { error } = await supabase.from("profile_change_requests").insert({
          user_id: userId,
          account_id: accountId,
          field_name: fieldName,
          old_value: profile?.[fieldName as keyof typeof profile]?.toString() || null,
          new_value: value,
        });
        if (error) throw error;
        toast({ title: "Solicitud enviada", description: "Tu cambio será revisado por un administrador." });
        queryClient.invalidateQueries({ queryKey: ["my-change-requests"] });
      }
      setEditField(null);
      setEditValue("");
      setUnlockedSensitive((prev) => { const n = new Set(prev); n.delete(fieldName); return n; });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveField = (fieldName: string) => {
    if (SENSITIVE_PROFILE_FIELDS.has(fieldName)) {
      setConfirmingField(fieldName);
      setConfirmValue(editValue);
    } else {
      doSave(fieldName, editValue);
    }
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (!profile) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <User className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No se ha encontrado un perfil de empleado asociado a tu cuenta.</p>
        </CardContent>
      </Card>
    );
  }

  const fields = Object.keys(PROFILE_FIELD_LABELS);
  const pendingFieldSet = new Set(pendingRequests.map((r: any) => r.field_name));

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Mi Perfil</CardTitle>
          <CardDescription>
            {isManager
              ? "Puedes editar directamente tu información personal."
              : "Los cambios serán revisados por tu administrador antes de aplicarse. Algunos campos solo pueden ser editados por un administrador."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((field) => {
              const value = profile[field as keyof typeof profile];
              const hasPending = pendingFieldSet.has(field);
              const isEditing = editField === field;
              const isSensitive = SENSITIVE_PROFILE_FIELDS.has(field);
              const isManagerOnly = MANAGER_ONLY_FIELDS.has(field);
              const isSensitiveLocked = isSensitive && !unlockedSensitive.has(field);

              // Employees cannot edit manager-only fields
              const canEdit = isManager || !isManagerOnly;

              return (
                <div key={field} className="space-y-1 p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground text-xs flex items-center gap-1">
                      {PROFILE_FIELD_LABELS[field]}
                      {isSensitive && <ShieldAlert className="h-3 w-3 text-amber-500" />}
                      {isManagerOnly && !isManager && <Lock className="h-3 w-3 text-muted-foreground" />}
                    </Label>
                    <div className="flex items-center gap-1">
                      {hasPending && <Badge variant="outline" className="text-xs">Pendiente</Badge>}
                      {isSensitive && canEdit && !isEditing && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            setUnlockedSensitive((prev) => {
                              const n = new Set(prev);
                              if (n.has(field)) n.delete(field); else n.add(field);
                              return n;
                            });
                          }}
                          title={isSensitiveLocked ? "Desbloquear campo" : "Bloquear campo"}
                        >
                          {isSensitiveLocked ? (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <Unlock className="h-3 w-3 text-amber-500" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="flex gap-2 items-center">
                      <Input
                        type={field.includes("date") ? "date" : "text"}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-8 text-sm"
                        autoFocus
                      />
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleSaveField(field)} disabled={saving}>
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setEditField(null); setEditValue(""); }}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <p
                      className={`text-sm font-medium transition-colors ${
                        canEdit && !hasPending && !(isSensitive && isSensitiveLocked)
                          ? "cursor-pointer hover:text-primary"
                          : "cursor-default"
                      } ${hasPending ? "opacity-60" : ""}`}
                      onClick={() => {
                        if (!hasPending && canEdit && !(isSensitive && isSensitiveLocked)) {
                          setEditField(field);
                          setEditValue(value?.toString() || "");
                        }
                      }}
                    >
                      {value?.toString() || <span className="text-muted-foreground italic">Sin datos</span>}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmingField} onOpenChange={(v) => !v && setConfirmingField(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Confirmar cambio sensible
            </AlertDialogTitle>
            <AlertDialogDescription>
              Estás modificando un dato sensible ({confirmingField ? PROFILE_FIELD_LABELS[confirmingField] : ""}). ¿Estás seguro de que deseas guardar este cambio?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmingField(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (confirmingField) {
                doSave(confirmingField, confirmValue);
                setConfirmingField(null);
              }
            }}>
              Confirmar y Guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};



// ─── HORARIO TAB ─────────────────────────────────────────
const ScheduleTab = ({ accountId, isManager }: { accountId: string; isManager: boolean }) => {
  const queryClient = useQueryClient();
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("18:00");
  const [workDays, setWorkDays] = useState<string[]>(["MON", "TUE", "WED", "THU", "FRI"]);
  const [vacationDays, setVacationDays] = useState(22);
  const [saving, setSaving] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["account-settings", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_settings").select("*").eq("account_id", accountId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  useEffect(() => {
    if (settings) {
      setWorkStart(settings.work_start_time?.slice(0, 5) || "09:00");
      setWorkEnd(settings.work_end_time?.slice(0, 5) || "18:00");
      setWorkDays(settings.work_days || ["MON", "TUE", "WED", "THU", "FRI"]);
      setVacationDays(settings.vacation_days_per_year ?? 22);
    }
  }, [settings]);

  const toggleDay = (code: string) => {
    setWorkDays((prev) => prev.includes(code) ? prev.filter((d) => d !== code) : [...prev, code]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        work_start_time: workStart,
        work_end_time: workEnd,
        work_days: workDays,
        vacation_days_per_year: vacationDays,
        updated_at: new Date().toISOString(),
      };
      if (settings) {
        const { error } = await supabase.from("account_settings").update(payload).eq("account_id", accountId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("account_settings").insert({ account_id: accountId, ...payload });
        if (error) throw error;
      }
      toast({ title: "Configuración guardada" });
      queryClient.invalidateQueries({ queryKey: ["account-settings"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
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
            <Input type="number" min={0} max={365} value={vacationDays}
              onChange={(e) => setVacationDays(parseInt(e.target.value) || 0)} disabled={!isManager} />
          </div>
          {isManager && (
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar Configuración
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ─── SEGURIDAD TAB ───────────────────────────────────────
const SecurityTab = ({ userId, accountId, isManager }: { userId: string; accountId: string; isManager: boolean }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingOwn, setChangingOwn] = useState(false);

  // Force reset state (manager)
  const [forceTarget, setForceTarget] = useState<any>(null);
  const [forcePassword, setForcePassword] = useState("");
  const [forceLoading, setForceLoading] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["account-users-security", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin_reset_password", {
        body: { action: "list_users", account_id: accountId },
      });
      if (error) throw error;
      return data?.users || [];
    },
    enabled: !!accountId && isManager,
  });

  const handleChangeOwnPassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Las contraseñas no coinciden", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "La contraseña debe tener al menos 6 caracteres", variant: "destructive" });
      return;
    }
    setChangingOwn(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin_reset_password", {
        body: { action: "change_own_password", current_password: currentPassword, new_password: newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Contraseña actualizada correctamente" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setChangingOwn(false);
    }
  };

  const handleForceReset = async () => {
    if (!forceTarget || forcePassword.length < 6) return;
    setForceLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin_reset_password", {
        body: { action: "force_reset_password", target_user_id: forceTarget.user_id, new_password: forcePassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Contraseña reseteada", description: `Se ha enviado un email a ${forceTarget.email} con las nuevas credenciales.` });
      setForceTarget(null);
      setForcePassword("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setForceLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Own password change */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> Cambiar mi contraseña</CardTitle>
          <CardDescription>Introduce tu contraseña actual para verificar tu identidad.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label>Contraseña actual</Label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Nueva contraseña</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Confirmar nueva contraseña</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <Button
            onClick={handleChangeOwnPassword}
            disabled={changingOwn || !currentPassword || newPassword.length < 6 || newPassword !== confirmPassword}
          >
            {changingOwn && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Cambiar contraseña
          </Button>
        </CardContent>
      </Card>

      {/* Manager force reset */}
      {isManager && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Reseteo forzado de contraseña</CardTitle>
            <CardDescription>
              Restablece la contraseña de un empleado. Recibirá un email con las nuevas credenciales.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.filter((u: any) => u.user_id !== userId && u.is_active).map((u: any) => (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{u.role === "MANAGER" ? "Manager" : "Empleado"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => { setForceTarget(u); setForcePassword(""); }}>
                        <KeyRound className="h-3 w-3 mr-1" /> Resetear
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Force reset dialog */}
      <Dialog open={!!forceTarget} onOpenChange={() => { setForceTarget(null); setForcePassword(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Resetear contraseña</DialogTitle>
            <DialogDescription>
              Nueva contraseña para <strong>{forceTarget?.email}</strong>. Se enviará un email con las credenciales.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nueva contraseña</Label>
              <Input type="password" value={forcePassword} onChange={(e) => setForcePassword(e.target.value)} minLength={6} />
            </div>
            <Button className="w-full" onClick={handleForceReset} disabled={forceLoading || forcePassword.length < 6}>
              {forceLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
              Resetear y enviar email
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── USUARIOS TAB ────────────────────────────────────────
const UsersTab = ({ userId, accountId }: { userId: string; accountId: string }) => {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);


  const { data: users = [], isLoading } = useQuery({
    queryKey: ["account-users", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin_reset_password", {
        body: { action: "list_users", account_id: accountId },
      });
      if (error) throw error;
      return data?.users || [];
    },
    enabled: !!accountId,
  });

  // Pending profile change requests (manager view)
  const { data: pendingRequests = [] } = useQuery({
    queryKey: ["pending-change-requests", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_change_requests")
        .select("*")
        .eq("account_id", accountId)
        .eq("status", "PENDING");
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });



  const handleDeactivateUser = async (targetUserId: string) => {
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

  const handleApproveRequest = async (request: any) => {
    try {
      // Update the profile field
      const { error: updateError } = await supabase
        .from("employee_profiles")
        .update({ [request.field_name]: request.new_value, updated_at: new Date().toISOString() })
        .eq("user_id", request.user_id)
        .eq("account_id", accountId);
      if (updateError) throw updateError;

      // Mark request as approved
      const { error } = await supabase
        .from("profile_change_requests")
        .update({ status: "APPROVED", reviewed_by: userId, reviewed_at: new Date().toISOString() })
        .eq("id", request.id);
      if (error) throw error;

      toast({ title: "Cambio aprobado" });
      queryClient.invalidateQueries({ queryKey: ["pending-change-requests"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("profile_change_requests")
        .update({ status: "REJECTED", reviewed_by: userId, reviewed_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw error;
      toast({ title: "Cambio rechazado" });
      queryClient.invalidateQueries({ queryKey: ["pending-change-requests"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Build a map of user_id -> email from users list
  const emailMap = new Map(users.map((u: any) => [u.user_id, u.email]));

  return (
    <div className="space-y-6">
      {/* Pending change requests */}
      {pendingRequests.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Solicitudes de cambio pendientes
              <Badge variant="outline" className="ml-2">{pendingRequests.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Campo</TableHead>
                  <TableHead>Valor anterior</TableHead>
                  <TableHead>Nuevo valor</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((req: any) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium text-sm">{emailMap.get(req.user_id) || req.user_id.slice(0, 8)}</TableCell>
                    <TableCell>{PROFILE_FIELD_LABELS[req.field_name] || req.field_name}</TableCell>
                    <TableCell className="text-muted-foreground">{req.old_value || "—"}</TableCell>
                    <TableCell className="font-medium">{req.new_value}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="default" onClick={() => handleApproveRequest(req)}>
                        <Check className="h-3 w-3 mr-1" /> Aprobar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleRejectRequest(req.id)}>
                        <X className="h-3 w-3 mr-1" /> Rechazar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* User list */}
      <div className="flex justify-end">
        <Button onClick={() => setShowCreateDialog(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> Dar de Alta
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
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
                    <TableCell className="text-right">
                      {u.is_active && u.user_id !== userId && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">Desactivar</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Desactivar usuario?</AlertDialogTitle>
                              <AlertDialogDescription>
                                El usuario <strong>{u.email}</strong> no podrá acceder al sistema.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeactivateUser(u.user_id)}>Desactivar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create employee dialog - full onboarding form */}
      <CreateEmployeeDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
    </div>
  );
};

// ─── MAIN SETTINGS PAGE ──────────────────────────────────
const AppSettings = () => {
  const { user, accountId, role } = useAuth();
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";

  // Count pending requests for badge
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["pending-requests-count", accountId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profile_change_requests")
        .select("*", { count: "exact", head: true })
        .eq("account_id", accountId!)
        .eq("status", "PENDING");
      if (error) throw error;
      return count || 0;
    },
    enabled: !!accountId && isManager,
  });

  if (!user || !accountId) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configuración</h1>

      <Tabs defaultValue="company" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="company" className="gap-1">
            <Settings className="h-4 w-4" /> <span className="hidden md:inline">Empresa</span>
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-1">
            <User className="h-4 w-4" /> <span className="hidden md:inline">Perfil</span>
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-1">
            <Clock className="h-4 w-4" /> <span className="hidden md:inline">Horario</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1">
            <Lock className="h-4 w-4" /> <span className="hidden md:inline">Seguridad</span>
          </TabsTrigger>
          {isManager && (
            <TabsTrigger value="users" className="gap-1">
              <Users className="h-4 w-4" /> <span className="hidden md:inline">Usuarios</span>
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs rounded-full">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {isManager && (
            <TabsTrigger value="activity" className="gap-1">
              <Activity className="h-4 w-4" /> <span className="hidden lg:inline">Actividad</span>
            </TabsTrigger>
          )}
          {isManager && (
            <TabsTrigger value="api" className="gap-1">
              <Key className="h-4 w-4" /> <span className="hidden lg:inline">API</span>
            </TabsTrigger>
          )}
          {isManager && (
            <TabsTrigger value="webhooks" className="gap-1">
              <Webhook className="h-4 w-4" /> <span className="hidden lg:inline">Webhooks</span>
            </TabsTrigger>
          )}
          {isManager && (
            <TabsTrigger value="whatsapp" className="gap-1">
              <MessageSquare className="h-4 w-4" /> <span className="hidden lg:inline">WhatsApp</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="company">
          <CompanyTab accountId={accountId} isManager={isManager} />
        </TabsContent>

        <TabsContent value="profile">
          <ProfileTab userId={user.id} accountId={accountId} isManager={isManager} />
        </TabsContent>

        <TabsContent value="schedule">
          <ScheduleTab accountId={accountId} isManager={isManager} />
        </TabsContent>

        <TabsContent value="security">
          <SecurityTab userId={user.id} accountId={accountId} isManager={isManager} />
        </TabsContent>

        {isManager && (
          <TabsContent value="users">
            <UsersTab userId={user.id} accountId={accountId} />
          </TabsContent>
        )}
        {isManager && (
          <TabsContent value="activity">
            <AuditActivityTab accountId={accountId} />
          </TabsContent>
        )}
        {isManager && (
          <TabsContent value="api">
            <ApiKeysTab accountId={accountId} isManager={isManager} />
          </TabsContent>
        )}
        {isManager && (
          <TabsContent value="webhooks">
            <WebhooksTab accountId={accountId} isManager={isManager} />
          </TabsContent>
        )}
        {isManager && (
          <TabsContent value="whatsapp">
            <WhatsAppConfigTab accountId={accountId} isManager={isManager} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default AppSettings;
