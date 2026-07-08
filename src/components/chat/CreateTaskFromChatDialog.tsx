import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTaskBoards, useTaskColumns, useTeamMembers } from "@/components/tasks/hooks";
import { PRIORITIES } from "@/components/tasks/types";
import { toast } from "@/hooks/use-toast";
import { Building2, ListTodo, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  conversation: { id: string; client_id: string | null; display_name: string } | null;
  messages: { body: string | null; created_at: string }[];
  onCreated: () => void;
}

const CreateTaskFromChatDialog = ({ open, onOpenChange, conversation, messages, onCreated }: Props) => {
  const { user, accountId } = useAuth();
  const qc = useQueryClient();
  const { data: boards = [] } = useTaskBoards();
  const { data: members = [] } = useTeamMembers();

  const [boardId, setBoardId] = useState("");
  const activeBoard = boardId || boards[0]?.id || "";
  const { data: columns = [] } = useTaskColumns(activeBoard || undefined);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [columnId, setColumnId] = useState("");
  const [assignedTo, setAssignedTo] = useState("NONE");
  const [priority, setPriority] = useState("MEDIUM");
  const [hasDue, setHasDue] = useState(false);
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);

  const joined = useMemo(
    () => messages.map((m) => (m.body || "").trim()).filter(Boolean).join("\n"),
    [messages]
  );

  // Rellenar al abrir con el contenido de los mensajes seleccionados
  useEffect(() => {
    if (open) {
      setTitle(joined.slice(0, 80) || "Solicitud de cliente");
      setDescription(joined);
      setHasDue(false);
      setDueAt(new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 16));
    }
  }, [open, joined]);

  useEffect(() => {
    if (columns.length && !columns.some((c) => c.id === columnId)) setColumnId(columns[0].id);
  }, [columns, columnId]);

  const submit = async () => {
    if (!user || !accountId || !conversation || !title.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("reminders").insert({
        account_id: accountId,
        created_by: user.id,
        assigned_to: assignedTo === "NONE" ? null : assignedTo,
        title: title.trim(),
        description,
        priority,
        remind_at: hasDue && dueAt ? new Date(dueAt).toISOString() : null,
        column_id: columnId || null,
        client_id: conversation.client_id,
        origin: "CHAT",
        chat_conversation_id: conversation.id,
        entity_type: "CHAT",
        entity_id: conversation.id,
        entity_label: conversation.display_name,
      } as any);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["tasks", accountId] });
      toast({ title: "Tarea creada", description: "Asociada al cliente de esta conversación." });
      onCreated();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "No se pudo crear la tarea", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" /> Nueva tarea desde el chat
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {conversation && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Cliente:</span>
              <span className="font-medium">{conversation.display_name}</span>
              {!conversation.client_id && <span className="text-xs text-[hsl(var(--warning))]">(sin cliente vinculado)</span>}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Título <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Descripción (contenido de los mensajes)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tablero</Label>
              <Select value={activeBoard} onValueChange={setBoardId}>
                <SelectTrigger><SelectValue placeholder="Tablero" /></SelectTrigger>
                <SelectContent>
                  {boards.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Columna</Label>
              <Select value={columnId} onValueChange={setColumnId}>
                <SelectTrigger><SelectValue placeholder="Columna" /></SelectTrigger>
                <SelectContent>
                  {columns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Asignar a</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Sin asignar</SelectItem>
                  {members.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={hasDue} onCheckedChange={setHasDue} />
            <Label className="cursor-pointer">Fecha límite</Label>
            {hasDue && (
              <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="h-9 flex-1" />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={!title.trim() || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear tarea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskFromChatDialog;
