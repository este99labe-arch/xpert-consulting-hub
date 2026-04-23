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

const ImportProductsDialog = ({ open, onOpenChange, accountId, onImported }: ImportProductsDialogProps) => {
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

      const payload = csvRows
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
        .filter(Boolean) as any[];

      if (!payload.length) {
        toast({ title: "Sin filas válidas", description: "No se encontraron filas con nombre y SKU.", variant: "destructive" });
        setImporting(false);
        return;
      }

      const { error } = await supabase.from("products").upsert(payload, { onConflict: "account_id,sku" });
      if (error) {
        // Fallback: insert ignoring duplicates one by one if onConflict not configured
        const { error: insErr } = await supabase.from("products").insert(payload);
        if (insErr) throw insErr;
      }

      toast({ title: "Importación completada", description: `${payload.length} producto(s) importado(s).` });
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
