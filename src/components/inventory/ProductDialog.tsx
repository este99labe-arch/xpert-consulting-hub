import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: { name: string; sku: string; description: string; category: string; unit: string; min_stock: string; cost_price: string; sale_price: string };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  editing: boolean;
  onSave: () => void;
}

const ProductDialog = ({ open, onOpenChange, form, setForm, editing, onSave }: ProductDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{editing ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
        <DialogDescription>Rellena los datos del producto.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Nombre</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><Label>SKU</Label><Input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} /></div>
        </div>
        <div><Label>Descripción</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Categoría</Label><Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} /></div>
          <div><Label>Unidad</Label><Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="uds, kg, litros..." /></div>
          <div><Label>Stock Mínimo</Label><Input type="number" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Precio Coste (€)</Label><Input type="number" step="0.01" value={form.cost_price} onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))} /></div>
          <div><Label>Precio Venta (€)</Label><Input type="number" step="0.01" value={form.sale_price} onChange={e => setForm(f => ({ ...f, sale_price: e.target.value }))} /></div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button onClick={onSave} disabled={!form.name || !form.sku}>Guardar</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default ProductDialog;
