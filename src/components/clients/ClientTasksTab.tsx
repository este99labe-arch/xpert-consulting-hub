import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { format, isPast } from "date-fns";
import { es } from "date-fns/locale";
import { useTasks, useTeamMembers, useTaskColumns, useClientsLite } from "@/components/tasks/hooks";
import { getPriorityMeta, initials, type Task } from "@/components/tasks/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import CreateTaskDialog from "@/components/tasks/CreateTaskDialog";
import TaskDetailSheet from "@/components/tasks/TaskDetailSheet";

const ClientTasksTab = ({ clientId }: { clientId: string }) => {
  const { data: tasks = [] } = useTasks({ clientId });
  const { data: members = [] } = useTeamMembers();
  const { data: columns = [] } = useTaskColumns();
  const { data: clients = [] } = useClientsLite();
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Task | null>(null);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Tareas asociadas ({tasks.length})</h3>
          <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Nueva tarea
          </Button>
        </div>
        <div className="space-y-2">
          {tasks.map((t) => {
            const prio = getPriorityMeta(t.priority);
            const PrioIcon = prio.icon;
            const assignee = members.find((m) => m.user_id === t.assigned_to);
            const overdue = isPast(new Date(t.remind_at)) && !t.is_completed;
            const col = columns.find((c) => c.id === t.column_id);
            return (
              <div
                key={t.id}
                onClick={() => setSelected(t)}
                className="flex items-center gap-3 p-2.5 rounded border hover:bg-accent/40 cursor-pointer"
              >
                <PrioIcon className={`h-4 w-4 shrink-0 ${prio.color}`} />
                <span className="font-medium flex-1 truncate text-sm">{t.title}</span>
                {col && (
                  <Badge variant="outline" className="text-[10px]">
                    <span className="h-1.5 w-1.5 rounded-full mr-1.5" style={{ background: col.color }} />
                    {col.name}
                  </Badge>
                )}
                <span className={`text-xs ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {format(new Date(t.remind_at), "dd MMM", { locale: es })}
                </span>
                {assignee && (
                  <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{initials(assignee.name)}</AvatarFallback></Avatar>
                )}
              </div>
            );
          })}
          {tasks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Sin tareas para este cliente</p>
          )}
        </div>
        <CreateTaskDialog open={showCreate} onOpenChange={setShowCreate} defaultClientId={clientId} />
        <TaskDetailSheet
          task={selected}
          columns={columns}
          members={members}
          clients={clients}
          onClose={() => setSelected(null)}
        />
      </CardContent>
    </Card>
  );
};

export default ClientTasksTab;
