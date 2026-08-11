import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Loader2, KeyRound, UserPlus, AlertCircle, Settings, Users, CalendarDays,
  Clock, ShieldCheck, Save, User, Lock, Unlock, Check, X, Mail, Activity, Key, Webhook, MessageSquare, ShieldAlert, FileText, Calculator,
  Building2, Layers, Palette, Tag,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { roleLabel } from "@/lib/roles";
import AuditActivityTab from "@/components/settings/AuditActivityTab";
import ApiKeysTab from "@/components/settings/ApiKeysTab";
import WebhooksTab from "@/components/settings/WebhooksTab";
import WhatsAppConfigTab from "@/components/settings/WhatsAppConfigTab";
import InvoiceTemplateTab from "@/components/settings/InvoiceTemplateTab";
import VerifactuSettingsTab from "@/components/settings/VerifactuSettingsTab";
import AccountingSettingsTab from "@/components/settings/AccountingSettingsTab";
import ScheduleTemplatesCard from "@/components/settings/ScheduleTemplatesCard";
import HolidaysCard from "@/components/settings/HolidaysCard";
import CreateEmployeeDialog from "@/components/hr/CreateEmployeeDialog";
import EmployeeModulesTab from "@/components/settings/EmployeeModulesTab";
import TaskBoardsTab from "@/components/settings/TaskBoardsTab";
import VerticalsServicesTab from "@/components/settings/VerticalsServicesTab";
import BrandsTab from "@/components/settings/BrandsTab";
import BrandAccessTab from "@/components/settings/BrandAccessTab";

import CompanyTab from "@/components/settings/CompanyTab";
import ProfileTab from "@/components/settings/ProfileTab";
import AppearanceTab from "@/components/settings/AppearanceTab";
import ScheduleTab from "@/components/settings/ScheduleTab";
import SecurityTab from "@/components/settings/SecurityTab";
import UsersTab from "@/components/settings/UsersTab";

// ─── MAIN SETTINGS PAGE ──────────────────────────────────
type SettingSection = {
  key: string; group: string; title: string; desc: string; icon: any;
  managerOnly?: boolean; badge?: boolean;
};

const GROUP_ORDER = [
  "General",
  "Tu cuenta",
  "Equipo",
  "Comercial",
  "Facturación y contabilidad",
  "Integraciones y desarrolladores",
  "Auditoría",
];

/**
 * Orden de los grupos. GROUP_ORDER solo fija la prelación: cualquier grupo de
 * SECTIONS que no esté listado se pinta al final en vez de desaparecer, para
 * que añadir una sección con un grupo nuevo no la deje invisible.
 */
const groupsToRender = (): string[] => {
  const extras = SECTIONS.map((s) => s.group).filter((g) => !GROUP_ORDER.includes(g));
  return [...GROUP_ORDER, ...Array.from(new Set(extras))];
};

