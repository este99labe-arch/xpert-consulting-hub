import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useColumnMutations, useTaskColumns } from "./hooks";
import { COLUMN_COLOR_PRESETS } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const ColumnsConfigDialog = ({ open, onOpenChange }: Props) => {
  const { data: columns = [] } = useTaskColumns();
  const { create, update, remove } = useColumnMutations();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLUMN_COLOR_PRESETS[0]);

  const addCol = () => {
    if (!newName.trim()) return;
    if (columns.length >= 10) {
      toast({ title: "Máximo 10 columnas", variant: "destructive" });
      return;
    }
    create.mutate(
      { name: newName.trim(), color: newColor, sort_order: columns.length },
      {
        onSuccess: () => {
          setNewName("");
          toast({ title: "Columna añadida" });
        },
      }
    );
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = columns.findIndex((c) => c.id === id);
    const swapWith = columns[idx + dir];
    if (!swapWith) return;
    update.mutate({ id, updates: { sort_order: swapWith.sort_order } });
    update.mutate({ id: swapWith.id, updates: { sort_order: columns[idx].sort_order } });
  };

  const del = (id: string) => {
    if (columns.length <= 2) {
      toast({ title: "Mínimo 2 columnas requeridas", variant: "destructive" });
      return;
    }
    remove.mutate(id, {
      onSuccess: () => toast({ title: "Columna eliminada" }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar tablero</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {columns.map((col, i) => (
            <div key={col.id} className="flex items-center gap-2 p-2 rounded border">
              <input
                type="color"
                value={col.color}
                onChange={(e) => update.mutate({ id: col.id, updates: { color: e.target.value } })}
                className="h-7 w-7 rounded cursor-pointer border-0 p-0"
              />
              <Input
                value={col.name}
                onChange={(e) => update.mutate({ id: col.id, updates: { name: e.target.value } })}
                className="h-8 flex-1"
              />
              <Button variant="ghost" size="sm" onClick={() => move(col.id, -1)} disabled={i === 0}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => move(col.id, 1)} disabled={i === columns.length - 1}>
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => del(col.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <div className="border-t pt-4 space-y-2">
          <Label>Nueva columna</Label>
          <div className="flex gap-2">
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="h-9 w-9 rounded cursor-pointer border-0 p-0"
            />
            <Input
              placeholder="Nombre de la columna"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCol()}
            />
            <Button onClick={addCol} disabled={!newName.trim() || columns.length >= 10}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-1 flex-wrap">
            {COLUMN_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className="h-5 w-5 rounded-full border-2"
                style={{ background: c, borderColor: newColor === c ? "currentColor" : "transparent" }}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Mínimo 2, máximo 10 columnas. Los cambios se guardan automáticamente.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ColumnsConfigDialog;
