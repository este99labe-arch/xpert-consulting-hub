import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ArrowRight, Check, ChevronsUpDown, AlertCircle, CheckCircle2, CircleDashed, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface MappingField {
  /** Internal field key */
  key: string;
  /** Visible label */
  label: string;
  /** Optional grouping section */
  group?: string;
  /** Whether the field is mandatory */
  required?: boolean;
  /** Aliases / keywords used for fuzzy match */
  aliases?: string[];
}

export interface ColumnMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Headers detected in the imported file */
  csvColumns: string[];
  /** First rows from the file for preview */
  previewRows: Record<string, any>[];
  /** Internal app fields that can be mapped */
  fields: MappingField[];
  /** File name for context */
  fileName?: string;
  /** Confirm callback. Receives map of internal field key → CSV column name (or null) */
  onConfirm: (mapping: Record<string, string | null>) => void;
}

type Confidence = "high" | "medium" | "none";

// ── Fuzzy matching ──────────────────────────────────────────────────
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

function similarity(a: string, b: string): number {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.85;
  // token overlap
  const ta = new Set(a.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const tb = new Set(b.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const inter = [...ta].filter((t) => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  if (union === 0) return 0;
  const jaccard = inter / union;
  // Character-level overlap as fallback
  let common = 0;
  for (const ch of new Set(x)) if (y.includes(ch)) common++;
  const charScore = common / Math.max(x.length, y.length);
  return Math.max(jaccard, charScore * 0.7);
}

function bestMatch(field: MappingField, columns: string[]): { col: string | null; score: number } {
  const candidates = [field.label, field.key, ...(field.aliases ?? [])];
  let best: { col: string | null; score: number } = { col: null, score: 0 };
  for (const col of columns) {
    for (const c of candidates) {
      const s = similarity(c, col);
      if (s > best.score) best = { col, score: s };
    }
  }
  return best;
}

function confidenceFor(score: number): Confidence {
  if (score >= 0.8) return "high";
  if (score >= 0.45) return "medium";
  return "none";
}

const confidenceStyles: Record<Confidence, { dot: string; label: string; badge: string }> = {
  high: {
    dot: "bg-emerald-500",
    label: "Alta",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  medium: {
    dot: "bg-amber-500",
    label: "Parcial",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  none: {
    dot: "bg-destructive",
    label: "Sin coincidencia",
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

// ── Searchable column picker ────────────────────────────────────────
function ColumnPicker({
  columns,
  value,
  onChange,
  hasError,
}: {
  columns: string[];
  value: string | null;
  onChange: (v: string | null) => void;
  hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            hasError && "border-destructive focus-visible:ring-destructive",
          )}
        >
          <span className="truncate">{value ?? "Sin asignar"}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar columna..." />
          <CommandList>
            <CommandEmpty>No se encontraron columnas.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                <span className="text-muted-foreground italic">Sin asignar</span>
              </CommandItem>
              {columns.map((col) => (
                <CommandItem
                  key={col}
                  value={col}
                  onSelect={() => {
                    onChange(col);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === col ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{col}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Main dialog ─────────────────────────────────────────────────────
export default function ColumnMappingDialog({
  open,
  onOpenChange,
  csvColumns,
  previewRows,
  fields,
  fileName,
  onConfirm,
}: ColumnMappingDialogProps) {
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [confidences, setConfidences] = useState<Record<string, Confidence>>({});

  // Auto-match on open / when columns change
  useEffect(() => {
    if (!open) return;
    const m: Record<string, string | null> = {};
    const c: Record<string, Confidence> = {};
    const used = new Set<string>();
    // First pass: high confidence claims
    const scored = fields
      .map((f) => ({ f, ...bestMatch(f, csvColumns) }))
      .sort((a, b) => b.score - a.score);
    for (const { f, col, score } of scored) {
      if (col && !used.has(col) && score >= 0.45) {
        m[f.key] = col;
        c[f.key] = confidenceFor(score);
        used.add(col);
      } else {
        m[f.key] = null;
        c[f.key] = "none";
      }
    }
    setMapping(m);
    setConfidences(c);
  }, [open, csvColumns, fields]);

  const setField = (key: string, col: string | null) => {
    setMapping((prev) => ({ ...prev, [key]: col }));
    setConfidences((prev) => ({ ...prev, [key]: col ? "high" : "none" }));
  };

  // Detect duplicates
  const duplicates = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(mapping).forEach((v) => {
      if (v) counts[v] = (counts[v] ?? 0) + 1;
    });
    return new Set(Object.entries(counts).filter(([, n]) => n > 1).map(([k]) => k));
  }, [mapping]);

  const requiredMissing = useMemo(
    () => fields.filter((f) => f.required && !mapping[f.key]).map((f) => f.key),
    [fields, mapping],
  );

  const autoMatchedCount = useMemo(
    () => Object.values(confidences).filter((c) => c !== "none").length,
    [confidences],
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, MappingField[]>();
    for (const f of fields) {
      const g = f.group ?? "Campos";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(f);
    }
    return [...groups.entries()];
  }, [fields]);

  const previewSample = previewRows.slice(0, 3);
  const canConfirm = requiredMissing.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl w-[calc(100vw-2rem)] h-[calc(100dvh-2rem)] sm:h-[90vh] p-0 flex flex-col gap-0 overflow-hidden"
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <DialogTitle className="text-xl flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Mapea tus columnas
              </DialogTitle>
              <DialogDescription>
                {fileName
                  ? `Asigna las columnas de "${fileName}" a los campos de la app.`
                  : "Asigna las columnas del archivo a los campos de la app."}
              </DialogDescription>
            </div>
            <Badge variant="secondary" className="shrink-0 gap-1.5 px-3 py-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="font-medium">
                {autoMatchedCount} de {fields.length}
              </span>
              <span className="text-muted-foreground">emparejados</span>
            </Badge>
          </div>

          {/* Confidence legend */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
            {(["high", "medium", "none"] as Confidence[]).map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", confidenceStyles[c].dot)} />
                {confidenceStyles[c].label}
              </span>
            ))}
          </div>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {requiredMissing.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Faltan {requiredMissing.length} campo(s) obligatorio(s) por asignar.
              </span>
            </div>
          )}

          {grouped.map(([groupName, groupFields]) => (
            <section key={groupName} className="space-y-3">
              {grouped.length > 1 && (
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {groupName}
                </h3>
              )}
              <div className="space-y-2.5">
                {groupFields.map((field) => {
                  const value = mapping[field.key] ?? null;
                  const conf = confidences[field.key] ?? "none";
                  const isRequiredMissing = !!field.required && !value;
                  const isDuplicate = !!value && duplicates.has(value);
                  const style = confidenceStyles[conf];
                  return (
                    <div
                      key={field.key}
                      className={cn(
                        "grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-lg border bg-card p-3 transition-colors",
                        isRequiredMissing && "border-destructive/40 bg-destructive/5",
                      )}
                    >
                      {/* Field info */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn("h-2 w-2 rounded-full shrink-0", style.dot)}
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-sm truncate">{field.label}</span>
                            {field.required ? (
                              <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium border-primary/30 text-primary">
                                Obligatorio
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium text-muted-foreground">
                                Opcional
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{field.key}</p>
                        </div>
                      </div>

                      {/* Arrow */}
                      <ArrowRight className="hidden sm:block h-4 w-4 text-muted-foreground" />

                      {/* Selector + status */}
                      <div className="space-y-1.5">
                        <ColumnPicker
                          columns={csvColumns}
                          value={value}
                          onChange={(v) => setField(field.key, v)}
                          hasError={isRequiredMissing}
                        />
                        <div className="flex items-center justify-between gap-2 px-0.5">
                          <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", style.badge)}>
                            {style.label}
                          </Badge>
                          {isDuplicate && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                              <AlertCircle className="h-3 w-3" />
                              Columna asignada a varios campos
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {/* Preview */}
          <section className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Vista previa
              </h3>
              <span className="text-[11px] text-muted-foreground">
                Primeras {previewSample.length} filas
              </span>
            </div>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      {fields.map((f) => (
                        <TableHead key={f.key} className="whitespace-nowrap text-xs">
                          {f.label}
                          {f.required && <span className="text-destructive ml-0.5">*</span>}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewSample.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={fields.length} className="text-center text-sm text-muted-foreground py-6">
                          Sin filas de muestra disponibles.
                        </TableCell>
                      </TableRow>
                    ) : (
                      previewSample.map((row, i) => (
                        <TableRow key={i}>
                          {fields.map((f) => {
                            const col = mapping[f.key];
                            const cell = col ? row[col] : null;
                            return (
                              <TableCell key={f.key} className="whitespace-nowrap text-xs max-w-[180px] truncate">
                                {cell == null || cell === "" ? (
                                  <span className="text-muted-foreground italic inline-flex items-center gap-1">
                                    <CircleDashed className="h-3 w-3" />
                                    —
                                  </span>
                                ) : (
                                  String(cell)
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </section>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 bg-muted/20 sm:justify-between gap-2">
          <div className="text-xs text-muted-foreground self-center hidden sm:block">
            {csvColumns.length} columna(s) detectada(s) en el archivo
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
              Cancelar
            </Button>
            <Button
              onClick={() => onConfirm(mapping)}
              disabled={!canConfirm}
              className="flex-1 sm:flex-none"
            >
              Confirmar mapeo
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Helper: parse uploaded CSV/Excel file ───────────────────────────
export async function parseImportFile(file: File): Promise<{
  columns: string[];
  rows: Record<string, any>[];
}> {
  const lower = file.name.toLowerCase();
  const isExcel = lower.endsWith(".xlsx") || lower.endsWith(".xls");

  if (isExcel) {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { columns, rows };
  }

  // CSV
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { columns: [], rows: [] };
  const sep = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
  const splitLine = (l: string) => l.split(sep).map((v) => v.replace(/^"|"$/g, "").trim());
  const columns = splitLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const vals = splitLine(line);
    const obj: Record<string, string> = {};
    columns.forEach((c, i) => (obj[c] = vals[i] ?? ""));
    return obj;
  });
  return { columns, rows };
}
