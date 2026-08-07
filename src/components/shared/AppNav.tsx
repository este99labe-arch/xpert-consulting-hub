import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, FileText, Calculator, UserCog, Clock, Settings,
  Package, ArrowRightLeft, BarChart3, CalendarClock, Globe, MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import MyTasksBadge from "@/components/tasks/MyTasksBadge";
import xpertLogo from "@/assets/brand/iso-white.png";

export const moduleIcons: Record<string, any> = {
  DASHBOARD: LayoutDashboard,
  CLIENTS: Users,
  INVOICES: FileText,
  ACCOUNTING: Calculator,
  HR: UserCog,
  ATTENDANCE: Clock,
  INVENTORY: Package,
  REPORTS: BarChart3,
  TASKS: CalendarClock,
  XPERTRED: Globe,
  CHAT: MessageCircle,
  SETTINGS: Settings,
};

export const modulePaths: Record<string, string> = {
  DASHBOARD: "/app/dashboard",
  CLIENTS: "/app/clients",
  INVOICES: "/app/invoices",
  ACCOUNTING: "/app/accounting",
  HR: "/app/hr",
  ATTENDANCE: "/app/attendance",
  INVENTORY: "/app/inventory",
  REPORTS: "/app/reports",
  TASKS: "/app/tasks",
  XPERTRED: "/app/xpertred",
  CHAT: "/app/chat",
  SETTINGS: "/app/settings",
};

/**
 * Agrupación del panel de navegación. El orden manda; los módulos que no
 * aparezcan aquí caen al final en "MÁS", igual que hace AppSettings — así un
 * módulo nuevo se ve aunque nadie se acuerde de tocar este fichero.
 */
const NAV_GROUPS: { label: string; codes: string[] }[] = [
  { label: "OPERACIÓN", codes: ["DASHBOARD", "CLIENTS", "INVOICES", "ACCOUNTING"] },
  { label: "EQUIPO", codes: ["HR", "ATTENDANCE", "TASKS"] },
  { label: "RECURSOS", codes: ["INVENTORY", "REPORTS", "XPERTRED", "CHAT"] },
  { label: "SISTEMA", codes: ["SETTINGS"] },
];

export interface NavModule {
  code: string;
  name: string;
}

/** Marca de la cuenta en la cabecera del panel. Vivía en el rail de iconos;
 *  al retirarlo se recoloca aquí para no perder la referencia de en qué
 *  cuenta estás, que en multi-cuenta importa. */
const AccountMark = ({
  companyName, companyInitials, isXpertAccount,
}: { companyName: string; companyInitials: string; isXpertAccount: boolean }) => (
  <div className="flex items-center gap-2.5 px-2.5">
    {isXpertAccount ? (
      <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-control bg-secondary p-1">
        <img src={xpertLogo} alt="" aria-hidden className="h-full w-full object-contain" />
      </div>
    ) : (
      <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-control bg-primary text-[10px] font-bold text-primary-foreground">
        {companyInitials}
      </div>
    )}
    <span className="truncate text-[12.5px] font-semibold text-foreground">{companyName}</span>
  </div>
);

const GroupLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="px-2.5 pb-1.5 pt-4 font-mono text-[9.5px] font-semibold uppercase tracking-[.07em] text-faint first:pt-0">
    {children}
  </div>
);

const NavItem = ({
  active, onClick, icon: Icon, label, trailing,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
  trailing?: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={active ? "page" : undefined}
    className={cn(
      "flex h-[31px] w-full items-center gap-2.5 rounded-control px-2.5 text-left transition-colors duration-150",
      "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/[.16]",
      active
        ? "bg-sidebar-accent text-[12.5px] font-semibold text-foreground"
        : "text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
    )}
  >
    <Icon className={cn("h-[15px] w-[15px] shrink-0 stroke-[1.8]", active ? "text-accent-foreground" : "text-faint")} />
    <span className="flex-1 truncate">{label}</span>
    {trailing}
  </button>
);

/**
 * Panel de navegación (194 px). Se comparte entre el chrome de escritorio y
 * el cajón móvil para que no haya dos listas que mantener.
 */
const AppNav = ({
  modules, companyName, companyInitials, isXpertAccount, isMaster, onNavigate,
}: {
  modules: NavModule[];
  companyName: string;
  companyInitials: string;
  isXpertAccount: boolean;
  isMaster: boolean;
  onNavigate?: () => void;
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  const go = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  const byCode = new Map(modules.map((m) => [m.code, m]));
  const grouped = NAV_GROUPS.map((g) => ({
    label: g.label,
    items: g.codes.map((c) => byCode.get(c)).filter(Boolean) as NavModule[],
  })).filter((g) => g.items.length > 0);

  const placed = new Set(NAV_GROUPS.flatMap((g) => g.codes));
  const rest = modules.filter((m) => !placed.has(m.code));
  if (rest.length) grouped.push({ label: "MÁS", items: rest });

  return (
    <nav className="flex h-full flex-col px-3 py-3.5">
      <AccountMark companyName={companyName} companyInitials={companyInitials} isXpertAccount={isXpertAccount} />

      <div className="mt-1 flex-1 overflow-y-auto scrollbar-hide">
        {grouped.map((group) => (
          <div key={group.label}>
            <GroupLabel>{group.label}</GroupLabel>
            <div className="flex flex-col gap-px">
              {group.items.map((mod) => {
                const path = modulePaths[mod.code] || "/app/dashboard";
                return (
                  <NavItem
                    key={mod.code}
                    active={location.pathname === path}
                    onClick={() => go(path)}
                    icon={moduleIcons[mod.code] || LayoutDashboard}
                    label={mod.name}
                    trailing={mod.code === "TASKS" ? <MyTasksBadge /> : undefined}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {isMaster && (
          <div>
            <GroupLabel>ADMINISTRACIÓN</GroupLabel>
            <NavItem
              active={location.pathname.startsWith("/master")}
              onClick={() => go("/master/dashboard")}
              icon={ArrowRightLeft}
              label="Panel Master"
            />
          </div>
        )}
      </div>
    </nav>
  );
};

export default AppNav;
