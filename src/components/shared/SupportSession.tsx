import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LifeBuoy, LogOut, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

/**
 * Entrada a una cuenta cliente para dar soporte (solo MASTER_ADMIN).
 *
 * Al confirmar, la sesión queda registrada en audit_logs y toda la app pasa a
 * operar dentro de esa cuenta, porque `get_user_account_id()` —de la que
 * dependen las políticas RLS— devuelve la cuenta suplantada.
 */
export const SupportAccountSwitcher = () => {
  const { role, realAccountId, supportSession, startSupportSession } = useAuth();
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const isMaster = role === "MASTER_ADMIN";

  const { data: accounts = [] } = useQuery({
    queryKey: ["support-switchable-accounts", realAccountId],
    queryFn: async () => {
      const { data } = await supabase
        .from("accounts")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      // La cuenta propia no es "soporte": se excluye del listado.
      return (data || []).filter((a) => a.id !== realAccountId);
    },
    enabled: isMaster && open,
  });

  // Sin permisos o ya dentro de una cuenta: no se ofrece el acceso.
  if (!isMaster || supportSession) return null;

  const handleStart = async () => {
    if (!accountId) return;
    setSaving(true);
    try {
      await startSupportSession(accountId, reason.trim() || undefined);
      const name = accounts.find((a) => a.id === accountId)?.name ?? "la cuenta";
      toast({ title: `Has entrado en ${name}`, description: "El acceso ha quedado registrado." });
      setOpen(false);
      setAccountId("");
      setReason("");
    } catch (err: any) {
      toast({ title: "No se pudo iniciar el soporte", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <LifeBuoy className="h-4 w-4" />
        <span className="hidden sm:inline">Entrar en una cuenta</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entrar en una cuenta cliente</DialogTitle>
            <DialogDescription>
              Verás y podrás modificar los datos de la cuenta como si estuvieras dentro de ella.
              El acceso queda registrado y caduca automáticamente a las 8 horas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Cuenta</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Selecciona una cuenta…" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Motivo del acceso</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej.: incidencia con la factura F-2026-014"
              />
              <p className="text-xs text-muted-foreground">
                Se guarda en el registro de auditoría para justificar el acceso a datos del cliente.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleStart} disabled={!accountId || saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

/**
 * Aviso permanente mientras se está dentro de una cuenta cliente. Es
 * deliberadamente llamativo: evita confundir los datos del cliente con los propios.
 */
export const SupportSessionBanner = () => {
  const { supportSession, endSupportSession } = useAuth();
  const [leaving, setLeaving] = useState(false);

  if (!supportSession) return null;

  const handleEnd = async () => {
    setLeaving(true);
    try {
      await endSupportSession();
      toast({ title: "Has salido de la cuenta de soporte" });
    } catch (err: any) {
      toast({ title: "No se pudo salir", description: err.message, variant: "destructive" });
    } finally {
      setLeaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/10 px-6 py-2">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <LifeBuoy className="h-4 w-4 shrink-0 text-[hsl(var(--warning))]" />
        <span className="truncate">
          Sesión de soporte en <strong>{supportSession.accountName}</strong>
          {supportSession.reason && (
            <span className="text-muted-foreground"> · {supportSession.reason}</span>
          )}
        </span>
      </div>
      <Button size="sm" variant="outline" onClick={handleEnd} disabled={leaving} className="gap-1.5">
        {leaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
        Salir de la cuenta
      </Button>
    </div>
  );
};
