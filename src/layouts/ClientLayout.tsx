import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, Users, FileText, Calculator, UserCog, Clock, Settings, LogOut, Package, ArrowRightLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const moduleIcons: Record<string, any> = {
  DASHBOARD: LayoutDashboard,
  CLIENTS: Users,
  INVOICES: FileText,
  ACCOUNTING: Calculator,
  HR: UserCog,
  ATTENDANCE: Clock,
  INVENTORY: Package,
  SETTINGS: Settings,
};

const modulePaths: Record<string, string> = {
  DASHBOARD: "/app/dashboard",
  CLIENTS: "/app/clients",
  INVOICES: "/app/invoices",
  ACCOUNTING: "/app/accounting",
  HR: "/app/hr",
  ATTENDANCE: "/app/attendance",
  INVENTORY: "/app/inventory",
  SETTINGS: "/app/settings",
};

const ClientLayout = () => {
  const { signOut, user, accountId, role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const { data: modules = [] } = useQuery({
    queryKey: ["account_modules", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("account_modules")
        .select("is_enabled, service_modules(code, name)")
        .eq("account_id", accountId)
        .eq("is_enabled", true);
      if (error) throw error;
      return (data || []).map((m: any) => ({
        code: m.service_modules.code,
        name: m.service_modules.name,
      }));
    },
    enabled: !!accountId,
  });

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar>
          <SidebarHeader className="p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
                XC
              </div>
              <div>
                <p className="text-sm font-semibold text-sidebar-foreground">XpertConsulting</p>
                <p className="text-xs text-muted-foreground">Panel Cliente</p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {modules.map((mod) => {
                const Icon = moduleIcons[mod.code] || LayoutDashboard;
                const path = modulePaths[mod.code] || "/app/dashboard";
                return (
                  <SidebarMenuItem key={mod.code}>
                    <SidebarMenuButton
                      isActive={location.pathname === path}
                      onClick={() => navigate(path)}
                      tooltip={mod.name}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{mod.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
            {role === "MASTER_ADMIN" && (
              <>
                <Separator className="my-2" />
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => navigate("/master/dashboard")}
                      tooltip="Ir al Panel Master"
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                      <span>Panel Master</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </>
            )}
          </SidebarContent>
          <SidebarFooter className="p-3 border-t border-sidebar-border">
            <p className="text-xs text-muted-foreground truncate mb-2">{user?.email}</p>
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar sesión
            </Button>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-14 items-center gap-2 border-b px-4">
            <SidebarTrigger />
          </header>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default ClientLayout;
