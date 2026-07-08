import { useState, useEffect, useRef } from "react";
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
import FormSection from "@/components/shared/FormSection";
import { ListTodo, FileText, SlidersHorizontal, Link2, Copy, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultClientId?: string;
  boardId?: string;
}

type DraftLink = { entity_type: LinkEntityType; entity_id: string; entity_label: string | null };

const CreateTaskDialog = ({ open, onOpenChange, defaultClientId, boardId }: Props) => {
  const { user, accountId } = useAuth();
  const { data: members = [] } = useTeamMembers();
  const { data: clients = [] } = useClientsLite();
  const { data: columns = [] } = useTaskColumns(boardId);
  const { create } = useTaskMutations();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [assignedTo, setAssignedTo] = useState<string>("NONE");
  const [columnId, setColumnId] = useState<string>("");
  const [draftLinks, setDraftLinks] = useState<DraftLink[]>([]);
  const keepOpenRef = useRef(false);
  const [remindAt, setRemindAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 16);
  });

  useEffect(() => {
    // Al abrir o cambiar de tablero, asegura que la columna elegida pertenece al tablero activo
    if (open && columns.length && !columns.some((c) => c.id === columnId)) setColumnId(columns[0].id);
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

  const submit = async (keepOpen = false) => {
    if (!title.trim() || !user || !accountId) return;
    keepOpenRef.current = keepOpen;
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
          if (keepOpenRef.current) {
            reset();
          } else {
            onOpenChange(false);
            reset();
          }
          keepOpenRef.current = false;
        },
      }
    );
  };

  const canSubmit = !!title.trim() && !create.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 space-y-0 border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ListTodo className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Nueva tarea</DialogTitle>
              <p className="text-sm text-muted-foreground">Crea una tarea y vincúlala a clientes o documentos</p>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto bg-muted/30 px-6 py-5">
          <FormSection icon={FileText} title="Detalles" desc="Qué hay que hacer">
            <div className="space-y-1.5">
              <Label>Título <span className="text-destructive">*</span></Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="Ej: Preparar propuesta para cliente" />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Detalles, contexto o checklist..." />
            </div>
          </FormSection>

          <FormSection icon={SlidersHorizontal} title="Organización" desc="Prioridad, estado, responsable y fecha">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
                <Label>Fecha límite</Label>
                <Input type="datetime-local" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} />
              </div>
            </div>
          </FormSection>

          <FormSection icon={Link2} title="Vinculaciones" desc="Relaciona la tarea con clientes, facturas u otros registros">
            <TaskLinksManager
              draftLinks={draftLinks}
              onDraftChange={setDraftLinks}
            />
          </FormSection>
        </div>

        {/* Sticky footer */}
        <DialogFooter className="flex-shrink-0 flex-row items-center justify-end gap-2 border-t border-border bg-background px-6 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancelar</Button>
          <Button variant="outline" onClick={() => submit(true)} disabled={!canSubmit} className="hidden sm:inline-flex">
            <Copy className="mr-1.5 h-4 w-4" /> Guardar y crear otra
          </Button>
          <Button onClick={() => submit(false)} disabled={!canSubmit}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskDialog;
