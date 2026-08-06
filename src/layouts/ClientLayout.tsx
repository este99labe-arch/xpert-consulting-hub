import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import GlobalSearch from "@/components/shared/GlobalSearch";
import NotificationBell from "@/components/shared/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { LogOut, Settings, HelpCircle, ChevronDown, Menu, Search } from "lucide-react";
import ReminderNotifier from "@/components/reminders/ReminderNotifier";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Breadcrumbs from "@/components/shared/Breadcrumbs";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import OnboardingTour from "@/components/shared/OnboardingTour";
import MyTasksBadge from "@/components/tasks/MyTasksBadge";
import { SupportAccountSwitcher, SupportSessionBanner } from "@/components/shared/SupportSession";
import AccountSwitcher from "@/components/shared/AccountSwitcher";
import AppNav, { moduleIcons, modulePaths, type NavModule } from "@/components/shared/AppNav";
import { cn } from "@/lib/utils";
import xpertLogo from "@/assets/brand/iso-white.png";

/** Módulos que se asoman al rail de 56 px, en este orden. El resto viven solo
 *  en el panel: el rail es un atajo, no una segunda navegación completa. */
const RAIL_CODES = ["DASHBOARD", "INVOICES", "CLIENTS", "CHAT", "TASKS"];

const ClientLayout = () => {
  const { signOut, user, accountId, role, supportSession } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [showTutorial, setShowTutorial] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { data: accountInfo } = useQuery({
    queryKey: ["account-info", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("name, type").eq("id", accountId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  const companyName = accountInfo?.name || "Mi Empresa";
  const companyInitials = companyName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const isXpertAccount = accountInfo?.type === "MASTER";

  // TASKS dejó de ser "core": ahora es configurable por empleado en Permisos de módulos
  const CORE_CODES = ["DASHBOARD", "ATTENDANCE", "SETTINGS"];

  const { data: modules = [] } = useQuery({
    queryKey: ["account_modules", accountId, role, user?.id, supportSession?.accountId],
    queryFn: async (): Promise<NavModule[]> => {
      if (!accountId) return [];
      // En sesión de soporte se muestran los módulos contratados por el cliente,
      // no el catálogo completo: la idea es ver la app tal y como la ve él.
      if (role === "MASTER_ADMIN" && !supportSession) {
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
      const accountList = (data || []).map((m: any) => ({ code: m.service_modules.code, name: m.service_modules.name }));

      // EMPLOYEE: keep only modules explicitly assigned via user_modules (core always visible)
      if (role === "EMPLOYEE" && user?.id) {
        const { data: um } = await supabase
          .from("user_modules")
          .select("is_enabled, service_modules(code)")
          .eq("user_id", user.id)
          .eq("is_enabled", true);
        const allowedCodes = new Set((um || []).map((x: any) => x.service_modules?.code).filter(Boolean));
        return accountList.filter((m) => CORE_CODES.includes(m.code) || allowedCodes.has(m.code));
      }
      return accountList;
    },
    enabled: !!accountId,
  });

  // Tareas y Configuración se ven siempre, estén o no en el catálogo contratado.
  const navModules: NavModule[] = [...modules];
  if (!navModules.some((m) => m.code === "TASKS")) navModules.push({ code: "TASKS", name: "Tareas" });
  if (!navModules.some((m) => m.code === "SETTINGS")) navModules.push({ code: "SETTINGS", name: "Configuración" });

  const railItems = RAIL_CODES.map((c) => navModules.find((m) => m.code === c)).filter(Boolean) as NavModule[];
  const userInitial = user?.email?.charAt(0).toUpperCase() ?? "?";

  const nav = (
    <AppNav
      modules={navModules}
      companyName={companyName}
      isMaster={role === "MASTER_ADMIN"}
      onNavigate={() => setMobileNavOpen(false)}
    />
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* ── Rail de 56 px ───────────────────────────────────────────── */}
      <aside className="hidden w-14 shrink-0 flex-col items-center gap-1 border-r border-border-subtle bg-sidebar-background py-3 md:flex">
        {isXpertAccount ? (
          <div className="mb-2.5 flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-secondary p-1">
            <img src={xpertLogo} alt="XpertConsulting" className="h-full w-full object-contain" />
          </div>
        ) : (
          <div className="mb-2.5 flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-primary text-[11px] font-bold text-primary-foreground">
            {companyInitials}
          </div>
        )}

        {railItems.map((mod) => {
          const Icon = moduleIcons[mod.code];
          const path = modulePaths[mod.code];
          const active = location.pathname === path;
          return (
            <button
              key={mod.code}
              type="button"
              title={mod.name}
              aria-label={mod.name}
              onClick={() => navigate(path)}
              className={cn(
                "relative flex h-[34px] w-[34px] items-center justify-center rounded-[9px] transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/[.16]",
                active
                  ? "border border-border-strong bg-sidebar-accent text-accent-foreground"
                  : "text-faint hover:bg-sidebar-accent/60 hover:text-muted-foreground",
              )}
            >
              <Icon className="h-4 w-4 stroke-[1.7]" />
              {mod.code === "TASKS" && (
                <span className="pointer-events-none absolute right-1 top-1">
                  <MyTasksBadge />
                </span>
              )}
            </button>
          );
        })}

        <div className="mt-auto flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[hsl(var(--border-strong))] text-[10px] font-semibold text-muted-foreground">
          {userInitial}
        </div>
      </aside>

      {/* ── Panel de navegación de 194 px ───────────────────────────── */}
      <aside className="hidden w-[194px] shrink-0 border-r border-border-subtle bg-sidebar md:block">{nav}</aside>

      {/* Cajón móvil: mismo panel, sin duplicar la lista */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[240px] border-border-subtle bg-sidebar p-0">
          {nav}
        </SheetContent>
      </Sheet>

      <GlobalSearch />
      <ReminderNotifier />

      {/* ── Contenido ───────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <SupportSessionBanner />

        <header className="flex h-[54px] shrink-0 items-center gap-3 border-b border-border-subtle px-6">
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setMobileNavOpen(true)} aria-label="Abrir navegación">
              <Menu />
            </Button>
          )}
          <Breadcrumbs />

          <button
            type="button"
            onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            className="ml-3 hidden h-[30px] max-w-[320px] flex-1 items-center gap-2 rounded-control border border-input bg-muted px-[11px] text-[11.5px] text-faint transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/[.16] lg:flex"
          >
            <Search className="h-3.5 w-3.5 stroke-[1.8]" />
            <span className="truncate">Buscar facturas, clientes, apuntes…</span>
            <span className="ml-auto font-mono text-[9.5px] font-medium">⌘K</span>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <AccountSwitcher />
            <SupportAccountSwitcher />
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-[30px] gap-2 px-2">
                  <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[hsl(var(--border-strong))] text-[10px] font-semibold text-accent-foreground">
                    {userInitial}
                  </span>
                  <span className="hidden text-xs font-medium text-foreground sm:inline">
                    {user?.email?.split("@")[0]}
                  </span>
                  <ChevronDown className="text-faint" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate("/app/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  Mi perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowTutorial(true)}>
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Ver tutorial
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive-text focus:text-destructive-text">
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-auto px-6 pb-8 pt-[22px]">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

        <OnboardingTour forceShow={showTutorial} onClose={() => setShowTutorial(false)} />
      </div>
    </div>
  );
};

export default ClientLayout;
