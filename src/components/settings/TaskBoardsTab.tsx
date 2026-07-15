import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Columns3, Hash, LayoutGrid, Plus, Sliders, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useTaskBoards, useBoardMutations } from "@/components/tasks/hooks";
import type { TaskBoard } from "@/components/tasks/types";
import BoardConfigDialog from "@/components/tasks/BoardConfigDialog";
import ColumnsConfigDialog from "@/components/tasks/ColumnsConfigDialog";

// Normaliza el prefijo de referencia: mayúsculas, sin espacios, máx. 6 chars
const cleanPrefix = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

const BoardRow = ({ board }: { board: TaskBoard }) => {
  const { update } = useBoardMutations();
  const [name, setName] = useState(board.name);
  const [prefix, setPrefix] = useState(board.prefix || "");
  const [boardCfg, setBoardCfg] = useState(false);
  const [colsCfg, setColsCfg] = useState(false);

  const saveName = () => {
    const v = name.trim();
    if (v && v !== board.name) update.mutate({ id: board.id, updates: { name: v } });
  };
  const savePrefix = () => {
    const v = cleanPrefix(prefix);
    setPrefix(v);
    if (v !== (board.prefix || "")) {
      update.mutate(
        { id: board.id, updates: { prefix: v || null } },
        { onSuccess: () => toast({ title: v ? `Prefijo ${v} guardado` : "Prefijo eliminado", description: v ? `Las nuevas tareas serán ${v}-${String(board.next_task_number).padStart(3, "0")}, ${v}-${String(board.next_task_number + 1).padStart(3, "0")}…` : "Las nuevas tareas se crearán sin referencia." }) },
      );
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1 space-y-1.5">
          <Label>Nombre del Kanban</Label>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: board.color }} />
            <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} className="h-9" />
          </div>
        </div>
        <div className="w-40 space-y-1.5">
          <Label className="flex items-center gap-1"><Hash className="h-3 w-3" /> Prefijo de tareas</Label>
          <Input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            onBlur={savePrefix}
            placeholder="DEV"
            className="h-9 font-mono uppercase"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setColsCfg(true)}>
            <Columns3 className="h-3.5 w-3.5" /> Columnas
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setBoardCfg(true)}>
            <Sliders className="h-3.5 w-3.5" /> Acceso y ajustes
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {board.prefix
          ? <>Próxima referencia: <Badge variant="secondary" className="font-mono text-[10px]">{board.prefix}-{String(board.next_task_number).padStart(3, "0")}</Badge> · los movimientos de cada tarea quedan registrados en su historial de actividad.</>
          : "Sin prefijo: las nuevas tareas no llevarán referencia (p. ej. DEV-001)."}
      </p>

      <BoardConfigDialog open={boardCfg} onOpenChange={setBoardCfg} board={board} onDeleted={() => {}} />
      <ColumnsConfigDialog open={colsCfg} onOpenChange={setColsCfg} boardId={board.id} boardName={board.name} />
    </div>
  );
};

const TaskBoardsTab = () => {
  const { data: boards = [] } = useTaskBoards();
  const { create } = useBoardMutations();
  const [newName, setNewName] = useState("");
  const [newPrefix, setNewPrefix] = useState("");

  const addBoard = () => {
    if (!newName.trim()) return;
    create.mutate(
      { name: newName.trim(), sort_order: boards.length, prefix: cleanPrefix(newPrefix) || undefined },
      { onSuccess: () => { setNewName(""); setNewPrefix(""); toast({ title: "Tablero creado", description: "Se han añadido las columnas básicas (Por hacer / En curso / Hecho)." }); } },
    );
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><LayoutGrid className="h-4 w-4 text-primary" /> Tableros de tareas</CardTitle>
          <CardDescription>
            Gestiona tus Kanban: nombre, prefijo de referencia incremental (DEV-001, DEV-002…), columnas,
            avisos de WhatsApp por columna y qué empleados tienen acceso a cada tablero.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {boards.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Aún no hay tableros. Crea el primero abajo.</p>
          )}
          {boards.map((b) => <BoardRow key={b.id} board={b} />)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4 text-primary" /> Nuevo tablero</CardTitle>
          <CardDescription>Crea Kanban separados por proyecto o área (p. ej. Desarrollo, Marketing).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-40 flex-1 space-y-1.5">
              <Label>Nombre</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Desarrollo" className="h-9" onKeyDown={(e) => e.key === "Enter" && addBoard()} />
            </div>
            <div className="w-40 space-y-1.5">
              <Label>Prefijo (opcional)</Label>
              <Input value={newPrefix} onChange={(e) => setNewPrefix(e.target.value.toUpperCase())} placeholder="DEV" className="h-9 font-mono uppercase" />
            </div>
            <Button onClick={addBoard} disabled={!newName.trim() || create.isPending} className="gap-1.5">
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Crear tablero
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TaskBoardsTab;