const SECTIONS: SettingSection[] = [
  { key: "company",  group: "General", title: "Empresa", desc: "Datos fiscales y generales de tu empresa.", icon: Building2 },
  { key: "schedule", group: "General", title: "Horario y vacaciones", desc: "Jornada laboral y días de vacaciones del equipo.", icon: Clock },
  { key: "profile",  group: "Tu cuenta", title: "Mi perfil", desc: "Tus datos personales y de contacto.", icon: User },
  { key: "security", group: "Tu cuenta", title: "Seguridad", desc: "Contraseña y acceso a tu cuenta.", icon: Lock },
  { key: "appearance", group: "Tu cuenta", title: "Apariencia", desc: "Elige entre el modo oscuro y el claro.", icon: Palette },
  { key: "users",       group: "Equipo", title: "Usuarios", desc: "Gestiona usuarios, roles y solicitudes.", icon: Users, managerOnly: true, badge: true },
  { key: "permissions", group: "Equipo", title: "Permisos de módulos", desc: "Qué módulos puede ver cada empleado.", icon: ShieldCheck, managerOnly: true },
  { key: "brandaccess", group: "Equipo", title: "Acceso por marca", desc: "Departamentos y personas asignados a cada marca.", icon: Building2, managerOnly: true },
  { key: "taskboards",  group: "Equipo", title: "Tableros de tareas", desc: "Kanban, prefijos de referencia y accesos.", icon: CalendarDays, managerOnly: true },
  { key: "brands", group: "Comercial", title: "Marcas", desc: "Identidades con las que facturas y los módulos de cada una.", icon: Tag, managerOnly: true },
  { key: "verticals", group: "Comercial", title: "Líneas de negocio", desc: "Verticales y servicios que ofreces a tus clientes.", icon: Layers, managerOnly: true },
  { key: "invoicetemplate", group: "Facturación y contabilidad", title: "Plantilla de facturas", desc: "Diseño y datos que aparecen en tus facturas.", icon: FileText, managerOnly: true },
  { key: "accounting",      group: "Facturación y contabilidad", title: "Contabilidad", desc: "Método contable, categorías y cuentas.", icon: Calculator, managerOnly: true },
  { key: "verifactu",       group: "Facturación y contabilidad", title: "VERI*FACTU", desc: "Registro de facturas ante la AEAT.", icon: ShieldCheck, managerOnly: true },
  { key: "api",      group: "Integraciones y desarrolladores", title: "Claves API", desc: "Acceso programático a tu cuenta.", icon: Key, managerOnly: true },
  { key: "webhooks", group: "Integraciones y desarrolladores", title: "Webhooks", desc: "Notifica eventos a sistemas externos.", icon: Webhook, managerOnly: true },
  { key: "whatsapp", group: "Integraciones y desarrolladores", title: "WhatsApp", desc: "Conecta tu cuenta de WhatsApp Business.", icon: MessageSquare, managerOnly: true },
  { key: "activity", group: "Auditoría", title: "Actividad", desc: "Registro de cambios y accesos.", icon: Activity, managerOnly: true },
];

