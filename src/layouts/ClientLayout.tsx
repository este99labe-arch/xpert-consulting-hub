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
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, Users, FileText, Calculator, UserCog, Clock, Settings, LogOut, Package, ArrowRightLeft, ChevronDown, BarChart3, HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Breadcrumbs from "@/components/shared/Breadcrumbs";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import OnboardingTour from "@/components/shared/OnboardingTour";
import HealthCheck from "@/components/shared/HealthCheck";

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

const SidebarInner = () => {
  const { signOut, user, accountId, role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const { data: accountInfo } = useQuery({
    queryKey: ["account-info", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("name")
        .eq("id", accountId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  const companyName = accountInfo?.name || "Mi Empresa";
  const companyInitials = companyName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  const { data: modules = [] } = useQuery({
    queryKey: ["account_modules", accountId, role],
    queryFn: async () => {
      if (!accountId) return [];
      if (role === "MASTER_ADMIN") {
        const { data, error } = await supabase.from("service_modules").select("code, name");
        if (error) throw error;
        return (data || []).map((m) => ({ code: m.code, name: m.name }));
      }
      const { data, error } = await supabase
        .from("account_modules")
        .select("is_enabled, service_modules(code, name)")
        .eq("account_id", accountId)
        .eq("is_enabled", true);
      if (error) throw error;
      return (data || []).map((m: any) => ({ code: m.service_modules.code, name: m.service_modules.name }));
    },
    enabled: !!accountId,
  });

  return (
    <>
      <Sidebar collapsible="icon" className="border-r-0">
        <SidebarHeader className="p-3 border-b border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                className="h-auto py-2 hover:bg-transparent cursor-default"
                tooltip={companyName}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold">
                  {companyInitials}
                </div>
                <div className="flex flex-col gap-0.5 leading-none overflow-hidden">
                  <span className="text-sm font-semibold truncate">{companyName}</span>
                  <span className="text-[10px] text-sidebar-foreground/50">Panel Cliente</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
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
        <SidebarFooter className="p-3 border-t border-sidebar-border">
          <SidebarMenu className="gap-1.5">
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                className="h-auto py-2 hover:bg-transparent cursor-default"
                tooltip={user?.email || "Usuario"}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-xs font-medium">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col gap-0.5 leading-none overflow-hidden">
                  <span className="text-xs truncate">{user?.email}</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={signOut}
                tooltip="Cerrar sesión"
                className="h-9 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground"
              >
                <LogOut className="h-4 w-4" />
                <span>Cerrar sesión</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
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
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
        <OnboardingTour />
      </SidebarInset>
    </>
  );
};

const ClientLayout = () => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full overflow-hidden">
        <SidebarInner />
      </div>
    </SidebarProvider>
  );
};

export default ClientLayout;
