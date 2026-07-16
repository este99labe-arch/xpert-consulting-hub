import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Download, LayoutGrid, ListTodo, UserRound } from "lucide-react";

interface Props {
  accountId: string;
}

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const NO_BOARD = "__none__";

interface Row {
  key: string;
  name: string;
  created: number;
  completed: number;
  open: number;
}

const pct = (completed: number, total: number) => (total > 0 ? Math.round((completed / total) * 100) : 0);

const exportCsv = (filename: string, header: string[], rows: (string | number)[][]) => {
  const csv = "﻿" + [header, ...rows].map((r) => r.join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

/** Tabla resumen (cliente o empleado) con barra de cumplimiento y export CSV */
const SummaryTable = ({ title, desc, icon: Icon, rows, csvName, entityHeader }: {
  title: string; desc: string; icon: any; rows: Row[]; csvName: string; entityHeader: string;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
      <div>
        <CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-primary" /> {title}</CardTitle>
        <CardDescription className="mt-1">{desc}</CardDescription>
      </div>
      <Button
        variant="outline" size="sm" className="gap-1.5"
        onClick={() => exportCsv(csvName, [entityHeader, "Creadas", "Completadas", "Abiertas", "% completado"],
          rows.map((r) => [r.name, r.created, r.completed, r.open, pct(r.completed, r.completed + r.open)]))}
        disabled={rows.length === 0}
      >
        <Download className="h-3.5 w-3.5" /> CSV
      </Button>
    </CardHeader>
    <CardContent className="p-0">
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Sin tareas en el periodo seleccionado.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{entityHeader}</TableHead>
                <TableHead className="text-right">Creadas</TableHead>
                <TableHead className="text-right">Completadas</TableHead>
                <TableHead className="text-right">Abiertas</TableHead>
                <TableHead className="w-[180px]">Cumplimiento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const p = pct(r.completed, r.completed + r.open);
                return (
                  <TableRow key={r.key}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.created}</TableCell>
                    <TableCell className="text-right tabular-nums text-[hsl(var(--success))]">{r.completed}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.open}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-[hsl(var(--success))]" style={{ width: `${p}%` }} />
                        </div>
                        <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{p}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </CardContent>
  </Card>
);

const TasksReport = ({ accountId }: Props) => {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState<string>("ALL");
  const [excludedBoards, setExcludedBoards] = useState<Set<string>>(new Set());

  const { data: boards = [] } = useQuery({
    queryKey: ["report-boards", accountId],
    queryFn: async () => {
      const { data } = await (supabase.from("task_boards") as any)
        .select("id, name").eq("account_id", accountId).order("sort_order");
      return (data || []) as { id: string; name: string }[];
    },
    enabled: !!accountId,
  });

  const { data: columns = [] } = useQuery({
    queryKey: ["report-columns", accountId],
    queryFn: async () => {
      const { data } = await supabase.from("task_columns").select("id, board_id").eq("account_id", accountId);
      return (data || []) as any[];
    },
    enabled: !!accountId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["report-clients", accountId],
    queryFn: async () => {
      const { data } = await supabase.from("business_clients").select("id, name").eq("account_id", accountId);
      return data || [];
    },
    enabled: !!accountId,
  });

  const { data: team = [] } = useQuery({
    queryKey: ["report-team", accountId],
    queryFn: async () => {
      const { data } = await supabase.from("employee_profiles")
        .select("user_id, first_name, last_name").eq("account_id", accountId);
      return (data || []).map((p: any) => ({ user_id: p.user_id, name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Usuario" }));
    },
    enabled: !!accountId,
  });

  // Todas las tareas del año seleccionado (creadas o completadas en él)
  const { data: tasks = [] } = useQuery({
    queryKey: ["report-tasks", accountId, year],
    queryFn: async () => {
      const from = `${year}-01-01`;
      const to = `${Number(year) + 1}-01-01`;
      const { data } = await (supabase.from("reminders") as any)
        .select("id, client_id, assigned_to, is_completed, completed_at, created_at, column_id")
        .eq("account_id", accountId)
        .or(`and(created_at.gte.${from},created_at.lt.${to}),and(completed_at.gte.${from},completed_at.lt.${to})`);
      return (data || []) as any[];
    },
    enabled: !!accountId,
  });

  const boardOfColumn = useMemo(() => {
    const m = new Map<string, string>();
    columns.forEach((c: any) => m.set(c.id, c.board_id || NO_BOARD));
    return m;
  }, [columns]);

  const clientName = useMemo(() => {
    const m = new Map<string, string>();
    clients.forEach((c: any) => m.set(c.id, c.name));
    return m;
  }, [clients]);

  const memberName = useMemo(() => {
    const m = new Map<string, string>();
    team.forEach((t) => m.set(t.user_id, t.name));
    return m;
  }, [team]);

  const inPeriod = (iso: string | null) => {
    if (!iso) return false;
    const d = new Date(iso);
    if (d.getFullYear() !== Number(year)) return false;
    return month === "ALL" || d.getMonth() + 1 === Number(month);
  };

  // Agregación por clave (cliente o empleado)
  const { byClient, byEmployee, totals } = useMemo(() => {
    const cli = new Map<string, Row>();
    const emp = new Map<string, Row>();
    const totals = { created: 0, completed: 0, open: 0 };

    const bump = (map: Map<string, Row>, key: string, name: string, kind: "created" | "completed" | "open") => {
      if (!map.has(key)) map.set(key, { key, name, created: 0, completed: 0, open: 0 });
      map.get(key)![kind]++;
    };

    for (const t of tasks) {
      const board = t.column_id ? (boardOfColumn.get(t.column_id) || NO_BOARD) : NO_BOARD;
      if (excludedBoards.has(board)) continue;

      const createdIn = inPeriod(t.created_at);
      const completedIn = t.is_completed && inPeriod(t.completed_at);
      if (!createdIn && !completedIn) continue;

      const cKey = t.client_id || "none";
      const cName = t.client_id ? (clientName.get(t.client_id) || "Cliente") : "Interno / sin cliente";
      const eKey = t.assigned_to || "none";
      const eName = t.assigned_to ? (memberName.get(t.assigned_to) || "Usuario") : "Sin asignar";

      if (createdIn) { bump(cli, cKey, cName, "created"); bump(emp, eKey, eName, "created"); totals.created++; }
      if (completedIn) { bump(cli, cKey, cName, "completed"); bump(emp, eKey, eName, "completed"); totals.completed++; }
      if (createdIn && !t.is_completed) { bump(cli, cKey, cName, "open"); bump(emp, eKey, eName, "open"); totals.open++; }
    }

    const sortRows = (m: Map<string, Row>) => [...m.values()].sort((a, b) => (b.completed + b.open) - (a.completed + a.open));
    return { byClient: sortRows(cli), byEmployee: sortRows(emp), totals };
  }, [tasks, excludedBoards, boardOfColumn, clientName, memberName, month, year]);

  const hasNoBoardTasks = useMemo(
    () => tasks.some((t: any) => !t.column_id || (boardOfColumn.get(t.column_id) || NO_BOARD) === NO_BOARD),
    [tasks, boardOfColumn],
  );

  const periodLabel = month === "ALL" ? year : `${MONTHS[Number(month) - 1]} ${year}`;
  const years = Array.from({ length: 4 }, (_, i) => String(now.getFullYear() - i));
  const includedBoards = boards.length + (hasNoBoardTasks ? 1 : 0) - excludedBoards.size;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todo el año</SelectItem>
            {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-1.5">
              <LayoutGrid className="h-4 w-4" /> Tableros ({includedBoards})
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>Incluir tableros</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {boards.map((b) => (
              <DropdownMenuCheckboxItem
                key={b.id}
                checked={!excludedBoards.has(b.id)}
                onCheckedChange={(c) => setExcludedBoards((prev) => {
                  const next = new Set(prev);
                  c ? next.delete(b.id) : next.add(b.id);
                  return next;
                })}
                onSelect={(e) => e.preventDefault()}
              >
                {b.name}
              </DropdownMenuCheckboxItem>
            ))}
            {hasNoBoardTasks && (
              <DropdownMenuCheckboxItem
                checked={!excludedBoards.has(NO_BOARD)}
                onCheckedChange={(c) => setExcludedBoards((prev) => {
                  const next = new Set(prev);
                  c ? next.delete(NO_BOARD) : next.add(NO_BOARD);
                  return next;
                })}
                onSelect={(e) => e.preventDefault()}
              >
                Sin tablero
              </DropdownMenuCheckboxItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary" className="gap-1"><ListTodo className="h-3 w-3" /> {totals.created} creadas</Badge>
          <Badge variant="secondary" className="gap-1 text-[hsl(var(--success))]">{totals.completed} completadas</Badge>
          <Badge variant="secondary" className="gap-1">{totals.open} abiertas</Badge>
        </div>
      </div>

      <SummaryTable
        title="Trabajo por cliente"
        desc={`En qué clientes se ha trabajado en ${periodLabel} (tareas creadas o completadas en el periodo).`}
        icon={Building2}
        rows={byClient}
        entityHeader="Cliente"
        csvName={`tareas_por_cliente_${periodLabel.replace(/ /g, "_")}.csv`}
      />

      <SummaryTable
        title="Rendimiento por empleado"
        desc={`Tareas gestionadas por cada miembro del equipo en ${periodLabel}.`}
        icon={UserRound}
        rows={byEmployee}
        entityHeader="Empleado"
        csvName={`tareas_por_empleado_${periodLabel.replace(/ /g, "_")}.csv`}
      />
    </div>
  );
};

export default TasksReport;
