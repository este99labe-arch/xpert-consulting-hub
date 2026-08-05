/**
 * Etiqueta del periodo facturado por una plantilla recurrente.
 *
 * OJO: esta lógica está duplicada en la Edge Function
 * `process_recurring_invoices` porque corre en Deno y no puede importar de
 * `src/`. Si cambias una, cambia la otra. Aquí se usa para la vista previa.
 */
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Mensual → "Agosto" · Trimestral → "T3 2026" · Anual → "2026". */
export const periodLabel = (date: string | Date, frequency: string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  switch (frequency) {
    case "QUARTERLY":
      return `T${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
    case "YEARLY":
      return String(d.getFullYear());
    default:
      return MESES[d.getMonth()];
  }
};

/**
 * Concepto final de la factura generada. Si `appendPeriod` está activo se le
 * añade el periodo: "Suscripción Claude" → "Suscripción Claude - Agosto".
 */
export const buildConcept = (
  concept: string,
  frequency: string,
  date: string | Date,
  appendPeriod: boolean,
): string => (appendPeriod ? `${concept} - ${periodLabel(date, frequency)}` : concept);
