import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  CalendarClock, Plus, GripVertical, Search, LayoutGrid, List,
} from "lucide-react";
import { format, isPast } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import CreateReminderDialog from "@/components/reminders/CreateReminderDialog";

const KANBAN_COLUMNS = [
  { key: "REMINDER", label: "Recordatorio", color: "bg-blue-500" },
  { key: "IN_PROGRESS", label: "En proceso", color: "bg-yellow-500" },
  { key: "QA", label: "QA", color: "bg-purple-500" },
  { key: "DONE", label: "Completado", color: "bg-green-500" },
] as const;

const statusColors: Record<string, string> = {
  REMINDER: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  QA: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  DONE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

const entityTypeIcons: Record<string, string> = {
  CLIENT: "👤", INVOICE: "📄", QUOTE: "📋", EXPENSE: "💰",
  JOURNAL_ENTRY: "📒", ATTENDANCE: "⏱️", OTHER: "📌",
};

const AppTasks = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"kanban" | "list">("kanban");

  const { data: reminders = [] } = useQuery({
    queryKey: ["reminders-all", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "DONE") {
        updates.is_completed = true;
        updates.completed_at = new Date().toISOString();
      } else {
        updates.is_completed = false;
        updates.completed_at = null;
      }
      const { error } = await supabase.from("reminders").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      queryClient.invalidateQueries({ queryKey: ["reminders-all"] });
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return reminders;
    const q = search.toLowerCase();
    return reminders.filter((r: any) =>
      r.title.toLowerCase().includes(q) ||
      r.entity_label?.toLowerCase().includes(q) ||
      (r.labels as string[])?.some((l: string) => l.toLowerCase().includes(q))
    );
  }, [reminders, search]);

  const columnData = useMemo(() => {
    const map: Record<string, any[]> = {};
    KANBAN_COLUMNS.forEach((c) => (map[c.key] = []));
    filtered.forEach((r: any) => {
      const status = r.status || "REMINDER";
      if (map[status]) map[status].push(r);
      else map["REMINDER"].push(r);
    });
    return map;
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tareas</h1>
          <p className="text-sm text-muted-foreground">Gestiona tus recordatorios y tareas en un tablero</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 w-56"
            />
          </div>
          <div className="flex bg-muted rounded-lg p-0.5">
            <Button
              size="sm"
              variant={view === "kanban" ? "default" : "ghost"}
              className="h-7 px-2.5"
              onClick={() => setView("kanban")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant={view === "list" ? "default" : "ghost"}
              className="h-7 px-2.5"
              onClick={() => setView("list")}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Nuevo
          </Button>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {KANBAN_COLUMNS.map((col) => (
            <div key={col.key} className="flex flex-col">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
                <h3 className="text-sm font-semibold">{col.label}</h3>
                <Badge variant="secondary" className="text-[10px] px-1.5 h-4 ml-auto">
                  {columnData[col.key]?.length || 0}
                </Badge>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-2 min-h-[200px]">
                  {(columnData[col.key] || []).map((r: any) => (
                    <KanbanCard
                      key={r.id}
                      reminder={r}
                      onStatusChange={(status) => updateStatusMutation.mutate({ id: r.id, status })}
                    />
                  ))}
                  {(columnData[col.key] || []).length === 0 && (
                    <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                      Sin tareas
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">Título</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Estado</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Etiquetas</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Fecha</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r: any) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-accent/50">
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        {r.entity_type && <span className="text-xs">{entityTypeIcons[r.entity_type] || "📌"}</span>}
                        <span className="font-medium">{r.title}</span>
                      </div>
                      {r.entity_label && <p className="text-xs text-muted-foreground mt-0.5">{r.entity_label}</p>}
                    </td>
                    <td className="p-3">
                      <select
                        value={r.status || "REMINDER"}
                        onChange={(e) => updateStatusMutation.mutate({ id: r.id, status: e.target.value })}
                        className={`text-xs font-medium rounded-full px-2.5 py-0.5 border-0 cursor-pointer ${statusColors[r.status || "REMINDER"]}`}
                      >
                        {KANBAN_COLUMNS.map((c) => (
                          <option key={c.key} value={c.key}>{c.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {(r.labels as string[] || []).map((l: string) => (
                          <Badge key={l} variant="outline" className="text-[10px]">{l}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(r.remind_at), "dd MMM yyyy, HH:mm", { locale: es })}
                    </td>
                    <td className="p-3">
                      {r.status !== "DONE" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7"
                          onClick={() => updateStatusMutation.mutate({ id: r.id, status: "DONE" })}
                        >
                          Completar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      <CalendarClock className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No hay recordatorios</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <CreateReminderDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
};

const KanbanCard = ({
  reminder,
  onStatusChange,
}: {
  reminder: any;
  onStatusChange: (status: string) => void;
}) => {
  const isOverdue = isPast(new Date(reminder.remind_at)) && reminder.status !== "DONE";
  const nextStatuses = KANBAN_COLUMNS.filter((c) => c.key !== (reminder.status || "REMINDER"));

  return (
    <Card className={`shadow-sm ${isOverdue ? "border-destructive/30" : ""}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-1.5">
          {reminder.entity_type && (
            <span className="text-xs shrink-0 mt-0.5">{entityTypeIcons[reminder.entity_type] || "📌"}</span>
          )}
          <p className="text-sm font-medium break-words leading-tight">{reminder.title}</p>
        </div>
        {reminder.entity_label && (
          <p className="text-xs text-muted-foreground">{reminder.entity_label}</p>
        )}
        {(reminder.labels as string[] || []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(reminder.labels as string[]).map((l: string) => (
              <Badge key={l} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{l}</Badge>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className={`text-[11px] ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
            {format(new Date(reminder.remind_at), "dd MMM, HH:mm", { locale: es })}
          </span>
          <select
            value={reminder.status || "REMINDER"}
            onChange={(e) => onStatusChange(e.target.value)}
            className="text-[10px] bg-transparent border border-border rounded px-1 py-0.5 cursor-pointer"
          >
            {KANBAN_COLUMNS.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>
      </CardContent>
    </Card>
  );
};

export default AppTasks;
