import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { GraduationCap, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  message: { id: string; body: string | null; conversation_id?: string } | null;
  conversationId: string | null;
}

const ACTIONS = [
  { value: "CREATE_TASK", label: "Debió crear una tarea" },
  { value: "NO_TASK", label: "NO debió crear tarea" },
  { value: "REPLY_ONLY", label: "Solo debió responder (sin tarea)" },
];

/**
 * Envía una corrección sobre la decisión del bot para un mensaje. Las
 * correcciones activas se inyectan en el clasificador de cada mensaje futuro.
 */
const BotFeedbackDialog = ({ open, onOpenChange, message, conversationId }: Props) => {
  const { user, accountId } = useAuth();
  const qc = useQueryClient();
  const [action, setAction] = useState("CREATE_TASK");
  const [intentId, setIntentId] = useState("NONE");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (open) { setAction("CREATE_TASK"); setIntentId("NONE"); setComment(""); }
  }, [open]);

  const { data: intents = [] } = useQuery({
    queryKey: ["feedback-intents", accountId],
    queryFn: async () => {
      const { data } = await supabase.from("chat_intents")
        .select("id, name").eq("account_id", accountId!).eq("is_active", true).order("sort_order");
      return data || [];
    },
    enabled: !!accountId && open,
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!message?.body?.trim()) throw new Error("El mensaje no tiene texto");
      const { error } = await (supabase.from("chat_bot_feedback") as any).insert({
        account_id: accountId,
        conversation_id: conversationId,
        message_id: message.id,
        message_text: message.body.trim(),
        expected_action: action,
        expected_intent_id: action === "CREATE_TASK" && intentId !== "NONE" ? intentId : null,
        comment: comment.trim() || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bot-feedback", accountId] });
      onOpenChange(false);
      toast({
        title: "Corrección enviada",
        description: "El bot la tendrá en cuenta a partir de ahora. Puedes gestionarlas en Configuración → WhatsApp.",
      });
    },
    onError: (e: any) => toast({ title: "No se pudo enviar", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" /> Enseñar al bot
          </DialogTitle>
          <DialogDescription>
            Indica qué debería haber hecho el bot con este mensaje. La corrección se aplica a mensajes futuros parecidos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <blockquote className="rounded-lg border-l-2 border-primary bg-muted/50 px-3 py-2 text-sm italic">
            "{(message?.body || "").slice(0, 200)}"
          </blockquote>

          <div className="space-y-1.5">
            <Label>¿Qué debió hacer el bot?</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {action === "CREATE_TASK" && (
            <div className="space-y-1.5">
              <Label>Intención correcta (opcional)</Label>
              <Select value={intentId} onValueChange={setIntentId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Sin especificar</SelectItem>
                  {intents.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Comentario (por qué / matices)</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder='Ej.: "post" en nuestra empresa siempre es trabajo de redes sociales'
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
            {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar corrección
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BotFeedbackDialog;
