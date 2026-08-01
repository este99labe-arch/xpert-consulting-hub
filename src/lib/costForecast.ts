import { format, parseISO } from "date-fns";

/** Clave de mes (yyyy-MM) a partir de una fecha o de una fecha ISO. */
export const monthKey = (d: Date | string): string =>
  format(typeof d === "string" ? parseISO(d) : d, "yyyy-MM");

export interface ForecastCost {
  monthly_amount: number | string;
  is_active: boolean;
  /** true (o ausente) = suscripción fija; false = gasto puntual. */
  is_recurring?: boolean | null;
  /** Primer mes en que aplica. En puntuales, el mes del gasto. */
  start_month?: string | null;
  /** Último mes en que aplica. null = indefinido. */
  end_month?: string | null;
}

/**
 * ¿Aplica este coste en el mes indicado (yyyy-MM)?
 *
 * - Recurrente (suscripción): desde `start_month` (o desde siempre) hasta
 *   `end_month` (o indefinidamente).
 * - Puntual: solo en el mes de `start_month`.
 *
 * Las filas antiguas no tienen fechas y `is_recurring` viene a true por
 * defecto, así que siguen aplicando todos los meses igual que antes de
 * introducir la periodicidad.
 */
export const costAppliesTo = (c: ForecastCost, key: string): boolean => {
  if (!c.is_active) return false;
  const start = c.start_month ? monthKey(c.start_month) : null;
  const end = c.end_month ? monthKey(c.end_month) : null;
  if (c.is_recurring === false) return start === key;
  if (start && key < start) return false;
  if (end && key > end) return false;
  return true;
};

/** Suma de los costes vigentes en un mes concreto. */
export const costOfMonth = (costs: ForecastCost[], key: string): number =>
  costs
    .filter((c) => costAppliesTo(c, key))
    .reduce((s, c) => s + Number(c.monthly_amount || 0), 0);
