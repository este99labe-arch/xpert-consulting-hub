import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Palmtree, Plus, Loader2 } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

const TYPE_LABEL: Record<string, string> = { VACATION: "Vacaciones", SICK: "Baja médica", PERSONAL: "Asunto personal" };
const STATUS_VARIANT: Record<string, any> = { APPROVED: "default", PENDING: "outline", REJECTED: "destructive" };
const STATUS_LABEL: Record<string, string> = { APPROVED: "Aprobada", PENDING: "Pendiente", REJECTED: "Rechazada" };

const MyVacationsWidget = () => {
  const { user, accountId } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("VACATION");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: requests = [] } = useQuery({
    queryKey: ["my-leave", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("start_date", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: settings } = useQuery({
    queryKey: ["account-settings-leave", accountId],
    queryFn: async () => {
      const { data } = await supabase.from("account_settings").select("vacation_days_per_year").eq("account_id", accountId!).maybeSingle();
      return data;
    },
    enabled: !!accountId,
  });

  const yearStart = `${new Date().getFullYear()}-01-01`;
  const usedDays = requests
    .filter((r: any) => r.type === "VACATION" && r.status === "APPROVED" && r.start_date >= yearStart)
    .reduce((acc: number, r: any) => acc + (differenceInDays(parseISO(r.end_date), parseISO(r.start_date)) + 1), 0);
  const totalDays = settings?.vacation_days_per_year ?? 22;
  const available = totalDays - usedDays;

  const handleSubmit = async () => {
    if (!start || !end) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("leave_requests").insert({
        user_id: user!.id, account_id: accountId!, type, start_date: start, end_date: end,
      });
      if (error) throw error;
      toast({ title: "Solicitud enviada" });
      queryClient.invalidateQueries({ queryKey: ["my-leave"] });
      setOpen(false); setStart(""); setEnd(""); setType("VACATION");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <>
      <Card className="h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Palmtree className="h-4 w-4 text-primary" />
              Mis vacaciones
            </CardTitle>
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Solicitar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="rounded-lg bg-primary/5 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Disponibles</span>
              <span className="text-2xl font-bold text-primary">{available}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{usedDays} usados</span>
              <span>{totalDays} totales</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, (usedDays / totalDays) * 100)}%` }} />
            </div>
          </div>
          <div className="space-y-1.5">
            {requests.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">Sin solicitudes</p>
            ) : (
              requests.slice(0, 4).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-xs p-2 rounded-md border">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{TYPE_LABEL[r.type] || r.type}</p>
                    <p className="text-muted-foreground">
                      {format(parseISO(r.start_date), "dd MMM", { locale: es })} – {format(parseISO(r.end_date), "dd MMM", { locale: es })}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[r.status]} className="text-[10px] shrink-0">{STATUS_LABEL[r.status] || r.status}</Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Solicitar ausencia</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VACATION">Vacaciones</SelectItem>
                  <SelectItem value="SICK">Baja médica</SelectItem>
                  <SelectItem value="PERSONAL">Asunto personal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Inicio</Label>
                <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fin</Label>
                <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving || !start || !end}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MyVacationsWidget;
