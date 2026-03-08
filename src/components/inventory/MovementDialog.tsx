import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Product } from "./types";

type MovementForm = { product_id: string; type: string; quantity: string; reason: string; notes: string };

interface MovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: MovementForm;
  setForm: React.Dispatch<React.SetStateAction<MovementForm>>;
  products: Product[];
  onSave: () => void;
}

const MovementDialog = ({ open, onOpenChange, form, setForm, products, onSave }: MovementDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Registrar Movimiento</DialogTitle>
        <DialogDescription>Selecciona producto, tipo y cantidad.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div>
          <Label>Producto</Label>
          <Select value={form.product_id} onValueChange={v => setForm(f => ({ ...f, product_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
            <SelectContent>{products.filter(p => p.is_active).map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="IN">Entrada</SelectItem>
                <SelectItem value="OUT">Salida</SelectItem>
                <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Cantidad</Label><Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} /></div>
        </div>
        <div><Label>Razón</Label><Input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="compra, venta, merma..." /></div>
        <div><Label>Notas</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button onClick={onSave} disabled={!form.product_id || !form.quantity}>Registrar</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default MovementDialog;
