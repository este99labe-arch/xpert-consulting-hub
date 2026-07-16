import { useMemo, useState } from "react";
import JSZip from "jszip";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtEUR as EUR } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_PROJECT_ID } from "@/integrations/supabase/config";
import { toast } from "@/hooks/use-toast";
import {
  Folder, FolderOpen, FileText, Download, Loader2, ChevronRight, Building2,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  invoices: any[];
  onPreview: (inv: any) => void;
}

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const safeName = (s: string) => (s || "Sin nombre").replace(/[\\/:*?"<>|]+/g, "-").trim().slice(0, 80);

// Descarga el PDF de una factura desde la edge function (misma auth que la exportación individual)
async function fetchInvoicePdf(invoiceId: string, token: string): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/generate_invoice_pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ invoice_id: invoiceId, format: "pdf" }),
  });
  if (!res.ok) throw new Error(`PDF de ${invoiceId.slice(0, 8)} falló (${res.status})`);
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  const filename = disposition?.match(/filename="(.+)"/)?.[1] || `factura-${invoiceId.slice(0, 8)}.pdf`;
  return { blob, filename };
}

type Tree = Map<string, Map<number, Map<number, Map<number, any[]>>>>; // cliente → año → mes → día

const InvoiceFolderView = ({ invoices, onPreview }: Props) => {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [zipping, setZipping] = useState<string | null>(null);

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const tree: Tree = useMemo(() => {
    const t: Tree = new Map();
    for (const inv of invoices) {
      const client = inv.business_clients?.name || "Sin cliente";
      const d = new Date(inv.issue_date);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const day = d.getDate();
      if (!t.has(client)) t.set(client, new Map());
      const years = t.get(client)!;
      if (!years.has(y)) years.set(y, new Map());
      const months = years.get(y)!;
      if (!months.has(m)) months.set(m, new Map());
      const days = months.get(m)!;
      if (!days.has(day)) days.set(day, []);
      days.get(day)!.push(inv);
    }
    return t;
  }, [invoices]);

  // Descarga en ZIP un conjunto de facturas manteniendo la estructura de carpetas
  const downloadZip = async (list: any[], zipName: string, key: string) => {
    if (zipping) return;
    if (list.length === 0) return;
    if (list.length > 100 && !window.confirm(`Vas a generar un ZIP con ${list.length} facturas. ¿Continuar?`)) return;
    setZipping(key);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No estás autenticado");

      const zip = new JSZip();
      let done = 0;
      const errors: string[] = [];
      // Concurrencia limitada para no saturar la edge function
      const queue = [...list];
      const worker = async () => {
        while (queue.length > 0) {
          const inv = queue.shift();
          if (!inv) break;
          try {
            const { blob, filename } = await fetchInvoicePdf(inv.id, token);
            const d = new Date(inv.issue_date);
            const path = `${safeName(inv.business_clients?.name || "Sin cliente")}/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}-${MONTH_NAMES[d.getMonth()]}/${String(d.getDate()).padStart(2, "0")}`;
            zip.file(`${path}/${filename}`, blob);
          } catch (e: any) {
            errors.push(e.message);
          }
          done++;
        }
      };
      await Promise.all(Array.from({ length: 3 }, worker));

      if (done - errors.length === 0) throw new Error(errors[0] || "No se pudo generar ningún PDF");
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName(zipName)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "ZIP descargado",
        description: `${done - errors.length} facturas incluidas${errors.length ? ` · ${errors.length} con error` : ""}.`,
        variant: errors.length ? "destructive" : undefined,
      });
    } catch (e: any) {
      toast({ title: "No se pudo generar el ZIP", description: e.message, variant: "destructive" });
    } finally {
      setZipping(null);
    }
  };

  const flat = (days: Map<number, any[]>) => [...days.values()].flat();
  const flatYear = (months: Map<number, Map<number, any[]>>) => [...months.values()].flatMap(flat);
  const flatClient = (years: Map<number, Map<number, Map<number, any[]>>>) => [...years.values()].flatMap(flatYear);

  const ZipButton = ({ list, name, k }: { list: any[]; name: string; k: string }) => (
    <Button
      variant="ghost" size="sm"
      className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-primary"
      disabled={!!zipping}
      onClick={(e) => { e.stopPropagation(); downloadZip(list, name, k); }}
      title={`Descargar ${list.length} facturas en ZIP`}
    >
      {zipping === k ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      ZIP ({list.length})
    </Button>
  );

  const FolderRow = ({
    k, label, icon: Icon, count, total, depth, children, zipList, zipName,
  }: any) => {
    const isOpen = open.has(k);
    return (
      <div>
        <div
          className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60"
          style={{ paddingLeft: `${8 + depth * 22}px` }}
          onClick={() => toggle(k)}
        >
          <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
          {isOpen ? <FolderOpen className="h-4 w-4 shrink-0 text-[hsl(var(--warning))]" /> : <Icon className="h-4 w-4 shrink-0 text-[hsl(var(--warning))]" />}
          <span className="truncate text-sm font-medium">{label}</span>
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{count}</Badge>
          <span className="ml-auto hidden text-xs tabular-nums text-muted-foreground sm:inline">{EUR(total)}</span>
          <ZipButton list={zipList} name={zipName} k={`zip-${k}`} />
        </div>
        {isOpen && children}
      </div>
    );
  };

  const sum = (list: any[]) => list.reduce((s, i) => s + Number(i.amount_total || 0), 0);
  const clients = [...tree.keys()].sort((a, b) => a.localeCompare(b));

  if (invoices.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        No hay facturas con los filtros actuales.
      </Card>
    );
  }

  return (
    <Card className="p-2">
      {clients.map((client) => {
        const years = tree.get(client)!;
        const clientList = flatClient(years);
        const ck = `c:${client}`;
        return (
          <FolderRow
            key={ck} k={ck} label={client} icon={Building2} depth={0}
            count={clientList.length} total={sum(clientList)}
            zipList={clientList} zipName={`Facturas ${client}`}
          >
            {[...years.keys()].sort((a, b) => b - a).map((y) => {
              const months = years.get(y)!;
              const yearList = flatYear(months);
              const yk = `${ck}/${y}`;
              return (
                <FolderRow
                  key={yk} k={yk} label={String(y)} icon={Folder} depth={1}
                  count={yearList.length} total={sum(yearList)}
                  zipList={yearList} zipName={`Facturas ${client} ${y}`}
                >
                  {[...months.keys()].sort((a, b) => b - a).map((m) => {
                    const days = months.get(m)!;
                    const monthList = flat(days);
                    const mk = `${yk}/${m}`;
                    return (
                      <FolderRow
                        key={mk} k={mk} label={MONTH_NAMES[m - 1]} icon={Folder} depth={2}
                        count={monthList.length} total={sum(monthList)}
                        zipList={monthList} zipName={`Facturas ${client} ${y}-${String(m).padStart(2, "0")}`}
                      >
                        {[...days.keys()].sort((a, b) => b - a).map((day) => {
                          const dayList = days.get(day)!;
                          const dk = `${mk}/${day}`;
                          return (
                            <FolderRow
                              key={dk} k={dk} label={`${String(day).padStart(2, "0")} de ${MONTH_NAMES[m - 1].toLowerCase()}`} icon={Folder} depth={3}
                              count={dayList.length} total={sum(dayList)}
                              zipList={dayList} zipName={`Facturas ${client} ${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`}
                            >
                              {dayList.map((inv) => (
                                <div
                                  key={inv.id}
                                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/50"
                                  style={{ paddingLeft: `${8 + 4 * 22}px` }}
                                  onClick={() => onPreview(inv)}
                                >
                                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                                  <span className="truncate text-sm">{inv.invoice_number || inv.concept || inv.id.slice(0, 8)}</span>
                                  <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                                    {inv.type === "EXPENSE" ? "Gasto" : "Factura"}
                                  </Badge>
                                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                                    {format(new Date(inv.issue_date), "dd MMM yyyy", { locale: es })} · {EUR(Number(inv.amount_total || 0))}
                                  </span>
                                </div>
                              ))}
                            </FolderRow>
                          );
                        })}
                      </FolderRow>
                    );
                  })}
                </FolderRow>
              );
            })}
          </FolderRow>
        );
      })}
    </Card>
  );
};

export default InvoiceFolderView;
