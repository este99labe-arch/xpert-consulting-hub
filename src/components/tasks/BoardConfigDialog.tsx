import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trash2, Save, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useBoardMembers, useBoardMutations, useTeamMembers } from "./hooks";
import { initials, type TaskBoard } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  board: TaskBoard | null;
  onDeleted: () => void;
}

const BoardConfigDialog = ({ open, onOpenChange, board, onDeleted }: Props) => {
  const { data: members = [] } = useTeamMembers();
  const { data: memberIds = [] } = useBoardMembers(board?.id);
  const { update, remove, setMembers } = useBoardMutations();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (board) setName(board.name);
  }, [board]);
  useEffect(() => {
    setSelected(new Set(memberIds));
  }, [memberIds]);

  if (!board) return null;

  const toggle = (uid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  const save = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== board.name) update.mutate({ id: board.id, updates: { name: trimmed } });
    setMembers.mutate(
      { boardId: board.id, userIds: [...selected] },
      { onSuccess: () => { toast({ title: "Tablero actualizado" }); onOpenChange(false); } }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustes del tablero</DialogTitle>
          <DialogDescription>Renombra el tablero y elige qué miembros del equipo tienen acceso.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Users className="h-4 w-4" /> Acceso del equipo</Label>
            <p className="text-xs text-muted-foreground">
              Los administradores siempre tienen acceso. Marca qué empleados pueden ver y trabajar este tablero.
            </p>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
              {members.length === 0 && <p className="p-2 text-sm text-muted-foreground">No hay miembros en el equipo.</p>}
              {members.map((m) => (
                <label key={m.user_id} className="flex cursor-pointer items-center gap-2.5 rounded-md p-1.5 hover:bg-accent/50">
                  <Checkbox checked={selected.has(m.user_id)} onCheckedChange={() => toggle(m.user_id)} />
                  <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{initials(m.name)}</AvatarFallback></Avatar>
                  <span className="text-sm">{m.name || "Usuario"}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" /> Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar «{board.name}»?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminarán sus columnas y las tareas asociadas de este tablero. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => remove.mutate(board.id, {
                    onSuccess: () => { toast({ title: "Tablero eliminado" }); onOpenChange(false); onDeleted(); },
                  })}
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={save} disabled={setMembers.isPending} className="gap-1.5">
            <Save className="h-4 w-4" /> Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BoardConfigDialog;
