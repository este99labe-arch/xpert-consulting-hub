import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Product } from "./types";

type OrderForm = { product_id: string; quantity: string; estimated_date: string; notes: string };

interface OrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: OrderForm;
  setForm: React.Dispatch<React.SetStateAction<OrderForm>>;
  products: Product[];
  onSave: () => void;
}

const OrderDialog = ({ open, onOpenChange, form, setForm, products, onSave }: OrderDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nueva Orden de Compra</DialogTitle>
        <DialogDescription>Planifica la compra de stock.</DialogDescription>
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
          <div><Label>Cantidad</Label><Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} /></div>
          <div><Label>Fecha estimada</Label><Input type="date" value={form.estimated_date} onChange={e => setForm(f => ({ ...f, estimated_date: e.target.value }))} /></div>
        </div>
        <div><Label>Notas</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button onClick={onSave} disabled={!form.product_id || !form.quantity}>Crear Orden</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default OrderDialog;
