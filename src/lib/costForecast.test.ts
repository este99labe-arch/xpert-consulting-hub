import { describe, it, expect } from "vitest";
import { costAppliesTo, costOfMonth, type ForecastCost } from "./costForecast";

const base: ForecastCost = { monthly_amount: 100, is_active: true };

describe("costAppliesTo", () => {
  it("aplica siempre a las filas antiguas (sin fechas ni periodicidad)", () => {
    // Retrocompatibilidad: es el comportamiento previo a la migración.
    expect(costAppliesTo(base, "2026-01")).toBe(true);
    expect(costAppliesTo(base, "2030-12")).toBe(true);
  });

  it("ignora los costes desactivados", () => {
    expect(costAppliesTo({ ...base, is_active: false }, "2026-07")).toBe(false);
  });

  it("una suscripción no aplica antes de su mes de alta", () => {
    const c = { ...base, is_recurring: true, start_month: "2026-07-01" };
    expect(costAppliesTo(c, "2026-06")).toBe(false);
    expect(costAppliesTo(c, "2026-07")).toBe(true);
    expect(costAppliesTo(c, "2027-03")).toBe(true);
  });

  it("una suscripción de baja deja de aplicar tras su último mes", () => {
    const c = { ...base, is_recurring: true, start_month: "2026-01-01", end_month: "2026-07-01" };
    expect(costAppliesTo(c, "2026-07")).toBe(true);
    expect(costAppliesTo(c, "2026-08")).toBe(false);
  });

  it("un coste puntual solo cuenta en su mes", () => {
    const c = { ...base, is_recurring: false, start_month: "2026-07-01" };
    expect(costAppliesTo(c, "2026-06")).toBe(false);
    expect(costAppliesTo(c, "2026-07")).toBe(true);
    expect(costAppliesTo(c, "2026-08")).toBe(false);
  });

  it("respeta el cambio de año al comparar meses", () => {
    const c = { ...base, is_recurring: true, start_month: "2026-12-01" };
    expect(costAppliesTo(c, "2026-11")).toBe(false);
    expect(costAppliesTo(c, "2027-01")).toBe(true);
  });
});

describe("costOfMonth", () => {
  const costs: ForecastCost[] = [
    { monthly_amount: 500, is_active: true },                                             // heredado
    { monthly_amount: 20, is_active: true, is_recurring: true, start_month: "2026-07-01" }, // alta jul
    { monthly_amount: 99, is_active: true, is_recurring: false, start_month: "2026-07-01" },// puntual jul
    { monthly_amount: 300, is_active: false },                                             // desactivado
  ];

  it("suma solo lo vigente en cada mes", () => {
    expect(costOfMonth(costs, "2026-06")).toBe(500);
    expect(costOfMonth(costs, "2026-07")).toBe(619); // 500 + 20 + 99
    expect(costOfMonth(costs, "2026-08")).toBe(520); // el puntual ya no cuenta
  });

  it("acepta importes en texto (vienen así de numeric)", () => {
    expect(costOfMonth([{ monthly_amount: "12.50", is_active: true }], "2026-07")).toBe(12.5);
  });
});
