import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTaskMutations, useTeamMembers, useClientsLite, useTaskColumns } from "./hooks";
import { PRIORITIES } from "./types";
import TaskLinksManager, { type LinkEntityType } from "./TaskLinksManager";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultClientId?: string;
}

type DraftLink = { entity_type: LinkEntityType; entity_id: string; entity_label: string | null };

const CreateTaskDialog = ({ open, onOpenChange, defaultClientId }: Props) => {
  const { user, accountId } = useAuth();
  const { data: members = [] } = useTeamMembers();
  const { data: clients = [] } = useClientsLite();
  const { data: columns = [] } = useTaskColumns();
  const { create } = useTaskMutations();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [assignedTo, setAssignedTo] = useState<string>("NONE");
  const [columnId, setColumnId] = useState<string>("");
  const [draftLinks, setDraftLinks] = useState<DraftLink[]>([]);
  const [remindAt, setRemindAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 16);
  });

  useEffect(() => {
    if (open && columns.length && !columnId) setColumnId(columns[0].id);
  }, [open, columns, columnId]);

  useEffect(() => {
    if (open && defaultClientId && draftLinks.length === 0) {
      const c = clients.find((x) => x.id === defaultClientId);
      setDraftLinks([{ entity_type: "CLIENT", entity_id: defaultClientId, entity_label: c?.name || null }]);
    }
  }, [open, defaultClientId, clients]);

  const reset = () => {
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setAssignedTo("NONE");
    setDraftLinks([]);
  };

  const submit = async () => {
    if (!title.trim() || !user || !accountId) return;
    // Keep legacy single-link fields synced from the first CLIENT link (for backwards-compat queries)
    const firstClient = draftLinks.find((l) => l.entity_type === "CLIENT");
    const firstAny = draftLinks[0];

    create.mutate(
      {
        title: title.trim(),
        description,
        priority: priority as any,
        assigned_to: assignedTo === "NONE" ? null : assignedTo,
        client_id: firstClient?.entity_id || null,
        column_id: columnId || null,
        remind_at: new Date(remindAt).toISOString(),
        entity_type: (firstAny?.entity_type as any) || null,
        entity_id: firstAny?.entity_id || null,
        entity_label: firstAny?.entity_label || null,
      },
      {
        onSuccess: async (created: any) => {
          // Persist all links into task_links
          if (created?.id && draftLinks.length > 0) {
            const rows = draftLinks.map((l) => ({
              account_id: accountId,
              task_id: created.id,
              created_by: user.id,
              entity_type: l.entity_type,
              entity_id: l.entity_id,
              entity_label: l.entity_label,
            }));
            const { error } = await supabase.from("task_links").insert(rows as any);
            if (error) {
              toast({ title: "Tarea creada, pero falló alguna vinculación", description: error.message, variant: "destructive" });
            }
          }
          onOpenChange(false);
          reset();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Columna</Label>
              <Select value={columnId} onValueChange={setColumnId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {columns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Asignado</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Sin asignar</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha límite</Label>
              <Input type="datetime-local" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} />
            </div>
          </div>

          <div className="border-t pt-3">
            <TaskLinksManager
              draftLinks={draftLinks}
              onDraftChange={setDraftLinks}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!title.trim() || create.isPending}>Crear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskDialog;
