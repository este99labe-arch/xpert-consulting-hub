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
      // supabase.functions.invoke returns an error for non-2xx; try to extract the server message
      let serverMessage: string | undefined = (data as any)?.error;
      if (!serverMessage && error) {
        try {
          const ctx: any = (error as any).context;
          if (ctx?.body) {
            const text = typeof ctx.body === "string" ? ctx.body : await new Response(ctx.body).text();
            const parsed = JSON.parse(text);
            serverMessage = parsed?.error;
          }
        } catch { /* ignore parse errors */ }
      }
      if (serverMessage) throw new Error(serverMessage);
      if (error) throw error;
      toast({ title: "Contraseña actualizada correctamente" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "No se pudo cambiar la contraseña", variant: "destructive" });
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
                      <Badge variant="secondary">{roleLabel(u.role)}</Badge>
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


export default SecurityTab;
