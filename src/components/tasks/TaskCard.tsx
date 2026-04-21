import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, isPast, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ENTITY_META, getPriorityMeta, initials, type Task } from "./types";

interface Props {
  task: Task;
  members: { user_id: string; name: string }[];
  clients: { id: string; name: string }[];
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

const TaskCard = ({ task, members, clients, onClick, onDragStart }: Props) => {
  const due = new Date(task.remind_at);
  const overdue = isPast(due) && !task.is_completed;
  const soon = !overdue && differenceInDays(due, new Date()) <= 2;
  const prio = getPriorityMeta(task.priority);
  const PrioIcon = prio.icon;
  const assignee = members.find((m) => m.user_id === task.assigned_to);
  const client = clients.find((c) => c.id === task.client_id);
  const EntityIcon = task.entity_type ? ENTITY_META[task.entity_type]?.icon : null;
  const labels = task.labels || [];
  const visibleLabels = labels.slice(0, 2);
  const extraLabels = labels.length - visibleLabels.length;

  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={cn(
        "p-3 space-y-2 cursor-grab active:cursor-grabbing transition-all hover:shadow-md hover:border-primary/40",
        overdue && "border-destructive/40"
      )}
    >
      <div className="flex items-start gap-2">
        <PrioIcon className={cn("h-4 w-4 shrink-0 mt-0.5", prio.color)} aria-label={prio.label} />
        <p className="text-sm font-medium leading-tight flex-1 break-words">{task.title}</p>
      </div>

      {(client || task.entity_label) && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {EntityIcon && <EntityIcon className="h-3 w-3 shrink-0" />}
          <span className="truncate">{client?.name || task.entity_label}</span>
        </div>
      )}

      {visibleLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {visibleLabels.map((l) => (
            <Badge key={l} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{l}</Badge>
          ))}
          {extraLabels > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">+{extraLabels}</Badge>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <div className={cn(
          "flex items-center gap-1 text-[11px]",
          overdue ? "text-destructive font-medium" : soon ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"
        )}>
          <CalendarClock className="h-3 w-3" />
          {format(due, "dd MMM", { locale: es })}
        </div>
        {assignee ? (
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
              {initials(assignee.name)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <span className="text-[10px] text-muted-foreground italic">Sin asignar</span>
        )}
      </div>
    </Card>
  );
};

export default TaskCard;
