// Catálogo de métricas del panel personalizable del dashboard.
// Todas las métricas se calculan en cliente a partir de datasets base ya
// filtrados por cuenta (RLS), agregadas por mes ("yyyy-MM").

import { format, subMonths, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";

export type MetricUnit = "EUR" | "COUNT" | "HOURS" | "PCT";

export interface MetricDef {
  id: string;
  label: string;
  category: string;
  unit: MetricUnit;
  /** Acumulada: el valor del mes incluye todos los meses anteriores (p. ej. clientes activos) */
  cumulative?: boolean;
}

export interface MetricDatasets {
  invoices: {
    type: string; status: string; issue_date: string; due_date?: string | null;
    amount_total: number; amount_net?: number | null; amount_vat?: number | null;
    client_id?: string | null;
  }[];
  clients: { created_at: string; status: string }[];
  tasks: { created_at: string; completed_at?: string | null; is_completed: boolean; origin?: string | null }[];
  attendance: { work_date: string; check_in?: string | null; check_out?: string | null }[];
  conversations: { created_at: string }[];
}

// ─── Catálogo ────────────────────────────────────────────────
export const METRICS: MetricDef[] = [
  // Facturación
  { id: "ingresos",            label: "Ingresos (facturado)",        category: "Facturación", unit: "EUR" },
  { id: "gastos",              label: "Gastos",                      category: "Facturación", unit: "EUR" },
  { id: "resultado",           label: "Resultado (ingresos − gastos)", category: "Facturación", unit: "EUR" },
  { id: "base_imponible",      label: "Base imponible facturada",    category: "Facturación", unit: "EUR" },
  { id: "facturas_emitidas",   label: "Nº facturas emitidas",        category: "Facturación", unit: "COUNT" },
  { id: "gastos_registrados",  label: "Nº gastos registrados",       category: "Facturación", unit: "COUNT" },
  { id: "presupuestos",        label: "Nº presupuestos",             category: "Facturación", unit: "COUNT" },
  { id: "ticket_medio",        label: "Ticket medio por factura",    category: "Facturación", unit: "EUR" },
  // Impuestos
  { id: "iva_repercutido",     label: "IVA repercutido",             category: "Impuestos", unit: "EUR" },
  { id: "iva_soportado",       label: "IVA soportado",               category: "Impuestos", unit: "EUR" },
  { id: "iva_neto",            label: "IVA neto (a liquidar)",       category: "Impuestos", unit: "EUR" },
  // Cobros
  { id: "cobrado",             label: "Importe cobrado",             category: "Cobros", unit: "EUR" },
  { id: "pendiente_cobro",     label: "Importe pendiente de cobro",  category: "Cobros", unit: "EUR" },
  { id: "facturas_vencidas",   label: "Nº facturas vencidas",        category: "Cobros", unit: "COUNT" },
  // Clientes
  { id: "clientes_nuevos",     label: "Clientes nuevos",             category: "Clientes", unit: "COUNT" },
  { id: "clientes_activos",    label: "Clientes activos (acumulado)", category: "Clientes", unit: "COUNT", cumulative: true },
  { id: "clientes_facturados", label: "Clientes con factura en el mes", category: "Clientes", unit: "COUNT" },
  // Tareas
  { id: "tareas_creadas",      label: "Tareas creadas",              category: "Tareas", unit: "COUNT" },
  { id: "tareas_completadas",  label: "Tareas completadas",          category: "Tareas", unit: "COUNT" },
  { id: "tareas_chat",         label: "Tareas generadas por chat",   category: "Tareas", unit: "COUNT" },
  // Equipo
  { id: "horas_trabajadas",    label: "Horas trabajadas (fichajes)", category: "Equipo", unit: "HOURS" },
  { id: "fichajes",            label: "Nº fichajes",                 category: "Equipo", unit: "COUNT" },
  // Chat
  { id: "conversaciones",      label: "Conversaciones de chat nuevas", category: "Chat", unit: "COUNT" },
];

export const METRIC_CATEGORIES = [...new Set(METRICS.map((m) => m.category))];

export const metricDef = (id: string): MetricDef | undefined => METRICS.find((m) => m.id === id);

// ─── Utilidades de meses ─────────────────────────────────────
/** Últimos n meses en clave "yyyy-MM" (ascendente, incluye el actual). */
export const monthKeys = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => format(startOfMonth(subMonths(new Date(), n - 1 - i)), "yyyy-MM"));

