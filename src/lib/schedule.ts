// Motor de horarios: plantillas + personalización por empleado + festivos.
// Convención weekday: ISO 1=lunes … 7=domingo.

export interface TemplateSlot {
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface OverrideRow {
  weekday: number;
  day_off: boolean;
  start_time: string | null;
  end_time: string | null;
}

export interface DayPlan {
  off: boolean;
  slots: { start: string; end: string }[];
}

export type WeekPlan = Map<number, DayPlan>;

export const WEEKDAYS_ISO = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
];

export const DAY_CODE_TO_ISO: Record<string, number> = {
  MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6, SUN: 7,
};

/** Horas de un tramo; si end <= start se asume que cruza medianoche (turno noche). */
export function slotHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let h = eh + em / 60 - (sh + sm / 60);
  if (h <= 0) h += 24;
  return h;
}

/**
 * Construye el plan semanal efectivo de un empleado.
 * Prioridad: overrides del empleado > plantilla asignada > horario global de la empresa.
 */
export function buildWeekPlan(opts: {
  templateSlots?: TemplateSlot[] | null;
  overrides?: OverrideRow[] | null;
  fallback?: { workDays: string[]; start: string; end: string } | null;
}): WeekPlan {
  const plan: WeekPlan = new Map();
  for (let wd = 1; wd <= 7; wd++) plan.set(wd, { off: true, slots: [] });

  const tpl = opts.templateSlots || [];
  if (tpl.length > 0) {
    for (const s of tpl) {
      const d = plan.get(s.weekday);
      if (!d) continue;
      d.off = false;
      d.slots.push({ start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5) });
    }
  } else if (opts.fallback) {
    for (const code of opts.fallback.workDays) {
      const wd = DAY_CODE_TO_ISO[code];
      if (!wd) continue;
      plan.set(wd, { off: false, slots: [{ start: opts.fallback.start, end: opts.fallback.end }] });
    }
  }

  // La personalización sustituye el día completo
  const byDay = new Map<number, OverrideRow[]>();
  (opts.overrides || []).forEach((o) => {
    byDay.set(o.weekday, [...(byDay.get(o.weekday) || []), o]);
  });
  for (const [wd, rows] of byDay) {
    if (rows.some((r) => r.day_off)) {
      plan.set(wd, { off: true, slots: [] });
      continue;
    }
    const slots = rows
      .filter((r) => r.start_time && r.end_time)
      .map((r) => ({ start: r.start_time!.slice(0, 5), end: r.end_time!.slice(0, 5) }));
    if (slots.length > 0) plan.set(wd, { off: false, slots });
  }
  return plan;
}

export function dayExpectedHours(plan: WeekPlan, isoWeekday: number): number {
  const d = plan.get(isoWeekday);
  if (!d || d.off) return 0;
  return d.slots.reduce((sum, s) => sum + slotHours(s.start, s.end), 0);
}

const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Horas esperadas entre dos fechas (ambas incluidas), descontando festivos. */
export function expectedHoursBetween(plan: WeekPlan, from: Date, to: Date, holidays: Set<string>): number {
  let total = 0;
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (d <= end) {
    const iso = d.getDay() === 0 ? 7 : d.getDay();
    if (!holidays.has(toKey(d))) total += dayExpectedHours(plan, iso);
    d.setDate(d.getDate() + 1);
  }
  return total;
}

/** Resumen legible de un plan semanal, p. ej. "L-V 09:00-14:00 y 15:00-18:00". */
export function summarizeSlots(slots: TemplateSlot[]): string {
  if (!slots.length) return "Sin tramos";
  const days = [...new Set(slots.map((s) => s.weekday))].sort();
  const label =
    days.length ? `${WEEKDAYS_ISO[days[0] - 1].label.slice(0, 1)}–${WEEKDAYS_ISO[days[days.length - 1] - 1].label.slice(0, 1)}` : "";
  const uniq = [...new Set(slots.map((s) => `${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`))];
  return `${label} · ${uniq.join(" y ")}`;
}
