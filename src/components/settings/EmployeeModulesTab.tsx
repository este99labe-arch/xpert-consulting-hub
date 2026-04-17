import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, ShieldCheck, UserCog } from "lucide-react";

interface Props {
  accountId: string;
}

const EmployeeModulesTab: React.FC<Props> = ({ accountId }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Active modules of the account (decided by ADMIN)
  const { data: accountModules = [] } = useQuery({
    queryKey: ["acc-modules-active", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_modules")
        .select("module_id, is_enabled, service_modules(id, code, name, description)")
        .eq("account_id", accountId)
        .eq("is_enabled", true);
      if (error) throw error;
      return (data || []).map((m: any) => m.service_modules).filter(Boolean);
    },
  });

  // Employees of the account
  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ["account-users-modules", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin_reset_password", {
        body: { action: "list_users", account_id: accountId },
      });
      if (error) throw error;
      return (data?.users || []).filter((u: any) => u.is_active && u.role === "EMPLOYEE");
    },
  });

  // Per-user modules
  const { data: userMods = [] } = useQuery({
    queryKey: ["user-modules", selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return [];
      const { data, error } = await supabase
        .from("user_modules")
        .select("*")
        .eq("user_id", selectedUserId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedUserId,
  });

  const toggle = useMutation({
    mutationFn: async ({ moduleId, enabled }: { moduleId: string; enabled: boolean }) => {
      if (!selectedUserId) return;
      const existing = (userMods as any[]).find((u) => u.module_id === moduleId);
      if (existing) {
        const { error } = await supabase.from("user_modules").update({ is_enabled: enabled }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_modules").insert({
          user_id: selectedUserId, account_id: accountId, module_id: moduleId, is_enabled: enabled,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user-modules", selectedUserId] }),
  });

  if (loadingEmployees) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      {/* Employee list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCog className="h-4 w-4" /> Empleados
          </CardTitle>
          <CardDescription className="text-xs">Selecciona uno para gestionar sus permisos.</CardDescription>
        </CardHeader>
        <CardContent className="p-2">
          {employees.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sin empleados activos</p>
          ) : (
            <div className="space-y-1">
              {employees.map((e: any) => {
                const isSel = selectedUserId === e.user_id;
                return (
                  <button
                    key={e.user_id}
                    onClick={() => setSelectedUserId(e.user_id)}
                    className={`w-full flex items-center gap-2 p-2 rounded-md transition-colors text-left ${
                      isSel ? "bg-primary/10 text-primary" : "hover:bg-muted"
                    }`}
                  >
                    <Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{e.email?.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                    <span className="text-sm truncate flex-1">{e.email}</span>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modules toggle */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Permisos de módulos
          </CardTitle>
          <CardDescription className="text-xs">
            Solo ves los módulos activos de la cuenta. Desactiva los que no quieras que el empleado vea en su menú.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedUserId ? (
            <div className="text-center text-muted-foreground py-12 text-sm">
              <UserCog className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Selecciona un empleado de la lista
            </div>
          ) : accountModules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Esta cuenta no tiene módulos activos. Pide al administrador que los habilite.
            </p>
          ) : (
            <div className="space-y-2">
              {accountModules.map((mod: any) => {
                const um = (userMods as any[]).find((u) => u.module_id === mod.id);
                // Default for employees: disabled unless explicitly enabled
                const enabled = um ? um.is_enabled : false;
                const isCore = ["DASHBOARD", "ATTENDANCE", "TASKS", "SETTINGS"].includes(mod.code);
                return (
                  <div key={mod.id} className="flex items-center justify-between rounded-md border p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{mod.name}</p>
                        {isCore && <Badge variant="outline" className="text-[10px]">Siempre visible</Badge>}
                      </div>
                      {mod.description && <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>}
                    </div>
                    <Switch
                      checked={isCore ? true : enabled}
                      disabled={isCore}
                      onCheckedChange={(checked) => toggle.mutate({ moduleId: mod.id, enabled: checked })}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeModulesTab;
