import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL } from "@/integrations/supabase/config";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Save, Copy, CheckCircle2, MessageSquare, ExternalLink, Bot, Plus, Trash2, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props { accountId: string; isManager: boolean; }

const KIND_LABELS: Record<string, string> = {
  TASK: "Crea tarea", GENERAL: "Consulta", COMPLAINT: "Queja", OTHER: "Otro",
};

const WhatsAppConfigTab = ({ accountId, isManager }: Props) => {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({
    phone_number_id: "", verify_token: "", access_token: "", app_secret: "", display_phone: "",
    is_enabled: false, bot_enabled: true,
    welcome_message: "", fallback_message: "", task_ack_message: "", task_completed_template: "",
    default_assignee: "",
  });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [intentToDelete, setIntentToDelete] = useState<any>(null);

  // Nota: access_token y app_secret son de SOLO ESCRITURA (privilegios de columna
  // en BD impiden leerlos desde el cliente). Se selecciona la lista explícita.
  const { data: config } = useQuery({
    queryKey: ["whatsapp-config", accountId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("whatsapp_config")
        .select("id, account_id, phone_number_id, verify_token, is_enabled, waba_id, display_phone, bot_enabled, welcome_message, fallback_message, task_ack_message, task_completed_template, default_assignee, created_at, updated_at")
        .eq("account_id", accountId).maybeSingle();
      return data;
    },
    enabled: !!accountId,
  });

  const { data: team = [] } = useQuery({
    queryKey: ["wa-team", accountId],
    queryFn: async () => {
      const { data } = await supabase.from("employee_profiles").select("user_id, first_name, last_name").eq("account_id", accountId);
      return (data || []).map((p: any) => ({ id: p.user_id, name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Usuario" }));
    },
    enabled: !!accountId && isManager,
  });

  const { data: intents = [] } = useQuery({
    queryKey: ["chat-intents", accountId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("chat_intents").select("*").eq("account_id", accountId).order("sort_order");
      return data || [];
    },
    enabled: !!accountId && isManager,
  });

  useEffect(() => {
    if (config) {
      setForm({
        phone_number_id: config.phone_number_id || "", verify_token: config.verify_token || "",
        access_token: "", app_secret: "", display_phone: config.display_phone || "",
        is_enabled: config.is_enabled || false, bot_enabled: config.bot_enabled ?? true,
        welcome_message: config.welcome_message || "", fallback_message: config.fallback_message || "",
        task_ack_message: config.task_ack_message || "", task_completed_template: config.task_completed_template || "",
        default_assignee: config.default_assignee || "",
      });
    }
  }, [config]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp_webhook`;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        phone_number_id: form.phone_number_id.trim(), verify_token: form.verify_token.trim(),
        display_phone: form.display_phone.trim() || null,
        is_enabled: form.is_enabled, bot_enabled: form.bot_enabled,
        welcome_message: form.welcome_message, fallback_message: form.fallback_message,
        task_ack_message: form.task_ack_message, task_completed_template: form.task_completed_template,
        default_assignee: form.default_assignee || null, updated_at: new Date().toISOString(),
      };
      // Credenciales de solo escritura: solo se envían si el usuario escribe un valor nuevo
      if (form.access_token.trim()) payload.access_token = form.access_token.trim();
      if (form.app_secret.trim()) payload.app_secret = form.app_secret.trim();
      const { error } = config
        ? await (supabase as any).from("whatsapp_config").update(payload).eq("id", config.id)
        : await (supabase as any).from("whatsapp_config").insert({ account_id: accountId, ...payload });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["whatsapp-config", accountId] });
      toast({ title: "Configuración guardada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const intentMut = useMutation({
    mutationFn: async (op: { type: "add" | "update" | "delete"; row?: any }) => {
      if (op.type === "add") {
        const { error } = await (supabase as any).from("chat_intents").insert({
          account_id: accountId, name: "Nueva intención", kind: "GENERAL", keywords: [], sort_order: intents.length + 1,
        });
        if (error) throw error;
      } else if (op.type === "update") {
        const { error } = await (supabase as any).from("chat_intents").update({
          name: op.row.name, kind: op.row.kind, keywords: op.row.keywords,
          auto_reply: op.row.auto_reply || null, creates_task: op.row.creates_task, assignee: op.row.assignee || null,
        }).eq("id", op.row.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("chat_intents").delete().eq("id", op.row.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-intents", accountId] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!isManager) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground">Solo los administradores pueden configurar el Chat / WhatsApp.</CardContent></Card>;
  }

  return (
    <div className="space-y-5">
      {/* Conexión */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">WhatsApp Business</CardTitle>
            {config?.is_enabled && <Badge className="ml-2">Activo</Badge>}
          </div>
          <CardDescription>Conecta tu número de WhatsApp Business (Meta Cloud API) para recibir y enviar mensajes desde el Chat.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div><Label>Integración activa</Label><p className="mt-1 text-xs text-muted-foreground">Recibe y envía mensajes por WhatsApp</p></div>
            <Switch checked={form.is_enabled} onCheckedChange={(v) => set("is_enabled", v)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Phone Number ID</Label>
              <Input value={form.phone_number_id} onChange={(e) => set("phone_number_id", e.target.value)} placeholder="123456789012345" />
            </div>
            <div className="space-y-1.5">
              <Label>Número visible</Label>
              <Input value={form.display_phone} onChange={(e) => set("display_phone", e.target.value)} placeholder="+34 600 000 000" />
            </div>
            <div className="space-y-1.5">
              <Label>Access Token permanente</Label>
              <Input type="password" value={form.access_token} onChange={(e) => set("access_token", e.target.value)} placeholder={config ? "•••••• (guardado — escribe para cambiarlo)" : "EAAG..."} autoComplete="new-password" />
              <p className="text-xs text-muted-foreground">Por seguridad, el token guardado no se muestra. Rellena solo para cambiarlo.</p>
            </div>
            <div className="space-y-1.5">
              <Label>App Secret de Meta</Label>
              <Input type="password" value={form.app_secret} onChange={(e) => set("app_secret", e.target.value)} placeholder={config ? "•••••• (guardado — escribe para cambiarlo)" : "b507b1..."} autoComplete="new-password" />
              <p className="text-xs text-muted-foreground">Verifica la firma de los mensajes entrantes de tu app (Meta → Configuración de la app → Básico).</p>
            </div>
            <div className="space-y-1.5">
              <Label>Token de verificación</Label>
              <Input value={form.verify_token} onChange={(e) => set("verify_token", e.target.value)} placeholder="token-secreto" />
            </div>
            <div className="space-y-1.5">
              <Label>URL del Webhook</Label>
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly className="bg-muted font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(webhookUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                  {copied ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-accent/50 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            En Meta → WhatsApp → Configuración: pega la URL del webhook, usa tu token de verificación y suscríbete al campo <strong>messages</strong>.
            <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline">Meta <ExternalLink className="h-3 w-3" /></a>
          </div>
        </CardContent>
      </Card>

      {/* Bot */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Bot y respuestas automáticas</CardTitle>
          </div>
          <CardDescription>Mensajes fijos del bot y plantillas. Variables disponibles: <code>{"{{contacto}}"}</code>, <code>{"{{tarea}}"}</code>.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div><Label>Bot activo</Label><p className="mt-1 text-xs text-muted-foreground">Responde automáticamente y clasifica los mensajes entrantes</p></div>
            <Switch checked={form.bot_enabled} onCheckedChange={(v) => set("bot_enabled", v)} />
          </div>
          <div className="space-y-1.5"><Label>Mensaje de bienvenida</Label><Textarea rows={2} value={form.welcome_message} onChange={(e) => set("welcome_message", e.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Confirmación de solicitud (tarea creada)</Label><Textarea rows={2} value={form.task_ack_message} onChange={(e) => set("task_ack_message", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Sin intención reconocida</Label><Textarea rows={2} value={form.fallback_message} onChange={(e) => set("fallback_message", e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Plantilla "tarea completada"</Label><Textarea rows={2} value={form.task_completed_template} onChange={(e) => set("task_completed_template", e.target.value)} /></div>
          <div className="space-y-1.5 sm:max-w-xs">
            <Label>Responsable por defecto</Label>
            <Select value={form.default_assignee || "NONE"} onValueChange={(v) => set("default_assignee", v === "NONE" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Sin asignar</SelectItem>
                {team.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Intenciones */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Intenciones (reglas del bot)</CardTitle>
          <CardDescription>El bot clasifica cada mensaje por palabras clave. Si la intención crea tarea, se registra en Tareas y se asigna.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {intents.map((it: any) => (
            <div key={it.id} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Input defaultValue={it.name} onBlur={(e) => e.target.value !== it.name && intentMut.mutate({ type: "update", row: { ...it, name: e.target.value } })} className="h-9 max-w-xs font-medium" />
                <Select value={it.kind} onValueChange={(v) => intentMut.mutate({ type: "update", row: { ...it, kind: v, creates_task: v === "TASK" ? true : it.creates_task } })}>
                  <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(KIND_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Crea tarea</span>
                  <Switch checked={it.creates_task} onCheckedChange={(v) => intentMut.mutate({ type: "update", row: { ...it, creates_task: v } })} />
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setIntentToDelete(it)} aria-label="Eliminar intención"><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input defaultValue={(it.keywords || []).join(", ")} placeholder="palabras clave (separadas por comas)"
                  onBlur={(e) => intentMut.mutate({ type: "update", row: { ...it, keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } })} className="h-9" />
                {it.creates_task ? (
                  <Select value={it.assignee || "NONE"} onValueChange={(v) => intentMut.mutate({ type: "update", row: { ...it, assignee: v === "NONE" ? null : v } })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Asignar a (por defecto)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Responsable por defecto</SelectItem>
                      {team.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input defaultValue={it.auto_reply || ""} placeholder="respuesta automática (opcional)"
                    onBlur={(e) => intentMut.mutate({ type: "update", row: { ...it, auto_reply: e.target.value } })} className="h-9" />
                )}
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => intentMut.mutate({ type: "add" })}><Plus className="mr-1 h-3.5 w-3.5" /> Añadir intención</Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-1.5"><Save className="h-4 w-4" />{saving ? "Guardando..." : "Guardar configuración"}</Button>
      </div>

      <AlertDialog open={!!intentToDelete} onOpenChange={(o) => !o && setIntentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta intención?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{intentToDelete?.name}" y el bot dejará de aplicar sus reglas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (intentToDelete) intentMut.mutate({ type: "delete", row: intentToDelete }); setIntentToDelete(null); }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WhatsAppConfigTab;
