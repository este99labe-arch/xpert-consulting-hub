// Formateadores únicos de la aplicación (es-ES).
// Usar SIEMPRE estos helpers en lugar de toLocaleString inline.

/** Moneda EUR con 2 decimales: 1.234,56 € */
export const fmtEUR = (n: number | string | null | undefined): string =>
  Number(n ?? 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

/** Moneda EUR sin decimales (KPIs y espacios reducidos): 1.235 € */
export const fmtEUR0 = (n: number | string | null | undefined): string =>
  Number(n ?? 0).toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** Fecha corta: 05/07/2026 */
export const fmtDate = (d: string | Date | null | undefined): string =>
  d ? new Date(d).toLocaleDateString("es-ES") : "—";

/** Fecha y hora: 05/07/2026, 14:30 */
export const fmtDateTime = (d: string | Date | null | undefined): string =>
  d
    ? new Date(d).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

/** Porcentaje: 21 % */
export const fmtPct = (n: number | string | null | undefined): string =>
  `${Number(n ?? 0).toLocaleString("es-ES", { maximumFractionDigits: 2 })} %`;

/** Minutos a "Xh YYm" (fichajes, balances) */
export const fmtMinutes = (mins: number): string => {
  const sign = mins < 0 ? "-" : "";
  const a = Math.abs(Math.round(mins));
  return `${sign}${Math.floor(a / 60)}h ${(a % 60).toString().padStart(2, "0")}m`;
};
