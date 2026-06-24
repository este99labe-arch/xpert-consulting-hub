import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, BookText, CalendarDays, ListTree, Loader2 } from "lucide-react";
import FormSection from "@/components/shared/FormSection";
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
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 space-y-0 border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BookText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">
                {editingEntry ? `Editar asiento ${editingEntry.entry_number}` : "Nuevo asiento contable"}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">Las líneas deben cuadrar (Debe = Haber)</p>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto bg-muted/30 px-6 py-5">
          <FormSection icon={CalendarDays} title="Datos del asiento" desc="Fecha y concepto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Fecha</Label>
                <Input type="date" value={entryForm.date} onChange={e => setEntryForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Descripción</Label>
                <Input value={entryForm.description} onChange={e => setEntryForm(p => ({ ...p, description: e.target.value }))} placeholder="Descripción del asiento" />
              </div>
            </div>
          </FormSection>

          <FormSection
            icon={ListTree}
            title="Líneas del asiento"
            desc="Cuentas con su importe en Debe o Haber"
            action={
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Añadir línea
              </Button>
            }
          >
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_5.5rem_5.5rem_2.25rem] gap-2 px-1">
              <span className="text-xs font-medium text-muted-foreground">Cuenta</span>
              <span className="text-xs font-medium text-muted-foreground">Debe</span>
              <span className="text-xs font-medium text-muted-foreground">Haber</span>
              <span />
            </div>
            {entryForm.lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_5.5rem_5.5rem_2.25rem] items-center gap-2">
                <Select value={line.chart_account_id} onValueChange={v => updateLine(idx, "chart_account_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Cuenta..." /></SelectTrigger>
                  <SelectContent>
                    {chartAccounts.filter(c => c.is_active).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="0,00" value={line.debit} onChange={e => updateLine(idx, "debit", e.target.value)} className="text-sm" />
                <Input type="number" placeholder="0,00" value={line.credit} onChange={e => updateLine(idx, "credit", e.target.value)} className="text-sm" />
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeLine(idx)} disabled={entryForm.lines.length <= 2}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </FormSection>
        </div>

        {/* Sticky footer with balance + actions */}
        <DialogFooter className="flex-shrink-0 flex-row items-center justify-between gap-3 border-t border-border bg-background px-6 py-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-mono text-muted-foreground">Debe {EUR(totalDebit)}</span>
            <span className="font-mono text-muted-foreground">Haber {EUR(totalCredit)}</span>
            <Badge variant={balanced ? "default" : "destructive"} className="font-medium">
              {balanced ? "✓ Cuadrado" : `Descuadre ${EUR(Math.abs(totalDebit - totalCredit))}`}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={onSave} disabled={!balanced || isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingEntry ? "Guardar cambios" : "Crear asiento"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default JournalEntryDialog;
