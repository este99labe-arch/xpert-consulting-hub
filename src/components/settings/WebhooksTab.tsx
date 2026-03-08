import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, Webhook, Pencil, Trash2, Pause, Play, ChevronDown, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { WEBHOOK_EVENTS } from "@/lib/webhooks";

interface WebhooksTabProps {
  accountId: string;
  isManager: boolean;
}

const emptyForm = {
  name: "",
  url: "",
  secret: "",
  events: [] as string[],
  is_active: true,
};

const WebhooksTab = ({ accountId, isManager }: WebhooksTabProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [logsWebhookId, setLogsWebhookId] = useState<string | null>(null);

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ["webhooks", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhooks")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["webhook-logs", logsWebhookId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_logs")
        .select("*")
        .eq("webhook_id", logsWebhookId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!logsWebhookId,
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (w: any) => {
    setEditingId(w.id);
    setForm({
      name: w.name,
      url: w.url,
      secret: w.secret || "",
      events: w.events || [],
      is_active: w.is_active,
    });
    setDialogOpen(true);
  };

  const toggleEvent = (event: string) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(event)
        ? f.events.filter((e) => e !== event)
        : [...f.events, event],
    }));
  };

  const handleSave = async () => {
    if (!form.url.trim() || form.events.length === 0) {
      toast({ title: "Error", description: "URL y al menos un evento son obligatorios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        account_id: accountId,
        name: form.name,
        url: form.url.trim(),
        secret: form.secret,
        events: form.events,
        is_active: form.is_active,
        created_by: user!.id,
        updated_at: new Date().toISOString(),
      };
      if (editingId) {
        const { error } = await supabase.from("webhooks").update(payload).eq("id", editingId);
        if (error) throw error;
        toast({ title: "Webhook actualizado" });
      } else {
        const { error } = await supabase.from("webhooks").insert(payload);
        if (error) throw error;
        toast({ title: "Webhook creado" });
      }
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from("webhooks").delete().eq("id", deleteId);
      if (error) throw error;
      toast({ title: "Webhook eliminado" });
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase.from("webhooks").update({ is_active: !current, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      toast({ title: !current ? "Webhook activado" : "Webhook pausado" });
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Webhook className="h-4 w-4" /> Webhooks
            </CardTitle>
            <CardDescription>
              Notifica a sistemas externos cuando ocurren eventos en tu cuenta.
            </CardDescription>
          </div>
          {isManager && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Nuevo webhook
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Cargando...</p>
          ) : webhooks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No hay webhooks configurados</p>
          ) : (
            <div className="space-y-3">
              {webhooks.map((w: any) => (
                <Collapsible key={w.id}>
                  <div className="rounded-lg border bg-background">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <Badge variant={w.is_active ? "default" : "secondary"} className="shrink-0">
                          {w.is_active ? "Activo" : "Pausado"}
                        </Badge>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{w.name || w.url}</div>
                          <div className="text-xs text-muted-foreground truncate">{w.url}</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(w.events || []).map((e: string) => (
                              <Badge key={e} variant="outline" className="text-xs">{e}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLogsWebhookId(w.id)}>
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </CollapsibleTrigger>
                        {isManager && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActive(w.id, w.is_active)}>
                              {w.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(w)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(w.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <CollapsibleContent>
                      <div className="border-t px-4 py-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Últimas entregas</p>
                        {logsWebhookId === w.id && logs.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Sin entregas todavía</p>
                        ) : logsWebhookId === w.id ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Estado</TableHead>
                                <TableHead className="text-xs">Evento</TableHead>
                                <TableHead className="text-xs">Código</TableHead>
                                <TableHead className="text-xs">Duración</TableHead>
                                <TableHead className="text-xs">Fecha</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {logs.slice(0, 10).map((log: any) => (
                                <TableRow key={log.id}>
                                  <TableCell>
                                    {log.success
                                      ? <CheckCircle2 className="h-4 w-4 text-primary" />
                                      : <XCircle className="h-4 w-4 text-destructive" />
                                    }
                                  </TableCell>
                                  <TableCell className="text-xs">{log.event}</TableCell>
                                  <TableCell className="text-xs font-mono">{log.response_status || "—"}</TableCell>
                                  <TableCell className="text-xs">{log.duration_ms}ms</TableCell>
                                  <TableCell className="text-xs whitespace-nowrap">
                                    {format(new Date(log.created_at), "dd MMM HH:mm:ss", { locale: es })}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : null}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar webhook" : "Nuevo webhook"}</DialogTitle>
            <DialogDescription>
              Configura la URL y los eventos que activarán este webhook.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Notificar CRM" />
            </div>
            <div>
              <Label>URL *</Label>
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/webhook" />
            </div>
            <div>
              <Label>Secret (para firma HMAC)</Label>
              <Input value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} placeholder="Opcional — se usará para firmar las peticiones" />
              <p className="text-xs text-muted-foreground mt-1">Si se proporciona, cada entrega incluirá un header <code>X-Webhook-Signature</code> con la firma SHA-256.</p>
            </div>
            <div>
              <Label className="mb-2 block">Eventos *</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {WEBHOOK_EVENTS.map((evt) => (
                  <label key={evt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={form.events.includes(evt.value)}
                      onCheckedChange={() => toggleEvent(evt.value)}
                    />
                    {evt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : editingId ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán el webhook y todo su historial de entregas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default WebhooksTab;
