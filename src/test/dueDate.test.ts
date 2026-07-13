import { describe, it, expect } from "vitest";
import { parseDueDate } from "@/lib/dueDate";

// Miércoles 8 de julio de 2026, 10:00
const NOW = new Date(2026, 6, 8, 10, 0, 0);

const day = (d: Date | null) => d && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("parseDueDate (ES)", () => {
  it("mañana / pasado mañana / hoy", () => {
    expect(day(parseDueDate("lo necesito para mañana", NOW))).toBe("2026-07-09");
    expect(day(parseDueDate("pasado mañana si puede ser", NOW))).toBe("2026-07-10");
    expect(day(parseDueDate("para hoy por favor", NOW))).toBe("2026-07-08");
  });

  it("días de la semana relativos", () => {
    expect(day(parseDueDate("lo quiero antes del viernes", NOW))).toBe("2026-07-10");
    expect(day(parseDueDate("tiene que estar el jueves", NOW))).toBe("2026-07-09");
    // lunes: ya pasó esta semana → el próximo
    expect(day(parseDueDate("para el lunes", NOW))).toBe("2026-07-13");
    // hoy es miércoles → "el miércoles" = hoy (el más próximo)
    expect(day(parseDueDate("para el miércoles", NOW))).toBe("2026-07-08");
  });

  it("semana actual y próxima", () => {
    expect(day(parseDueDate("lo necesito esta semana", NOW))).toBe("2026-07-10");
    expect(day(parseDueDate("la semana que viene está bien", NOW))).toBe("2026-07-17");
  });

  it("día del mes y fechas explícitas", () => {
    expect(day(parseDueDate("para el día 20", NOW))).toBe("2026-07-20");
    // día 5 ya pasó en julio → agosto
    expect(day(parseDueDate("antes del día 5", NOW))).toBe("2026-08-05");
    expect(day(parseDueDate("el 20/07 a más tardar", NOW))).toBe("2026-07-20");
    expect(day(parseDueDate("el 15/03/2027", NOW))).toBe("2027-03-15");
    expect(day(parseDueDate("para el 20 de septiembre", NOW))).toBe("2026-09-20");
    // mes ya pasado sin año → siguiente año
    expect(day(parseDueDate("el 10 de enero", NOW))).toBe("2027-01-10");
  });

  it("sin fecha → null", () => {
    expect(parseDueDate("necesito la factura de marzo en PDF", NOW)).toBeNull();
    expect(parseDueDate("hola, ¿me puedes ayudar?", NOW)).toBeNull();
  });
});

describe("parseDueDate (CA)", () => {
  it("demà / demà passat / avui", () => {
    expect(day(parseDueDate("ho necessito per demà", NOW))).toBe("2026-07-09");
    expect(day(parseDueDate("demà passat", NOW))).toBe("2026-07-10");
    expect(day(parseDueDate("per avui", NOW))).toBe("2026-07-08");
  });

  it("dies de la setmana", () => {
    expect(day(parseDueDate("abans de divendres", NOW))).toBe("2026-07-10");
    expect(day(parseDueDate("ha d'estar dijous", NOW))).toBe("2026-07-09");
  });

  it("setmana que ve", () => {
    expect(day(parseDueDate("la setmana que ve", NOW))).toBe("2026-07-17");
  });
});
