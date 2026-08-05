import { describe, it, expect } from "vitest";
import { periodLabel, buildConcept } from "./recurringPeriod";

describe("periodLabel", () => {
  it("mensual devuelve el nombre del mes", () => {
    expect(periodLabel("2026-08-01", "MONTHLY")).toBe("Agosto");
    expect(periodLabel("2026-01-15", "MONTHLY")).toBe("Enero");
    expect(periodLabel("2026-12-31", "MONTHLY")).toBe("Diciembre");
  });

  it("trimestral devuelve el trimestre y el año", () => {
    expect(periodLabel("2026-01-10", "QUARTERLY")).toBe("T1 2026");
    expect(periodLabel("2026-04-01", "QUARTERLY")).toBe("T2 2026");
    expect(periodLabel("2026-08-01", "QUARTERLY")).toBe("T3 2026");
    expect(periodLabel("2026-10-01", "QUARTERLY")).toBe("T4 2026");
  });

  it("anual devuelve el año", () => {
    expect(periodLabel("2026-08-01", "YEARLY")).toBe("2026");
  });

  it("una frecuencia desconocida se trata como mensual", () => {
    expect(periodLabel("2026-08-01", "RARO")).toBe("Agosto");
  });
});

describe("buildConcept", () => {
  it("añade el periodo cuando está activado", () => {
    expect(buildConcept("Suscripción Claude", "MONTHLY", "2026-08-01", true))
      .toBe("Suscripción Claude - Agosto");
  });

  it("deja el concepto intacto cuando está desactivado", () => {
    expect(buildConcept("Suscripción Claude", "MONTHLY", "2026-08-01", false))
      .toBe("Suscripción Claude");
  });

  it("usa la etiqueta trimestral con esa frecuencia", () => {
    expect(buildConcept("Mantenimiento", "QUARTERLY", "2026-08-01", true))
      .toBe("Mantenimiento - T3 2026");
  });
});
