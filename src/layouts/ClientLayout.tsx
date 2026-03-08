import { Outlet, useLocation, useNavigate } from "react-router-dom";
import GlobalSearch from "@/components/shared/GlobalSearch";
import NotificationBell from "@/components/shared/NotificationBell";
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
  LayoutDashboard, Users, FileText, Calculator, UserCog, Clock, Settings, LogOut, Package, ArrowRightLeft, ChevronDown, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Breadcrumbs from "@/components/shared/Breadcrumbs";

const moduleIcons: Record<string, any> = {
  DASHBOARD: LayoutDashboard,
  CLIENTS: Users,
  INVOICES: FileText,
  ACCOUNTING: Calculator,
  HR: UserCog,
  ATTENDANCE: Clock,
  INVENTORY: Package,
  REPORTS: BarChart3,
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
  REPORTS: "/app/reports",
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
      <div className="flex min-h-screen w-full overflow-hidden">
        <Sidebar collapsible="icon" className="border-r-0">
          <SidebarHeader className="p-5 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground text-sm font-bold shadow-md">
                XC
              </div>
              <div>
                <p className="text-sm font-semibold text-sidebar-foreground">XpertConsulting</p>
                <p className="text-xs text-sidebar-foreground/50">Panel Cliente</p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent className="px-3 py-4 scrollbar-hide">
            <SidebarMenu>
              {modules.filter((mod) => mod.code !== "SETTINGS").map((mod) => {
                const Icon = moduleIcons[mod.code] || LayoutDashboard;
                const path = modulePaths[mod.code] || "/app/dashboard";
                return (
                  <SidebarMenuItem key={mod.code}>
                    <SidebarMenuButton
                      isActive={location.pathname === path}
                      onClick={() => navigate(path)}
                      tooltip={mod.name}
                      className="h-10 rounded-lg"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{mod.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {/* SETTINGS always last */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={location.pathname === "/app/settings"}
                  onClick={() => navigate("/app/settings")}
                  tooltip="Configuración"
                  className="h-10 rounded-lg"
                >
                  <Settings className="h-4 w-4" />
                  <span>Configuración</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            {role === "MASTER_ADMIN" && (
              <>
                <Separator className="my-3 bg-sidebar-border" />
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => navigate("/master/dashboard")}
                      tooltip="Ir al Panel Master"
                      className="h-10 rounded-lg"
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                      <span>Panel Master</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </>
            )}
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-xs font-medium">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <p className="text-xs text-sidebar-foreground/70 truncate flex-1">{user?.email}</p>
            </div>
            <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar sesión
            </Button>
          </SidebarFooter>
        </Sidebar>
        <GlobalSearch />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background/80 backdrop-blur-sm px-6">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-5" />
              <Breadcrumbs />
            </div>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 h-9 px-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                      {user?.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium hidden sm:inline">{user?.email?.split("@")[0]}</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate("/app/settings")}>
                  <Settings className="h-4 w-4 mr-2" />
                  Mi perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default ClientLayout;
