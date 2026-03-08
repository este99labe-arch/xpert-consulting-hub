import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Copy, Key, Trash2, Ban, Check } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

interface ApiKeysTabProps {
  accountId: string;
  isManager: boolean;
}

const ApiKeysTab = ({ accountId, isManager }: ApiKeysTabProps) => {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ["api-keys", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_keys")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const callManageKeys = async (body: Record<string, string>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("No autenticado");
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const res = await fetch(`https://${projectId}.supabase.co/functions/v1/manage_api_keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error");
    return data;
  };

  const handleGenerate = async () => {
    if (!keyName.trim()) {
      toast({ title: "Error", description: "Introduce un nombre para la clave", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const data = await callManageKeys({ action: "generate", name: keyName.trim() });
      setNewKey(data.api_key);
      setCopied(false);
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast({ title: "Clave API generada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeId) return;
    try {
      await callManageKeys({ action: "revoke", key_id: revokeId });
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast({ title: "Clave revocada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setRevokeId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await callManageKeys({ action: "delete", key_id: deleteId });
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast({ title: "Clave eliminada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copiado al portapapeles" });
    setTimeout(() => setCopied(false), 2000);
  };

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const apiBaseUrl = `https://${projectId}.supabase.co/functions/v1/public_api`;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4" /> Claves API
            </CardTitle>
            <CardDescription>
              Gestiona las claves para acceder a la API pública de tu cuenta.
            </CardDescription>
          </div>
          {isManager && (
            <Button size="sm" onClick={() => { setKeyName(""); setNewKey(null); setCreateOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nueva clave
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* API docs hint */}
          <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
            <p className="font-medium text-foreground">Endpoint base</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono flex-1 truncate">{apiBaseUrl}</code>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(apiBaseUrl)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Endpoints: <code>/clients</code>, <code>/invoices</code>, <code>/products</code> — Usa <code>Authorization: Bearer &lt;api_key&gt;</code>
            </p>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Cargando...</p>
          ) : apiKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No hay claves API configuradas</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Clave</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creada</TableHead>
                  <TableHead>Último uso</TableHead>
                  {isManager && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((k: any) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name || "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{k.key_prefix}</TableCell>
                    <TableCell>
                      <Badge variant={k.is_active ? "default" : "secondary"}>
                        {k.is_active ? "Activa" : "Revocada"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(k.created_at), "dd MMM yyyy", { locale: es })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {k.last_used_at ? format(new Date(k.last_used_at), "dd MMM yyyy HH:mm", { locale: es }) : "Nunca"}
                    </TableCell>
                    {isManager && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {k.is_active && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRevokeId(k.id)} title="Revocar">
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(k.id)} title="Eliminar">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Generate dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o && !newKey) setCreateOpen(false); if (!o && newKey) { setCreateOpen(false); setNewKey(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{newKey ? "Clave API generada" : "Nueva clave API"}</DialogTitle>
            <DialogDescription>
              {newKey
                ? "Copia esta clave ahora. No podrás verla de nuevo."
                : "Asigna un nombre descriptivo a la clave para identificarla."
              }
            </DialogDescription>
          </DialogHeader>
          {newKey ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono break-all flex-1">{newKey}</code>
                  <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyToClipboard(newKey)}>
                    {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-destructive font-medium">
                ⚠️ Guarda esta clave en un lugar seguro. No se mostrará de nuevo.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Nombre</Label>
                <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="Ej: Integración CRM, App móvil..." />
              </div>
            </div>
          )}
          <DialogFooter>
            {newKey ? (
              <Button onClick={() => { setCreateOpen(false); setNewKey(null); }}>Cerrar</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button onClick={handleGenerate} disabled={saving}>
                  {saving ? "Generando..." : "Generar clave"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <AlertDialog open={!!revokeId} onOpenChange={(o) => { if (!o) setRevokeId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Revocar esta clave?</AlertDialogTitle>
            <AlertDialogDescription>
              La clave dejará de funcionar inmediatamente. Las aplicaciones que la usen dejarán de tener acceso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke}>Revocar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta clave?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente el registro de esta clave API.
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

export default ApiKeysTab;
