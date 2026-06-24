import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import FormSection from "@/components/shared/FormSection";
import { Package, Tags, Loader2 } from "lucide-react";

type ProductForm = { name: string; sku: string; description: string; category: string; unit: string; min_stock: string; cost_price: string; sale_price: string; initial_stock?: string };

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ProductForm;
  setForm: React.Dispatch<React.SetStateAction<ProductForm>>;
  editing: boolean;
  onSave: () => void;
  isSaving?: boolean;
}

const ProductDialog = ({ open, onOpenChange, form, setForm, editing, onSave, isSaving }: ProductDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
      {/* Header */}
      <DialogHeader className="flex-shrink-0 space-y-0 border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-lg">{editing ? "Editar producto" : "Nuevo producto"}</DialogTitle>
            <p className="text-sm text-muted-foreground">Rellena los datos del producto y su stock</p>
          </div>
        </div>
      </DialogHeader>

      {/* Body */}
      <div className="flex-1 space-y-4 overflow-y-auto bg-muted/30 px-6 py-5">
        <FormSection icon={Package} title="Datos del producto" desc="Identificación, categoría y stock">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nombre <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>SKU <span className="text-destructive">*</span></Label>
              <Input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Unidad</Label>
              <Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="uds, kg, litros..." />
            </div>
            <div className="space-y-1.5">
              <Label>Stock mínimo</Label>
              <Input type="number" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))} />
            </div>
          </div>
          {!editing && (
            <div className="space-y-1.5">
              <Label>Stock inicial</Label>
              <Input type="number" value={form.initial_stock ?? "0"} onChange={e => setForm(f => ({ ...f, initial_stock: e.target.value }))} placeholder="0" />
              <p className="text-xs text-muted-foreground">Se registrará automáticamente como un movimiento de entrada.</p>
            </div>
          )}
        </FormSection>

        <FormSection icon={Tags} title="Precios" desc="Coste y precio de venta">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Precio coste (€)</Label>
              <Input type="number" step="0.01" value={form.cost_price} onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Precio venta (€)</Label>
              <Input type="number" step="0.01" value={form.sale_price} onChange={e => setForm(f => ({ ...f, sale_price: e.target.value }))} />
            </div>
          </div>
        </FormSection>
      </div>

      {/* Sticky footer */}
      <DialogFooter className="flex-shrink-0 flex-row items-center justify-end gap-2 border-t border-border bg-background px-6 py-3">
        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
        <Button onClick={onSave} disabled={!form.name || !form.sku || isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default ProductDialog;
