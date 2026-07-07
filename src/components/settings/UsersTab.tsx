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
import CreateEmployeeDialog from "@/components/hr/CreateEmployeeDialog";

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
          <UserPlus className="h-4 w-4 mr-2" /> Dar de alta
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
                      <Badge variant={(u.role === "MANAGER" || u.role === "MASTER_ADMIN") ? "default" : "secondary"}>
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        {roleLabel(u.role)}
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


export default UsersTab;
