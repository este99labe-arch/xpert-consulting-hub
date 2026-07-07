import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Loader2, KeyRound, UserPlus, AlertCircle, Users, CalendarDays,
  Clock, ShieldCheck, Save, User, Lock, Unlock, Check, X, Mail, ShieldAlert,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { roleLabel } from "@/lib/roles";

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




export default ProfileTab;
