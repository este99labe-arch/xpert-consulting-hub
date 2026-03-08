import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { ChartAccount, JournalEntry, EntryFormLine, EUR } from "./types";

interface JournalEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingEntry: JournalEntry | null;
  entryForm: { date: string; description: string; lines: EntryFormLine[] };
  setEntryForm: React.Dispatch<React.SetStateAction<{ date: string; description: string; lines: EntryFormLine[] }>>;
  chartAccounts: ChartAccount[];
  onSave: () => void;
  isSaving: boolean;
}

const JournalEntryDialog = ({
  open, onOpenChange, editingEntry, entryForm, setEntryForm, chartAccounts, onSave, isSaving,
}: JournalEntryDialogProps) => {
  const addLine = () => {
    setEntryForm(prev => ({ ...prev, lines: [...prev.lines, { chart_account_id: "", debit: "", credit: "" }] }));
  };
  const updateLine = (idx: number, field: string, value: string) => {
    setEntryForm(prev => {
      const lines = [...prev.lines];
      lines[idx] = { ...lines[idx], [field]: value };
      return { ...prev, lines };
    });
  };
  const removeLine = (idx: number) => {
    if (entryForm.lines.length <= 2) return;
    setEntryForm(prev => ({ ...prev, lines: prev.lines.filter((_, i) => i !== idx) }));
  };

  const totalDebit = entryForm.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = entryForm.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingEntry ? `Editar asiento ${editingEntry.entry_number}` : "Nuevo asiento contable"}</DialogTitle>
          <DialogDescription>Las líneas deben cuadrar (Debe = Haber).</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={entryForm.date} onChange={e => setEntryForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <Label>Descripción</Label>
              <Input value={entryForm.description} onChange={e => setEntryForm(p => ({ ...p, description: e.target.value }))} placeholder="Descripción del asiento" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Líneas del asiento</Label>
            {entryForm.lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_100px_100px_32px] gap-2 items-end">
                <Select value={line.chart_account_id} onValueChange={v => updateLine(idx, "chart_account_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Cuenta..." /></SelectTrigger>
                  <SelectContent>
                    {chartAccounts.filter(c => c.is_active).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="Debe" value={line.debit} onChange={e => updateLine(idx, "debit", e.target.value)} />
                <Input type="number" placeholder="Haber" value={line.credit} onChange={e => updateLine(idx, "credit", e.target.value)} />
                <Button variant="ghost" size="icon" onClick={() => removeLine(idx)} disabled={entryForm.lines.length <= 2}>×</Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addLine}>
              <Plus className="mr-1 h-4 w-4" /> Añadir línea
            </Button>
          </div>

          <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
            <div className="text-sm">
              <span className="font-medium">Debe: {EUR(totalDebit)}</span>
              <span className="mx-4">|</span>
              <span className="font-medium">Haber: {EUR(totalCredit)}</span>
            </div>
            <Badge variant={balanced ? "default" : "destructive"}>
              {balanced ? "✓ Cuadrado" : `Descuadre: ${EUR(Math.abs(totalDebit - totalCredit))}`}
            </Badge>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={!balanced || isSaving}>
            {editingEntry ? "Guardar cambios" : "Crear asiento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default JournalEntryDialog;
