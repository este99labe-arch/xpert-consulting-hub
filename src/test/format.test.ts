import { describe, it, expect } from "vitest";
import { fmtEUR, fmtEUR0, fmtDate, fmtPct, fmtMinutes } from "@/lib/format";

// Normaliza espacios no separables que introduce toLocaleString
const n = (s: string) => s.replace(/ | /g, " ");

describe("fmtEUR", () => {
  it("formatea con 2 decimales y símbolo €", () => {
    expect(n(fmtEUR(12345.67))).toBe("12.345,67 €");
  });
  it("trata null/undefined como 0", () => {
    expect(n(fmtEUR(null))).toBe("0,00 €");
    expect(n(fmtEUR(undefined))).toBe("0,00 €");
  });
  it("acepta strings numéricos", () => {
    expect(n(fmtEUR("10"))).toBe("10,00 €");
  });
});

describe("fmtEUR0", () => {
  it("redondea sin decimales", () => {
    expect(n(fmtEUR0(12345.67))).toBe("12.346 €");
  });
});

describe("fmtDate", () => {
  it("devuelve — para vacío", () => {
    expect(fmtDate(null)).toBe("—");
  });
  it("formatea fechas ISO", () => {
    expect(fmtDate("2026-07-05T10:00:00Z")).toMatch(/5\/7\/2026|05\/07\/2026/);
  });
});

describe("fmtPct", () => {
  it("añade el símbolo %", () => {
    expect(fmtPct(21)).toBe("21 %");
  });
});

describe("fmtMinutes", () => {
  it("convierte minutos a Xh YYm", () => {
    expect(fmtMinutes(90)).toBe("1h 30m");
    expect(fmtMinutes(0)).toBe("0h 00m");
  });
  it("conserva el signo negativo", () => {
    expect(fmtMinutes(-30)).toBe("-0h 30m");
  });
});
