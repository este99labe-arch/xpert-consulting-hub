import { describe, it, expect } from "vitest";
import { slotHours, buildWeekPlan, dayExpectedHours, expectedHoursBetween } from "@/lib/schedule";

describe("slotHours", () => {
  it("calcula horas de un tramo normal", () => {
    expect(slotHours("09:00", "14:00")).toBe(5);
    expect(slotHours("15:00", "18:30")).toBe(3.5);
  });
  it("soporta turno de noche que cruza medianoche", () => {
    expect(slotHours("22:00", "06:00")).toBe(8);
  });
});

describe("buildWeekPlan", () => {
  const partida = [
    { weekday: 1, start_time: "09:00", end_time: "14:00" },
    { weekday: 1, start_time: "15:00", end_time: "18:00" },
    { weekday: 2, start_time: "09:00", end_time: "14:00" },
  ];

  it("usa los tramos de la plantilla", () => {
    const plan = buildWeekPlan({ templateSlots: partida });
    expect(dayExpectedHours(plan, 1)).toBe(8); // jornada partida 5+3
    expect(dayExpectedHours(plan, 2)).toBe(5);
    expect(dayExpectedHours(plan, 6)).toBe(0); // sábado libre
  });

  it("cae al horario de empresa si no hay plantilla", () => {
    const plan = buildWeekPlan({
      fallback: { workDays: ["MON", "TUE", "WED", "THU", "FRI"], start: "09:00", end: "18:00" },
    });
    expect(dayExpectedHours(plan, 3)).toBe(9);
    expect(dayExpectedHours(plan, 7)).toBe(0); // domingo
  });

  it("los overrides sustituyen el día completo", () => {
    const plan = buildWeekPlan({
      templateSlots: partida,
      overrides: [
        { weekday: 1, day_off: true, start_time: null, end_time: null },           // lunes libre
        { weekday: 2, day_off: false, start_time: "08:00", end_time: "13:00" },    // martes personalizado
      ],
    });
    expect(dayExpectedHours(plan, 1)).toBe(0);
    expect(dayExpectedHours(plan, 2)).toBe(5);
  });
});

describe("expectedHoursBetween", () => {
  // Intensiva 7h L-V
  const plan = buildWeekPlan({
    fallback: { workDays: ["MON", "TUE", "WED", "THU", "FRI"], start: "08:00", end: "15:00" },
  });

  it("suma solo días laborables del rango", () => {
    // Lunes 6 a viernes 10 de julio de 2026
    const total = expectedHoursBetween(plan, new Date(2026, 6, 6), new Date(2026, 6, 10), new Set());
    expect(total).toBe(35);
  });

  it("descuenta los festivos", () => {
    const total = expectedHoursBetween(
      plan, new Date(2026, 6, 6), new Date(2026, 6, 10), new Set(["2026-07-09"])
    );
    expect(total).toBe(28);
  });

  it("incluye el fin de semana solo si el plan lo marca laborable", () => {
    const total = expectedHoursBetween(plan, new Date(2026, 6, 11), new Date(2026, 6, 12), new Set());
    expect(total).toBe(0); // sábado y domingo
  });
});
