import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ColumnMappingDialog, { MappingField, parseImportFile } from "@/components/shared/ColumnMappingDialog";

interface ImportProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  userId: string;
  onImported: () => void;
}

const FIELDS: MappingField[] = [
  { key: "name", label: "Nombre", group: "Identificación", required: true, aliases: ["nombre", "producto", "product", "name", "descripcion_producto"] },
  { key: "sku", label: "SKU", group: "Identificación", required: true, aliases: ["sku", "codigo", "code", "referencia", "ref"] },
  { key: "description", label: "Descripción", group: "Identificación", aliases: ["descripcion", "description", "detalle"] },
  { key: "category", label: "Categoría", group: "Clasificación", aliases: ["categoria", "category", "familia", "tipo"] },
  { key: "unit", label: "Unidad", group: "Clasificación", aliases: ["unidad", "unit", "medida", "uds"] },
  { key: "min_stock", label: "Stock Mínimo", group: "Inventario", aliases: ["stock_minimo", "min_stock", "minimo", "minimum"] },
  { key: "current_stock", label: "Stock Actual", group: "Inventario", aliases: ["stock", "stock_actual", "current_stock", "existencias", "cantidad"] },
  { key: "cost_price", label: "Precio Coste (€)", group: "Precios", aliases: ["precio_coste", "cost_price", "coste", "cost", "compra"] },
  { key: "sale_price", label: "Precio Venta (€)", group: "Precios", aliases: ["precio_venta", "sale_price", "venta", "price", "pvp"] },
];

const ImportProductsDialog = ({ open, onOpenChange, accountId, userId, onImported }: ImportProductsDialogProps) => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, any>[]>([]);

  const handleFile = async (f: File | null) => {
    setFile(f);
    if (!f) return;
    setParsing(true);
    try {
      const { columns, rows } = await parseImportFile(f);
      if (!columns.length) throw new Error("El archivo no contiene columnas reconocibles.");
      setCsvColumns(columns);
      setCsvRows(rows);
      setMappingOpen(true);
    } catch (e: any) {
      toast({ title: "Error al leer el archivo", description: e.message, variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  const handleConfirm = async (mapping: Record<string, string | null>) => {
    setImporting(true);
    try {
      const num = (v: any) => {
        if (v === null || v === undefined || v === "") return 0;
        const n = Number(String(v).replace(",", ".").replace(/[^\d.-]/g, ""));
        return isNaN(n) ? 0 : n;
      };
      const str = (v: any) => (v === null || v === undefined ? "" : String(v).trim());

      type Row = {
        account_id: string; name: string; sku: string; description: string | null;
        category: string; unit: string; min_stock: number;
        cost_price: number; sale_price: number; current_stock: number;
      };

      const payload: Row[] = csvRows
        .map((row) => {
          const get = (key: string) => (mapping[key] ? row[mapping[key]!] : undefined);
          const name = str(get("name"));
          const sku = str(get("sku"));
          if (!name || !sku) return null;
          return {
            account_id: accountId,
            name,
            sku,
            description: str(get("description")) || null,
            category: str(get("category")) || "General",
            unit: str(get("unit")) || "uds",
            min_stock: num(get("min_stock")),
            current_stock: num(get("current_stock")),
            cost_price: num(get("cost_price")),
            sale_price: num(get("sale_price")),
          };
        })
        .filter(Boolean) as Row[];

      if (!payload.length) {
        toast({ title: "Sin filas válidas", description: "No se encontraron filas con nombre y SKU.", variant: "destructive" });
        setImporting(false);
        return;
      }

      // Determine which SKUs already exist for this account
      const skus = Array.from(new Set(payload.map((p) => p.sku)));
      const { data: existing, error: exErr } = await supabase
        .from("products")
        .select("id, sku")
        .eq("account_id", accountId)
        .in("sku", skus);
      if (exErr) throw exErr;
      const existingMap = new Map<string, string>((existing || []).map((p: any) => [p.sku, p.id]));

      // Split into rows to insert (new) and rows to update (existing)
      const toInsert = payload.filter((p) => !existingMap.has(p.sku));
      const toUpdate = payload.filter((p) => existingMap.has(p.sku));

      // Insert new products with current_stock = 0; the trigger will sum the IN movement
      const insertedIds = new Map<string, string>(); // sku -> id
      if (toInsert.length) {
        const insertPayload = toInsert.map(({ current_stock, ...rest }) => ({ ...rest, current_stock: 0 }));
        const { data: inserted, error: insErr } = await supabase
          .from("products")
          .insert(insertPayload)
          .select("id, sku");
        if (insErr) throw insErr;
        (inserted || []).forEach((p: any) => insertedIds.set(p.sku, p.id));
      }

      // Update existing products (do NOT touch current_stock here; movement will adjust it)
      for (const p of toUpdate) {
        const { current_stock, account_id, sku, ...rest } = p;
        const id = existingMap.get(sku)!;
        const { error: upErr } = await supabase.from("products").update(rest).eq("id", id);
        if (upErr) throw upErr;
      }

      // Create stock movements for each row with quantity > 0
      const movements = payload
        .map((p) => {
          const qty = Number(p.current_stock) || 0;
          if (qty <= 0) return null;
          const isNew = !existingMap.has(p.sku);
          const productId = isNew ? insertedIds.get(p.sku) : existingMap.get(p.sku);
          if (!productId) return null;
          return {
            account_id: accountId,
            product_id: productId,
            type: "IN",
            quantity: qty,
            reason: isNew ? "introduccion de producto nuevo" : "nueva compra de stock",
            notes: "Importación automática mediante CSV",
            created_by: userId,
          };
        })
        .filter(Boolean) as any[];

      if (movements.length) {
        const { error: movErr } = await supabase.from("stock_movements").insert(movements);
        if (movErr) throw movErr;
      }

      toast({
        title: "Importación completada",
        description: `${toInsert.length} nuevo(s), ${toUpdate.length} actualizado(s), ${movements.length} movimiento(s) registrado(s).`,
      });
      setMappingOpen(false);
      setFile(null);
      setCsvColumns([]);
      setCsvRows([]);
      onOpenChange(false);
      onImported();
    } catch (e: any) {
      toast({ title: "Error al importar", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Importar productos
            </DialogTitle>
            <DialogDescription>
              Sube un archivo CSV o Excel (.xlsx). Te ayudaremos a mapear las columnas con los campos del inventario.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center">
              <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <Label htmlFor="import-file" className="cursor-pointer">
                <span className="text-sm font-medium text-primary hover:underline">Selecciona un archivo</span>
                <span className="text-sm text-muted-foreground"> o arrástralo aquí</span>
                <Input
                  id="import-file"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] || null)}
                  disabled={parsing || importing}
                />
              </Label>
              <p className="text-xs text-muted-foreground mt-2">CSV, XLSX o XLS · Máx. 10MB</p>
              {file && <p className="text-xs mt-3 font-medium">{file.name}</p>}
              {parsing && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Procesando archivo…
                </p>
              )}
            </div>
            <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Campos requeridos:</p>
              <p>Nombre y SKU. El resto son opcionales (categoría, unidad, stock, precios…).</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ColumnMappingDialog
        open={mappingOpen}
        onOpenChange={(o) => { setMappingOpen(o); if (!o) setFile(null); }}
        csvColumns={csvColumns}
        previewRows={csvRows}
        fields={FIELDS}
        fileName={file?.name}
        onConfirm={handleConfirm}
      />
    </>
  );
};

export default ImportProductsDialog;
