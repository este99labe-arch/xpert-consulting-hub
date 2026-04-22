import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, isPast, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarClock, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ENTITY_META, getPriorityMeta, initials, type Task } from "./types";
import { useTaskLinks, type LinkEntityType } from "./TaskLinksManager";

interface Props {
  task: Task;
  members: { user_id: string; name: string }[];
  clients: { id: string; name: string }[];
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

const linkHref = (entityType: string, entityId: string): string | null => {
  switch (entityType as LinkEntityType) {
    case "CLIENT":
      return `/app/clients/${entityId}`;
    case "INVOICE":
    case "EXPENSE":
    case "QUOTE":
      return `/app/invoices`;
    case "JOURNAL_ENTRY":
      return `/app/accounting`;
    case "PRODUCT":
      return `/app/inventory`;
    default:
      return null;
  }
};

const TaskCard = ({ task, members, clients, onClick, onDragStart }: Props) => {
  const due = new Date(task.remind_at);
  const overdue = isPast(due) && !task.is_completed;
  const soon = !overdue && differenceInDays(due, new Date()) <= 2;
  const prio = getPriorityMeta(task.priority);
  const PrioIcon = prio.icon;
  const assignee = members.find((m) => m.user_id === task.assigned_to);
  const labels = task.labels || [];
  const visibleLabels = labels.slice(0, 2);
  const extraLabels = labels.length - visibleLabels.length;

  // Fetch real-time links (multi-link aware). Falls back to legacy fields if none.
  const { data: links = [] } = useTaskLinks(task.id);

  const fallbackLinks =
    links.length === 0
      ? (() => {
          const out: { entity_type: string; entity_id: string; entity_label: string | null }[] = [];
          if (task.entity_type && task.entity_id) {
            out.push({
              entity_type: task.entity_type,
              entity_id: task.entity_id,
              entity_label: task.entity_label,
            });
          } else if (task.client_id) {
            const c = clients.find((c) => c.id === task.client_id);
            out.push({ entity_type: "CLIENT", entity_id: task.client_id, entity_label: c?.name || null });
          }
          return out;
        })()
      : [];

  const display = links.length > 0 ? links : fallbackLinks;
  const visibleLinks = display.slice(0, 2);
  const extraLinks = display.length - visibleLinks.length;

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

      {visibleLinks.length > 0 && (
        <div className="flex flex-col gap-1">
          {visibleLinks.map((l, idx) => {
            const meta = ENTITY_META[l.entity_type];
            const Icon = meta?.icon;
            const href = linkHref(l.entity_type, l.entity_id);
            const label = l.entity_label || meta?.label || l.entity_id.slice(0, 8);
            const content = (
              <span className="flex items-center gap-1.5 text-xs min-w-0">
                {Icon && <Icon className="h-3 w-3 shrink-0" />}
                <span className="truncate">{label}</span>
                {href && <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />}
              </span>
            );
            return href ? (
              <Link
                key={idx}
                to={href}
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:text-primary hover:underline transition-colors"
                title={`Ir a ${meta?.label || l.entity_type}`}
              >
                {content}
              </Link>
            ) : (
              <div key={idx} className="text-muted-foreground">{content}</div>
            );
          })}
          {extraLinks > 0 && (
            <span className="text-[10px] text-muted-foreground">+{extraLinks} más</span>
          )}
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
