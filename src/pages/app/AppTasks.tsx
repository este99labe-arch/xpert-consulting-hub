import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Plus, Search, LayoutGrid, List, Settings2, X, Filter, BarChart3, ChevronDown, Archive, ArchiveRestore,
} from "lucide-react";
import { format, isPast } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { useTaskColumns, useTasks, useTeamMembers, useClientsLite, useTaskMutations } from "@/components/tasks/hooks";
import {
  PRIORITIES, PRIORITY_RANK, ENTITY_META, getPriorityMeta, initials, type Task,
} from "@/components/tasks/types";
import TaskCard from "@/components/tasks/TaskCard";
import TaskDetailSheet from "@/components/tasks/TaskDetailSheet";
import CreateTaskDialog from "@/components/tasks/CreateTaskDialog";
import ColumnsConfigDialog from "@/components/tasks/ColumnsConfigDialog";

const AppTasks = () => {
  const { user } = useAuth();
  const { data: columns = [] } = useTaskColumns();
  const [showArchived, setShowArchived] = useState(false);
  const { data: tasks = [] } = useTasks({ archived: showArchived });
  const { data: members = [] } = useTeamMembers();
  const { data: clients = [] } = useClientsLite();
  const { update, unarchive } = useTaskMutations();

  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");
  const [labelFilter, setLabelFilter] = useState<string>("ALL");
  const [entityFilter, setEntityFilter] = useState<string>("ALL");
  const [sortByPriority, setSortByPriority] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allLabels = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => (t.labels || []).forEach((l) => set.add(l)));
    return [...set];
  }, [tasks]);

  const filtered = useMemo(() => {
    let res = tasks.slice();
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q) ||
          (t.entity_label || "").toLowerCase().includes(q)
      );
    }
    if (priorityFilter.length) res = res.filter((t) => priorityFilter.includes(t.priority));
    if (assigneeFilter !== "ALL") {
      res = res.filter((t) =>
        assigneeFilter === "NONE" ? !t.assigned_to : t.assigned_to === assigneeFilter
      );
    }
    if (labelFilter !== "ALL") res = res.filter((t) => (t.labels || []).includes(labelFilter));
    if (entityFilter !== "ALL") res = res.filter((t) => t.entity_type === entityFilter);
    return res;
  }, [tasks, search, priorityFilter, assigneeFilter, labelFilter, entityFilter]);

  const columnData = useMemo(() => {
    const map: Record<string, Task[]> = {};
    columns.forEach((c) => (map[c.id] = []));
    filtered.forEach((t) => {
      const colId = t.column_id || columns[0]?.id;
      if (colId && map[colId]) map[colId].push(t);
    });
    if (sortByPriority) {
      Object.keys(map).forEach((k) => {
        map[k].sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);
      });
    }
    return map;
  }, [filtered, columns, sortByPriority]);

  const metrics = useMemo(() => {
    const byPriority: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    const byAssignee: Record<string, number> = {};
    let overdue = 0;
    tasks.forEach((t) => {
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
      if (t.assigned_to) byAssignee[t.assigned_to] = (byAssignee[t.assigned_to] || 0) + 1;
      if (isPast(new Date(t.remind_at)) && !t.is_completed) overdue++;
    });
    return { byPriority, byAssignee, overdue, total: tasks.length };
  }, [tasks]);

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnId);
  }, []);
  const handleDrop = useCallback(
    (e: React.DragEvent, columnId: string) => {
      e.preventDefault();
      setDragOverColumn(null);
      const id = e.dataTransfer.getData("text/plain");
      if (id) update.mutate({ id, updates: { column_id: columnId } });
    },
    [update]
  );

  const clearFilters = () => {
    setSearch("");
    setPriorityFilter([]);
    setAssigneeFilter("ALL");
    setLabelFilter("ALL");
    setEntityFilter("ALL");
  };
  const hasFilters =
    !!search || priorityFilter.length > 0 || assigneeFilter !== "ALL" || labelFilter !== "ALL" || entityFilter !== "ALL";

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const bulkUpdate = (updates: Partial<Task>) => {
    selected.forEach((id) => update.mutate({ id, updates }));
    setSelected(new Set());
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Tareas {showArchived && <span className="text-muted-foreground font-normal text-lg">· Archivadas</span>}
          </h1>
          <p className="text-sm text-muted-foreground">
            {metrics.total} tareas{!showArchived && metrics.overdue > 0 && (
              <> · <span className="text-destructive font-medium">{metrics.overdue} vencidas</span></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-muted rounded-lg p-0.5">
            <Button size="sm" variant={view === "kanban" ? "default" : "ghost"} className="h-7 px-2.5" onClick={() => setView("kanban")}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant={view === "list" ? "default" : "ghost"} className="h-7 px-2.5" onClick={() => setView("list")}>
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button
            size="sm"
            variant={showArchived ? "default" : "outline"}
            onClick={() => setShowArchived((v) => !v)}
            className="gap-1.5"
          >
            <Archive className="h-4 w-4" />
            <span className="hidden sm:inline">{showArchived ? "Ver activas" : "Ver archivadas"}</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowConfig(true)} className="gap-1.5">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Configurar tablero</span>
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)} disabled={showArchived}>
            <Plus className="h-4 w-4" />
            Nueva
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 h-8">
            <BarChart3 className="h-4 w-4" />
            Resumen
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            <MetricCard label="Total" value={metrics.total} />
            <MetricCard label="Vencidas" value={metrics.overdue} accent={metrics.overdue > 0 ? "destructive" : undefined} />
            {PRIORITIES.map((p) => (
              <MetricCard key={p.value} label={p.label} value={metrics.byPriority[p.value] || 0} accentColor={p.color} />
            ))}
          </div>
          {Object.keys(metrics.byAssignee).length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Por asignado</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(metrics.byAssignee).map(([uid, n]) => {
                  const m = members.find((x) => x.user_id === uid);
                  return (
                    <Badge key={uid} variant="outline" className="gap-1.5">
                      <Avatar className="h-4 w-4">
                        <AvatarFallback className="text-[8px]">{initials(m?.name)}</AvatarFallback>
                      </Avatar>
                      {m?.name || "Usuario"} · {n}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar título o descripción..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <Filter className="h-3.5 w-3.5" /> Prioridad{priorityFilter.length > 0 && ` (${priorityFilter.length})`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Filtrar prioridad</DropdownMenuLabel>
              {PRIORITIES.map((p) => (
                <DropdownMenuCheckboxItem
                  key={p.value}
                  checked={priorityFilter.includes(p.value)}
                  onCheckedChange={(c) =>
                    setPriorityFilter((prev) => (c ? [...prev, p.value] : prev.filter((x) => x !== p.value)))
                  }
                >
                  <p.icon className={`h-3.5 w-3.5 mr-2 ${p.color}`} />
                  {p.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos asignados</SelectItem>
              <SelectItem value="NONE">Sin asignar</SelectItem>
              {user && <SelectItem value={user.id}>Asignadas a mí</SelectItem>}
              {members.filter((m) => m.user_id !== user?.id).map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {allLabels.length > 0 && (
            <Select value={labelFilter} onValueChange={setLabelFilter}>
              <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas etiquetas</SelectItem>
                {allLabels.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas entidades</SelectItem>
              {Object.entries(ENTITY_META).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {view === "kanban" && (
            <Button
              variant={sortByPriority ? "default" : "outline"}
              size="sm"
              className="h-8"
              onClick={() => setSortByPriority((v) => !v)}
            >
              Ordenar por prioridad
            </Button>
          )}

          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" /> Limpiar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <Card className="bg-primary/5 border-primary/30">
          <CardContent className="p-2 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium px-2">{selected.size} seleccionadas</span>
            <Select onValueChange={(v) => bulkUpdate({ column_id: v })}>
              <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="Mover a columna" /></SelectTrigger>
              <SelectContent>
                {columns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={(v) => bulkUpdate({ assigned_to: v === "NONE" ? null : v })}>
              <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="Asignar a" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Sin asignar</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" className="h-8" onClick={() => setSelected(new Set())}>Cancelar</Button>
          </CardContent>
        </Card>
      )}

      {/* Views */}
      {view === "kanban" ? (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(columns.length, 4))}, minmax(0, 1fr))` }}
        >
          {columns.map((col) => (
            <div
              key={col.id}
              className={`flex flex-col rounded-lg transition-colors p-2 ${
                dragOverColumn === col.id ? "bg-accent/40 ring-2 ring-primary/30" : "bg-muted/30"
              }`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} />
                <h3 className="text-sm font-semibold">{col.name}</h3>
                <Badge variant="secondary" className="text-[10px] px-1.5 h-4 ml-auto">
                  {columnData[col.id]?.length || 0}
                </Badge>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-2 min-h-[200px]">
                  {(columnData[col.id] || []).map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      members={members}
                      clients={clients}
                      onClick={() => setSelectedTask(t)}
                      onDragStart={(e) => handleDragStart(e, t.id)}
                    />
                  ))}
                  {(columnData[col.id] || []).length === 0 && (
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
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="p-2 w-8"></th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Título</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Prioridad</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Estado</th>
                  <th className="text-left p-2 font-medium text-muted-foreground hidden md:table-cell">Asignado</th>
                  <th className="text-left p-2 font-medium text-muted-foreground hidden lg:table-cell">Entidad</th>
                  <th className="text-left p-2 font-medium text-muted-foreground hidden md:table-cell">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const prio = getPriorityMeta(t.priority);
                  const PrioIcon = prio.icon;
                  const assignee = members.find((m) => m.user_id === t.assigned_to);
                  const overdue = isPast(new Date(t.remind_at)) && !t.is_completed;
                  return (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-accent/40 cursor-pointer" onClick={() => setSelectedTask(t)}>
                      <td className="p-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(t.id)}
                          onChange={() => toggleSelect(t.id)}
                        />
                      </td>
                      <td className="p-2 font-medium">{t.title}</td>
                      <td className="p-2" onClick={(e) => e.stopPropagation()}>
                        <Select value={t.priority} onValueChange={(v) => update.mutate({ id: t.id, updates: { priority: v as any } })}>
                          <SelectTrigger className="h-7 w-[110px] text-xs">
                            <span className="flex items-center gap-1.5">
                              <PrioIcon className={`h-3 w-3 ${prio.color}`} />
                              {prio.label}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITIES.map((p) => (
                              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2" onClick={(e) => e.stopPropagation()}>
                        <Select value={t.column_id || ""} onValueChange={(v) => update.mutate({ id: t.id, updates: { column_id: v } })}>
                          <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {columns.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2 hidden md:table-cell text-xs">
                        {assignee ? (
                          <span className="flex items-center gap-1.5">
                            <Avatar className="h-5 w-5"><AvatarFallback className="text-[9px]">{initials(assignee.name)}</AvatarFallback></Avatar>
                            {assignee.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </td>
                      <td className="p-2 hidden lg:table-cell text-xs text-muted-foreground">
                        {t.entity_label || "—"}
                      </td>
                      <td className={`p-2 hidden md:table-cell text-xs ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {format(new Date(t.remind_at), "dd MMM yyyy", { locale: es })}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">Sin tareas</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <CreateTaskDialog open={showCreate} onOpenChange={setShowCreate} />
      <ColumnsConfigDialog open={showConfig} onOpenChange={setShowConfig} />
      <TaskDetailSheet
        task={selectedTask}
        columns={columns}
        members={members}
        clients={clients}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
};

const MetricCard = ({
  label, value, accent, accentColor,
}: { label: string; value: number; accent?: "destructive"; accentColor?: string }) => (
  <Card>
    <CardContent className="p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${accent === "destructive" ? "text-destructive" : accentColor || ""}`}>{value}</p>
    </CardContent>
  </Card>
);

export default AppTasks;
