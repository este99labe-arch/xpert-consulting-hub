import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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
import { LayoutDashboard, Users, Settings, LogOut, ArrowRightLeft, BookOpen } from "lucide-react";
import xpertLogo from "@/assets/xpertconsulting-logo.png";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import HealthCheck from "@/components/shared/HealthCheck";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/master/dashboard" },
  { label: "Cuentas", icon: Users, path: "/master/clients" },
  { label: "Configuración", icon: Settings, path: "/master/settings" },
  { label: "API Docs", icon: BookOpen, path: "/master/api-docs" },
];

const MasterLayout = () => {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="icon" className="border-r-0">
          <SidebarHeader className="p-5 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-md p-1">
                <img src={xpertLogo} alt="XpertConsulting" className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="text-sm font-semibold text-sidebar-foreground">XpertConsulting</p>
                <p className="text-xs text-sidebar-foreground/50">Panel Master</p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent className="px-3 py-4 scrollbar-hide">
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.path}
                    onClick={() => navigate(item.path)}
                    tooltip={item.label}
                    className="h-10 rounded-lg"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            <Separator className="my-3 bg-sidebar-border" />
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate("/app/dashboard")}
                  tooltip="Ir al Panel App"
                  className="h-10 rounded-lg"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  <span>Panel App</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
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
            <HealthCheck />
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/80 backdrop-blur-sm px-6">
            <SidebarTrigger />
          </header>
          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto">
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default MasterLayout;
