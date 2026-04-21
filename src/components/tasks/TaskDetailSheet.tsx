import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Archive, Trash2, X, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTaskMutations, useTaskComments, useTaskActivity } from "./hooks";
import { PRIORITIES, ENTITY_META, getPriorityMeta, initials, type Task, type TaskColumn } from "./types";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";

interface Props {
  task: Task | null;
  columns: TaskColumn[];
  members: { user_id: string; name: string }[];
  clients: { id: string; name: string }[];
  onClose: () => void;
}

const ENTITY_OPTIONS: { value: string; label: string }[] = [
  { value: "NONE", label: "Ninguna" },
  { value: "CLIENT", label: "Cliente" },
  { value: "INVOICE", label: "Factura" },
  { value: "EXPENSE", label: "Gasto" },
  { value: "JOURNAL_ENTRY", label: "Asiento" },
  { value: "QUOTE", label: "Presupuesto" },
];

const TaskDetailSheet = ({ task, columns, members, clients, onClose }: Props) => {
  const { user } = useAuth();
  const { update, archive, remove } = useTaskMutations();
  const { list: commentsQ, add: addComment, remove: removeComment } = useTaskComments(task?.id);
  const { data: activity = [] } = useTaskActivity(task?.id);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [comment, setComment] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
    }
  }, [task]);

  if (!task) return null;

  const saveTitle = () => {
    if (title.trim() && title !== task.title) {
      update.mutate({ id: task.id, updates: { title: title.trim() } });
    }
  };
  const saveDescription = () => {
    if (description !== (task.description || "")) {
      update.mutate({ id: task.id, updates: { description } });
    }
  };

  const addLabel = () => {
    const v = labelInput.trim();
    if (!v) return;
    if ((task.labels || []).includes(v)) return;
    update.mutate({ id: task.id, updates: { labels: [...(task.labels || []), v] } });
    setLabelInput("");
  };

  const removeLabel = (l: string) => {
    update.mutate({ id: task.id, updates: { labels: (task.labels || []).filter((x) => x !== l) } });
  };

  const submitComment = () => {
    const v = comment.trim();
    if (!v) return;
    addComment.mutate(v, {
      onSuccess: () => {
        setComment("");
        toast({ title: "Comentario añadido" });
      },
    });
  };

  const prio = getPriorityMeta(task.priority);
  const PrioIcon = prio.icon;
  const dueDate = task.remind_at ? format(new Date(task.remind_at), "yyyy-MM-dd'T'HH:mm") : "";

  const fieldLabel = (f: string) => {
    const map: Record<string, string> = {
      title: "Título", status: "Estado", column: "Columna", priority: "Prioridad",
      assigned_to: "Asignado", archived: "Archivada", created: "Creada",
    };
    return map[f] || f;
  };

  const memberName = (id: string | null) =>
    id ? members.find((m) => m.user_id === id)?.name || "Usuario" : "—";

  return (
    <Sheet open={!!task} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className={prio.textClass}>
              <PrioIcon className={`h-3 w-3 mr-1 ${prio.color}`} /> {prio.label}
            </Badge>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => archive.mutate(task.id, { onSuccess: onClose })}>
                <Archive className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
          <SheetTitle className="sr-only">Detalle tarea</SheetTitle>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="text-lg font-semibold border-0 px-0 focus-visible:ring-0 shadow-none"
          />
        </SheetHeader>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <Label className="text-xs">Columna</Label>
            <Select
              value={task.column_id || ""}
              onValueChange={(v) => update.mutate({ id: task.id, updates: { column_id: v } })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {columns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Prioridad</Label>
            <Select
              value={task.priority}
              onValueChange={(v) => update.mutate({ id: task.id, updates: { priority: v as any } })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => {
                  const I = p.icon;
                  return (
                    <SelectItem key={p.value} value={p.value}>
                      <span className="flex items-center gap-2">
                        <I className={`h-3.5 w-3.5 ${p.color}`} />{p.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Asignado</Label>
            <Select
              value={task.assigned_to || "NONE"}
              onValueChange={(v) =>
                update.mutate({ id: task.id, updates: { assigned_to: v === "NONE" ? null : v } })
              }
            >
              <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Sin asignar</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Fecha límite</Label>
            <Input
              type="datetime-local"
              defaultValue={dueDate}
              onBlur={(e) => {
                const v = e.target.value;
                if (v) update.mutate({ id: task.id, updates: { remind_at: new Date(v).toISOString() } });
              }}
            />
          </div>
          <div>
            <Label className="text-xs">Tipo entidad</Label>
            <Select
              value={task.entity_type || "NONE"}
              onValueChange={(v) =>
                update.mutate({
                  id: task.id,
                  updates: {
                    entity_type: v === "NONE" ? null : (v as any),
                    entity_id: v === "NONE" ? null : task.entity_id,
                    client_id: v === "CLIENT" ? task.client_id : null,
                  },
                })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ENTITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {task.entity_type === "CLIENT" && (
            <div>
              <Label className="text-xs">Cliente</Label>
              <Select
                value={task.client_id || "NONE"}
                onValueChange={(v) =>
                  update.mutate({
                    id: task.id,
                    updates: {
                      client_id: v === "NONE" ? null : v,
                      entity_id: v === "NONE" ? null : v,
                      entity_label: v === "NONE" ? null : clients.find((c) => c.id === v)?.name || null,
                    },
                  })
                }
              >
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Ninguno</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="mt-4">
          <Label className="text-xs">Descripción</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
            placeholder="Añade una descripción..."
            rows={4}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Soporta texto plano. Cambios se guardan al salir del campo.
          </p>
        </div>

        <div className="mt-4">
          <Label className="text-xs">Etiquetas</Label>
          <div className="flex flex-wrap gap-1.5 items-center">
            {(task.labels || []).map((l) => (
              <Badge key={l} variant="secondary" className="gap-1">
                {l}
                <button onClick={() => removeLabel(l)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Input
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLabel())}
              placeholder="Añadir etiqueta..."
              className="h-7 w-32 text-xs"
            />
          </div>
        </div>

        <Separator className="my-5" />

        <Tabs defaultValue="comments">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="comments">Comentarios ({(commentsQ.data || []).length})</TabsTrigger>
            <TabsTrigger value="activity">Historial ({activity.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="comments" className="space-y-3 mt-4">
            <div className="flex gap-2">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Escribe un comentario..."
                rows={2}
                className="text-sm"
              />
              <Button size="icon" onClick={submitComment} disabled={!comment.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {(commentsQ.data || []).map((c) => {
                const author = members.find((m) => m.user_id === c.author_id);
                return (
                  <div key={c.id} className="flex gap-2 p-2 rounded bg-muted/40">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-[10px]">{initials(author?.name || "??")}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium">{author?.name || "Usuario"}</p>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(c.created_at), "dd MMM HH:mm", { locale: es })}
                          </span>
                          {c.author_id === user?.id && (
                            <button
                              onClick={() => removeComment.mutate(c.id)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm break-words whitespace-pre-wrap mt-0.5">{c.content}</p>
                    </div>
                  </div>
                );
              })}
              {(commentsQ.data || []).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Sin comentarios</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <div className="space-y-2">
              {activity.map((a) => {
                const isAssign = a.field_name === "assigned_to";
                const oldVal = isAssign ? memberName(a.old_value) : a.old_value;
                const newVal = isAssign ? memberName(a.new_value) : a.new_value;
                const author = members.find((m) => m.user_id === a.user_id);
                return (
                  <div key={a.id} className="text-xs border-l-2 border-muted pl-3 py-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{author?.name || "Sistema"}</span>
                      <span className="text-muted-foreground">
                        {format(new Date(a.created_at), "dd MMM HH:mm", { locale: es })}
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      cambió <strong>{fieldLabel(a.field_name)}</strong>
                      {oldVal && newVal ? (
                        <> de <em>{oldVal}</em> a <em>{newVal}</em></>
                      ) : newVal ? (
                        <> a <em>{newVal}</em></>
                      ) : null}
                    </p>
                  </div>
                );
              })}
              {activity.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Sin actividad</p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DeleteConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Eliminar tarea"
          description="¿Seguro que quieres eliminar esta tarea? Esta acción no se puede deshacer."
          onConfirm={() => remove.mutate(task.id, { onSuccess: onClose })}
        />
      </SheetContent>
    </Sheet>
  );
};

export default TaskDetailSheet;
