import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface CreateReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEntityType?: string;
  defaultEntityId?: string;
  defaultEntityLabel?: string;
}

const entityTypeLabels: Record<string, string> = {
  CLIENT: "Cliente",
  INVOICE: "Factura",
  QUOTE: "Presupuesto",
  EXPENSE: "Gasto",
  JOURNAL_ENTRY: "Asiento contable",
  ATTENDANCE: "Asistencia",
  OTHER: "Otro",
};

const CreateReminderDialog = ({
  open,
  onOpenChange,
  defaultEntityType,
  defaultEntityId,
  defaultEntityLabel,
}: CreateReminderDialogProps) => {
  const { user, accountId } = useAuth();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [entityType, setEntityType] = useState(defaultEntityType || "");
  const [entityId] = useState(defaultEntityId || "");
  const [entityLabel] = useState(defaultEntityLabel || "");

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setRemindAt("");
    setEntityType(defaultEntityType || "");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("reminders").insert({
        account_id: accountId!,
        created_by: user!.id,
        title,
        description,
        remind_at: new Date(remindAt).toISOString(),
        entity_type: entityType || null,
        entity_id: entityId || null,
        entity_label: entityLabel || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Recordatorio creado", description: `Se te notificará el ${format(new Date(remindAt), "dd/MM/yyyy HH:mm")}` });
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      resetForm();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear el recordatorio", variant: "destructive" });
    },
  });

  const canSubmit = title.trim() && remindAt && new Date(remindAt) > new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Nuevo Recordatorio
          </DialogTitle>
          <DialogDescription>
            Configura una alerta que aparecerá en tus notificaciones.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reminder-title">Título *</Label>
            <Input
              id="reminder-title"
              placeholder="Ej: Revisar factura pendiente"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reminder-desc">Descripción</Label>
            <Textarea
              id="reminder-desc"
              placeholder="Detalles adicionales..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reminder-date">Fecha y hora del recordatorio *</Label>
            <Input
              id="reminder-date"
              type="datetime-local"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
              min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
            />
          </div>

          {defaultEntityLabel && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <span className="text-muted-foreground">Vinculado a: </span>
              <span className="font-medium">{entityTypeLabels[defaultEntityType || ""] || defaultEntityType} — {defaultEntityLabel}</span>
            </div>
          )}

          {!defaultEntityType && (
            <div className="space-y-1.5">
              <Label>Categoría (opcional)</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {Object.entries(entityTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Crear Recordatorio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateReminderDialog;
