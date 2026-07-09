import { describe, it, expect } from "vitest";
import { format } from "date-fns";
import {
  metricMonthly, metricSeries, metricTotal, formatMetric, monthKeys, widgetTitle,
  METRICS, type MetricDatasets,
} from "@/lib/dashboardMetrics";

const thisMonth = format(new Date(), "yyyy-MM");

const ds: MetricDatasets = {
  invoices: [
    { type: "INVOICE", status: "PAID", issue_date: `${thisMonth}-05`, amount_total: 1210, amount_net: 1000, amount_vat: 210, client_id: "c1" },
    { type: "INVOICE", status: "SENT", issue_date: `${thisMonth}-10`, amount_total: 605, amount_net: 500, amount_vat: 105, client_id: "c2" },
    { type: "EXPENSE", status: "PAID", issue_date: `${thisMonth}-12`, amount_total: 121, amount_net: 100, amount_vat: 21 },
    { type: "QUOTE", status: "DRAFT", issue_date: `${thisMonth}-15`, amount_total: 999 },
  ],
  clients: [
    { created_at: `${thisMonth}-01T10:00:00Z`, status: "ACTIVE" },
    { created_at: "2020-01-01T10:00:00Z", status: "ACTIVE" },
    { created_at: "2020-01-01T10:00:00Z", status: "INACTIVE" },
  ],
  tasks: [
    { created_at: `${thisMonth}-02T10:00:00Z`, completed_at: `${thisMonth}-03T10:00:00Z`, is_completed: true, origin: "CHAT" },
    { created_at: `${thisMonth}-04T10:00:00Z`, completed_at: null, is_completed: false, origin: "MANUAL" },
  ],
  attendance: [
    { work_date: `${thisMonth}-03`, check_in: `${thisMonth}-03T08:00:00Z`, check_out: `${thisMonth}-03T16:00:00Z` },
  ],
  conversations: [{ created_at: `${thisMonth}-05T09:00:00Z` }],
};

describe("dashboardMetrics", () => {
  it("agrega ingresos y gastos por mes", () => {
    expect(metricMonthly("ingresos", ds, thisMonth)).toBe(1815);
    expect(metricMonthly("gastos", ds, thisMonth)).toBe(121);
    expect(metricMonthly("resultado", ds, thisMonth)).toBe(1694);
  });

  it("cuenta documentos por tipo", () => {
    expect(metricMonthly("facturas_emitidas", ds, thisMonth)).toBe(2);
    expect(metricMonthly("gastos_registrados", ds, thisMonth)).toBe(1);
    expect(metricMonthly("presupuestos", ds, thisMonth)).toBe(1);
  });

  it("calcula IVA y cobros", () => {
    expect(metricMonthly("iva_repercutido", ds, thisMonth)).toBe(315);
    expect(metricMonthly("iva_soportado", ds, thisMonth)).toBe(21);
    expect(metricMonthly("iva_neto", ds, thisMonth)).toBe(294);
    expect(metricMonthly("cobrado", ds, thisMonth)).toBe(1210);
    expect(metricMonthly("pendiente_cobro", ds, thisMonth)).toBe(605);
  });

  it("clientes: nuevos, activos acumulados y facturados", () => {
    expect(metricMonthly("clientes_nuevos", ds, thisMonth)).toBe(1);
    expect(metricMonthly("clientes_activos", ds, thisMonth)).toBe(2); // solo ACTIVE
    expect(metricMonthly("clientes_facturados", ds, thisMonth)).toBe(2);
  });

  it("tareas y equipo", () => {
    expect(metricMonthly("tareas_creadas", ds, thisMonth)).toBe(2);
    expect(metricMonthly("tareas_completadas", ds, thisMonth)).toBe(1);
    expect(metricMonthly("tareas_chat", ds, thisMonth)).toBe(1);
    expect(metricMonthly("horas_trabajadas", ds, thisMonth)).toBe(8);
    expect(metricMonthly("conversaciones", ds, thisMonth)).toBe(1);
  });

  it("serie mensual con longitud y mes actual al final", () => {
    const s = metricSeries("ingresos", ds, 6);
    expect(s).toHaveLength(6);
    expect(s[5].key).toBe(thisMonth);
    expect(s[5].value).toBe(1815);
    expect(s[0].value).toBe(0);
  });

  it("metricTotal: suma del periodo, acumuladas usan el último mes", () => {
    expect(metricTotal("ingresos", ds, 6)).toBe(1815);
    expect(metricTotal("clientes_activos", ds, 6)).toBe(2);
    // ticket medio ponderado: 1815 / 2 facturas
    expect(metricTotal("ticket_medio", ds, 6)).toBeCloseTo(907.5);
  });

  it("formato por unidad", () => {
    expect(formatMetric(1500, "EUR")).toContain("€");
    expect(formatMetric(7.25, "HOURS")).toContain("h");
    expect(formatMetric(12.3, "PCT")).toContain("%");
  });

  it("monthKeys devuelve claves ascendentes acabando en el mes actual", () => {
    const keys = monthKeys(12);
    expect(keys).toHaveLength(12);
    expect(keys[11]).toBe(thisMonth);
    expect([...keys].sort()).toEqual(keys);
  });

  it("todas las métricas del catálogo calculan sin lanzar", () => {
    for (const m of METRICS) {
      expect(() => metricMonthly(m.id, ds, thisMonth)).not.toThrow();
    }
  });

  it("widgetTitle usa etiqueta de la métrica o título propio", () => {
    expect(widgetTitle({ id: "x", type: "line", metric: "ingresos", months: 12 })).toBe("Ingresos (facturado)");
    expect(widgetTitle({ id: "x", type: "ratio", metric: "resultado", metricB: "ingresos", months: 12, title: "Margen" })).toBe("Margen");
  });
});