const AppSettings = () => {
  const { user, accountId, role } = useAuth();
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";

  // Count pending requests for badge
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["pending-requests-count", accountId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profile_change_requests")
        .select("*", { count: "exact", head: true })
        .eq("account_id", accountId!)
        .eq("status", "PENDING");
      if (error) throw error;
      return count || 0;
    },
    enabled: !!accountId && isManager,
  });

  const [section, setSection] = useState("");

  if (!user || !accountId) return null;

  const visible = SECTIONS.filter((sec) => !sec.managerOnly || isManager);
  const current = visible.find((sec) => sec.key === section);

  /* Al entrar sin sección se abre la primera, en vez de una rejilla de
     tarjetas intermedia: con la navegación siempre a la vista, ese paso
     sobraba y obligaba a dos clics para llegar a cualquier ajuste. */
  const active = section || visible[0]?.key || "";

  return (
    <div className="flex min-h-full gap-4">
      {/* Navegación secundaria (212 px) */}
      <aside className="hidden w-[212px] shrink-0 lg:block">
        {groupsToRender().map((group) => {
          const items = visible.filter((sec) => sec.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <div className="px-2.5 pb-1.5 pt-4 font-mono text-[9.5px] font-semibold uppercase tracking-[.07em] text-faint first:pt-0">
                {group}
              </div>
              <div className="flex flex-col gap-px">
                {items.map((sec) => {
                  const isActive = active === sec.key;
                  return (
                    <button
                      key={sec.key}
                      type="button"
                      onClick={() => setSection(sec.key)}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex h-[30px] w-full items-center gap-2.5 rounded-control px-2.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/[.16] ${
                        isActive
                          ? "bg-sidebar-accent text-[12.5px] font-semibold text-foreground"
                          : "text-xs font-medium text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                      }`}
                    >
                      <sec.icon
                        className={`h-[15px] w-[15px] shrink-0 stroke-[1.8] ${isActive ? "text-accent-foreground" : "text-faint"}`}
                      />
                      <span className="flex-1 truncate">{sec.title}</span>
                      {sec.badge && pendingCount > 0 && (
                        <span className="tnum shrink-0 text-[10px] font-semibold text-destructive-text">
                          {pendingCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </aside>

      <div className="min-w-0 flex-1">
        {/* Selector para pantallas estrechas, donde no cabe la columna */}
        <div className="mb-4 lg:hidden">
          <Select value={active} onValueChange={setSection}>
            <SelectTrigger><SelectValue placeholder="Elige una sección" /></SelectTrigger>
            <SelectContent>
              {visible.map((sec) => (
                <SelectItem key={sec.key} value={sec.key}>{sec.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {current && (
          <div className="mb-5">
            <h1 className="font-display text-[17px] font-semibold tracking-[-.01em] text-foreground">
              {current.title}
            </h1>
            <p className="mt-0.5 text-[11.5px] leading-[1.6] text-muted-foreground">{current.desc}</p>
          </div>
        )}

        <Tabs value={active} onValueChange={setSection}>
        <TabsContent value="company">
          <CompanyTab accountId={accountId} isManager={isManager} />
        </TabsContent>

        <TabsContent value="profile">
          <ProfileTab userId={user.id} accountId={accountId} isManager={isManager} />
        </TabsContent>

        <TabsContent value="schedule">
          <ScheduleTab accountId={accountId} isManager={isManager} />
        </TabsContent>

        <TabsContent value="appearance">
          <AppearanceTab />
        </TabsContent>

        <TabsContent value="security">
          <SecurityTab userId={user.id} accountId={accountId} isManager={isManager} />
        </TabsContent>

        {isManager && (
          <TabsContent value="users">
            <UsersTab userId={user.id} accountId={accountId} />
          </TabsContent>
        )}
        {isManager && (
          <TabsContent value="brandaccess">
            <BrandAccessTab accountId={accountId} isManager={isManager} />
          </TabsContent>
        )}
        {isManager && (
          <TabsContent value="brands">
            <BrandsTab accountId={accountId} isManager={isManager} />
          </TabsContent>
        )}
        {isManager && (
          <TabsContent value="verticals">
            <VerticalsServicesTab accountId={accountId} isManager={isManager} />
          </TabsContent>
        )}
        {isManager && (
          <TabsContent value="activity">
            <AuditActivityTab accountId={accountId} />
          </TabsContent>
        )}
        {isManager && (
          <TabsContent value="api">
            <ApiKeysTab accountId={accountId} isManager={isManager} />
          </TabsContent>
        )}
        {isManager && (
          <TabsContent value="webhooks">
            <WebhooksTab accountId={accountId} isManager={isManager} />
          </TabsContent>
        )}
        {isManager && (
          <TabsContent value="whatsapp">
            <WhatsAppConfigTab accountId={accountId} isManager={isManager} />
          </TabsContent>
        )}
        {isManager && (
          <TabsContent value="invoicetemplate">
            <InvoiceTemplateTab accountId={accountId} isManager={isManager} />
          </TabsContent>
        )}
        {isManager && (
          <TabsContent value="accounting">
            <AccountingSettingsTab accountId={accountId} />
          </TabsContent>
        )}
        {isManager && (
          <TabsContent value="verifactu">
            <VerifactuSettingsTab accountId={accountId} isManager={isManager} />
          </TabsContent>
        )}
        {isManager && (
          <TabsContent value="permissions">
            <EmployeeModulesTab accountId={accountId} />
          </TabsContent>
        )}
        {isManager && (
          <TabsContent value="taskboards">
            <TaskBoardsTab />
          </TabsContent>
        )}
        </Tabs>
      </div>
    </div>
  );
};

export default AppSettings;

