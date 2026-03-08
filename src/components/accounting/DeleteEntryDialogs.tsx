import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { JournalEntry } from "./types";

interface DeleteConfirmDialogProps {
  entry: JournalEntry | null;
  onClose: () => void;
  onConfirm: (entryId: string) => void;
}

export const DeleteConfirmDialog = ({ entry, onClose, onConfirm }: DeleteConfirmDialogProps) => (
  <AlertDialog open={!!entry} onOpenChange={open => !open && onClose()}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Eliminar asiento</AlertDialogTitle>
        <AlertDialogDescription>
          ¿Estás seguro de eliminar el asiento <strong>{entry?.entry_number}</strong>?
          {entry?.status === "POSTED" && " Este asiento ya está contabilizado."}
          {entry?.invoice_id && " Este asiento está vinculado a una factura y se regenerará si la factura se modifica."}
          {" "}Esta acción no se puede deshacer.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancelar</AlertDialogCancel>
        <AlertDialogAction
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          onClick={() => entry && onConfirm(entry.id)}
        >
          Eliminar
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

interface DeleteRequestDialogProps {
  entry: JournalEntry | null;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  isPending: boolean;
}

export const DeleteRequestDialog = ({ entry, onClose, onSubmit, isPending }: DeleteRequestDialogProps) => {
  const [reason, setReason] = useState("");

  return (
    <Dialog open={!!entry} onOpenChange={open => { if (!open) { onClose(); setReason(""); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar eliminación</DialogTitle>
          <DialogDescription>
            Tu solicitud para eliminar el asiento <strong>{entry?.entry_number}</strong> será revisada por un manager.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label>Motivo</Label>
          <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Describe por qué quieres eliminar este asiento" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); setReason(""); }}>Cancelar</Button>
          <Button variant="destructive" onClick={() => { onSubmit(reason); setReason(""); }} disabled={isPending}>
            Enviar solicitud
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
