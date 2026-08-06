import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { LayoutDashboard, Users, Settings, LogOut, ArrowRightLeft, BookOpen, Menu } from "lucide-react";
import xpertLogo from "@/assets/brand/iso-white.png";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import HealthCheck from "@/components/shared/HealthCheck";
import { SupportSessionBanner } from "@/components/shared/SupportSession";
import AccountSwitcher from "@/components/shared/AccountSwitcher";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/master/dashboard" },
  { label: "Cuentas", icon: Users, path: "/master/clients" },
  { label: "Configuración", icon: Settings, path: "/master/settings" },
  { label: "API Docs", icon: BookOpen, path: "/master/api-docs" },
];

/**
 * Chrome del panel maestro.
 *
 * El dossier no cubre este panel, pero compartir la misma estructura que el
 * de cliente —rail, panel de 194 px y topbar de 54 px— evita que cambiar de
 * uno a otro parezca cambiar de aplicación.
 */
const MasterLayout = () => {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const go = (path: string) => {
    navigate(path);
    setMobileNavOpen(false);
  };

  const nav = (
    <nav className="flex h-full flex-col px-3 py-3.5">
      <div className="px-2.5">
        <p className="text-[12.5px] font-semibold text-foreground">XpertConsulting</p>
        <p className="mt-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[.07em] text-faint">
          Panel Master
        </p>
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-px">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => go(item.path)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-[31px] w-full items-center gap-2.5 rounded-control px-2.5 text-left transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/[.16]",
                active
                  ? "bg-sidebar-accent text-[12.5px] font-semibold text-foreground"
                  : "text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <item.icon
                className={cn("h-[15px] w-[15px] shrink-0 stroke-[1.8]", active ? "text-accent-foreground" : "text-faint")}
              />
              <span className="flex-1 truncate">{item.label}</span>
            </button>
          );
        })}

        <div className="mt-4 border-t border-border-subtle pt-3">
          <button
            type="button"
            onClick={() => go("/app/dashboard")}
            className="flex h-[31px] w-full items-center gap-2.5 rounded-control px-2.5 text-left text-xs font-medium text-sidebar-foreground transition-colors duration-150 hover:bg-sidebar-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/[.16]"
          >
            <ArrowRightLeft className="h-[15px] w-[15px] shrink-0 stroke-[1.8] text-faint" />
            <span className="flex-1 truncate">Panel App</span>
          </button>
        </div>
      </div>

      <div className="px-1.5 pb-1">
        <HealthCheck />
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Rail de 56 px */}
      <aside className="hidden w-14 shrink-0 flex-col items-center gap-1 border-r border-border-subtle bg-sidebar-background py-3 md:flex">
        <div className="mb-2.5 flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-secondary p-1">
          <img src={xpertLogo} alt="XpertConsulting" className="h-full w-full object-contain" />
        </div>

        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              type="button"
              title={item.label}
              aria-label={item.label}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex h-[34px] w-[34px] items-center justify-center rounded-[9px] transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/[.16]",
                active
                  ? "border border-border-strong bg-sidebar-accent text-accent-foreground"
                  : "text-faint hover:bg-sidebar-accent/60 hover:text-muted-foreground",
              )}
            >
              <item.icon className="h-4 w-4 stroke-[1.7]" />
            </button>
          );
        })}

        <div className="mt-auto flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[hsl(var(--border-strong))] text-[10px] font-semibold text-muted-foreground">
          {user?.email?.charAt(0).toUpperCase() ?? "?"}
        </div>
      </aside>

      {/* Panel de 194 px */}
      <aside className="hidden w-[194px] shrink-0 border-r border-border-subtle bg-sidebar md:block">{nav}</aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[240px] border-border-subtle bg-sidebar p-0">
          {nav}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <SupportSessionBanner />

        <header className="flex h-[54px] shrink-0 items-center gap-3 border-b border-border-subtle px-6">
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setMobileNavOpen(true)} aria-label="Abrir navegación">
              <Menu />
            </Button>
          )}
          <span className="font-display text-[13px] font-semibold text-foreground">Panel Master</span>

          <div className="ml-auto flex items-center gap-1">
            <AccountSwitcher />
            <Button variant="ghost" className="h-[30px] gap-2 px-2" onClick={signOut}>
              <LogOut />
              <span className="hidden text-xs font-medium sm:inline">Cerrar sesión</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto px-6 pb-8 pt-[22px]">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

export default MasterLayout;