export const monthLabel = (key: string): string =>
  format(new Date(`${key}-01T00:00:00`), "MMM yy", { locale: es });

const inMonth = (iso: string | null | undefined, key: string) => !!iso && iso.startsWith(key);

// ─── Cálculo mensual ─────────────────────────────────────────
const sum = (rows: any[], f: (r: any) => number) => rows.reduce((s, r) => s + (f(r) || 0), 0);

export function metricMonthly(id: string, ds: MetricDatasets, key: string): number {
  const inv = ds.invoices;
  switch (id) {
    // Facturación
    case "ingresos":
      return sum(inv.filter((i) => i.type === "INVOICE" && inMonth(i.issue_date, key)), (i) => Number(i.amount_total));
    case "gastos":
      return sum(inv.filter((i) => i.type === "EXPENSE" && inMonth(i.issue_date, key)), (i) => Number(i.amount_total));
    case "resultado":
      return metricMonthly("ingresos", ds, key) - metricMonthly("gastos", ds, key);
    case "base_imponible":
      return sum(inv.filter((i) => i.type === "INVOICE" && inMonth(i.issue_date, key)), (i) => Number(i.amount_net || 0));
    case "facturas_emitidas":
      return inv.filter((i) => i.type === "INVOICE" && inMonth(i.issue_date, key)).length;
    case "gastos_registrados":
      return inv.filter((i) => i.type === "EXPENSE" && inMonth(i.issue_date, key)).length;
    case "presupuestos":
      return inv.filter((i) => i.type === "QUOTE" && inMonth(i.issue_date, key)).length;
    case "ticket_medio": {
      const n = metricMonthly("facturas_emitidas", ds, key);
      return n > 0 ? metricMonthly("ingresos", ds, key) / n : 0;
    }
    // Impuestos
    case "iva_repercutido":
      return sum(inv.filter((i) => i.type === "INVOICE" && inMonth(i.issue_date, key)), (i) => Number(i.amount_vat || 0));
    case "iva_soportado":
      return sum(inv.filter((i) => i.type === "EXPENSE" && inMonth(i.issue_date, key)), (i) => Number(i.amount_vat || 0));
    case "iva_neto":
      return metricMonthly("iva_repercutido", ds, key) - metricMonthly("iva_soportado", ds, key);
    // Cobros (por mes de emisión de la factura)
    case "cobrado":
      return sum(inv.filter((i) => i.type === "INVOICE" && i.status === "PAID" && inMonth(i.issue_date, key)), (i) => Number(i.amount_total));
    case "pendiente_cobro":
      return sum(
        inv.filter((i) => i.type === "INVOICE" && ["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(i.status) && inMonth(i.issue_date, key)),
        (i) => Number(i.amount_total),
      );
    case "facturas_vencidas": {
      const now = new Date();
      return inv.filter((i) =>
        i.type === "INVOICE" && inMonth(i.issue_date, key) && i.status !== "PAID" &&
        (i.status === "OVERDUE" || (i.due_date && new Date(i.due_date) < now)),
      ).length;
    }
    // Clientes
    case "clientes_nuevos":
      return ds.clients.filter((c) => inMonth(c.created_at, key)).length;
    case "clientes_activos":
      // Acumulado: activos creados hasta el final de este mes
      return ds.clients.filter((c) => c.status === "ACTIVE" && c.created_at.slice(0, 7) <= key).length;
    case "clientes_facturados":
      return new Set(
        inv.filter((i) => i.type === "INVOICE" && inMonth(i.issue_date, key) && i.client_id).map((i) => i.client_id),
      ).size;
    // Tareas
    case "tareas_creadas":
      return ds.tasks.filter((t) => inMonth(t.created_at, key)).length;
    case "tareas_completadas":
      return ds.tasks.filter((t) => t.is_completed && inMonth(t.completed_at || t.created_at, key)).length;
    case "tareas_chat":
      return ds.tasks.filter((t) => t.origin === "CHAT" && inMonth(t.created_at, key)).length;
    // Equipo
    case "horas_trabajadas":
      return sum(
        ds.attendance.filter((a) => inMonth(a.work_date, key) && a.check_in && a.check_out),
        (a) => (new Date(a.check_out!).getTime() - new Date(a.check_in!).getTime()) / 3_600_000,
      );
    case "fichajes":
      return ds.attendance.filter((a) => inMonth(a.work_date, key)).length;
    // Chat
    case "conversaciones":
      return ds.conversations.filter((c) => inMonth(c.created_at, key)).length;
    default:
      return 0;
  }
}

/** Serie mensual de una métrica para los últimos n meses. */
export function metricSeries(id: string, ds: MetricDatasets, months: number): { key: string; label: string; value: number }[] {
  return monthKeys(months).map((key) => ({ key, label: monthLabel(key), value: metricMonthly(id, ds, key) }));
}

/** Total de una métrica en los últimos n meses (media si es acumulada: se usa el último mes). */
export function metricTotal(id: string, ds: MetricDatasets, months: number): number {
  const def = metricDef(id);
  const keys = monthKeys(months);
  if (def?.cumulative) return metricMonthly(id, ds, keys[keys.length - 1]);
  if (id === "ticket_medio") {
    // Media ponderada del periodo, no suma de medias mensuales
    const totalIngresos = keys.reduce((s, k) => s + metricMonthly("ingresos", ds, k), 0);
    const totalFacturas = keys.reduce((s, k) => s + metricMonthly("facturas_emitidas", ds, k), 0);
    return totalFacturas > 0 ? totalIngresos / totalFacturas : 0;
  }
  return keys.reduce((s, k) => s + metricMonthly(id, ds, k), 0);
}

// ─── Formato ─────────────────────────────────────────────────
export function formatMetric(value: number, unit: MetricUnit): string {
  switch (unit) {
    case "EUR":
      return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
    case "HOURS":
      return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value)} h`;
    case "PCT":
      return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value)} %`;
    default:
      return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(value);
  }
}

// ─── Widgets ─────────────────────────────────────────────────
export type WidgetType = "kpi" | "line" | "bar" | "area" | "ratio";

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  metric: string;
  /** Denominador (solo para type "ratio") */
  metricB?: string;
  /** Meses del periodo (serie o ventana del total) */
  months: number;
  /** Título personalizado (por defecto, el nombre de la métrica) */
  title?: string;
  /** Ratio: mostrar como porcentaje (numerador/denominador × 100) */
  percent?: boolean;
}

export const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: "w1", type: "line", metric: "ingresos", months: 12 },
  { id: "w2", type: "bar", metric: "clientes_nuevos", months: 12 },
  { id: "w3", type: "kpi", metric: "resultado", months: 12 },
  { id: "w4", type: "ratio", metric: "resultado", metricB: "ingresos", months: 12, percent: true, title: "Margen sobre ingresos" },
];

export function widgetTitle(w: DashboardWidget): string {
  if (w.title?.trim()) return w.title.trim();
  const a = metricDef(w.metric)?.label || w.metric;
  if (w.type === "ratio") {
    const b = metricDef(w.metricB || "")?.label || w.metricB;
    return `${a} / ${b}`;
  }
  return a;
}
