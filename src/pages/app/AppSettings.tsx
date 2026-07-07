import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Loader2, KeyRound, UserPlus, AlertCircle, Settings, Users, CalendarDays,
  Clock, ShieldCheck, Save, User, Lock, Unlock, Check, X, Mail, Activity, Key, Webhook, MessageSquare, ShieldAlert, FileText, Calculator,
  ChevronRight, ChevronLeft, Building2,
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

import CompanyTab from "@/components/settings/CompanyTab";
import ProfileTab from "@/components/settings/ProfileTab";
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
  "Facturación y contabilidad",
  "Integraciones y desarrolladores",
  "Auditoría",
];

const SECTIONS: SettingSection[] = [
  { key: "company",  group: "General", title: "Empresa", desc: "Datos fiscales y generales de tu empresa.", icon: Building2 },
  { key: "schedule", group: "General", title: "Horario y vacaciones", desc: "Jornada laboral y días de vacaciones del equipo.", icon: Clock },
  { key: "profile",  group: "Tu cuenta", title: "Mi perfil", desc: "Tus datos personales y de contacto.", icon: User },
  { key: "security", group: "Tu cuenta", title: "Seguridad", desc: "Contraseña y acceso a tu cuenta.", icon: Lock },
  { key: "users",       group: "Equipo", title: "Usuarios", desc: "Gestiona usuarios, roles y solicitudes.", icon: Users, managerOnly: true, badge: true },
  { key: "permissions", group: "Equipo", title: "Permisos de módulos", desc: "Qué módulos puede ver cada empleado.", icon: ShieldCheck, managerOnly: true },
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

  return (
    <div className="space-y-6">
      <Tabs value={section} onValueChange={setSection} className="space-y-6">
        {!section ? (
          <div className="space-y-7">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
              <p className="text-sm text-muted-foreground">Gestiona tu empresa, tu cuenta personal y las integraciones.</p>
            </div>
            {GROUP_ORDER.map((group) => {
              const items = SECTIONS.filter((s) => s.group === group && (!s.managerOnly || isManager));
              if (items.length === 0) return null;
              return (
                <div key={group} className="space-y-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">{group}</h2>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setSection(s.key)}
                        className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-2xs transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <s.icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium leading-tight">{s.title}</p>
                            {s.badge && pendingCount > 0 && (
                              <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs">{pendingCount}</Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-sm text-muted-foreground">{s.desc}</p>
                        </div>
                        <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          (() => {
            const current = SECTIONS.find((s) => s.key === section);
            return (
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setSection("")}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {current && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <current.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h1 className="text-xl font-bold leading-tight tracking-tight">{current.title}</h1>
                      <p className="text-sm text-muted-foreground">{current.desc}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()
        )}

        <TabsContent value="company">
          <CompanyTab accountId={accountId} isManager={isManager} />
        </TabsContent>

        <TabsContent value="profile">
          <ProfileTab userId={user.id} accountId={accountId} isManager={isManager} />
        </TabsContent>

        <TabsContent value="schedule">
          <ScheduleTab accountId={accountId} isManager={isManager} />
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
      </Tabs>
    </div>
  );
};

export default AppSettings;

