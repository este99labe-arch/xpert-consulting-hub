// Extracción de fechas límite en lenguaje natural (castellano y catalán).
// Determinista: resuelve expresiones relativas respecto a la fecha del mensaje.
// Este módulo también está embebido en la edge function whatsapp_webhook —
// si cambias la lógica aquí, replica el cambio allí.

const WEEKDAYS: Record<string, number> = {
  // ISO: 1=lunes … 7=domingo — castellano
  lunes: 1, martes: 2, miercoles: 3, miércoles: 3, jueves: 4, viernes: 5, sabado: 6, sábado: 6, domingo: 7,
  // catalán
  dilluns: 1, dimarts: 2, dimecres: 3, dijous: 4, divendres: 5, dissabte: 6, diumenge: 7,
};

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  gener: 1, febrer: 2, "març": 3, maig: 5, juny: 6, juliol: 7, agost: 8,
  setembre: 9, octubre_ca: 10, novembre: 11, desembre: 12,
};

const strip = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const atNoon = (d: Date): Date => {
  const r = new Date(d);
  r.setHours(12, 0, 0, 0);
  return r;
};

const addDays = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

/**
 * Busca una expresión de plazo en el texto y devuelve la fecha resuelta
 * (a mediodía local) o null si no se detecta nada.
 *
 * Cubre: "hoy", "mañana", "pasado mañana", días de la semana ("el viernes",
 * "antes del jueves"), "esta semana", "la semana que viene", "el día 20",
 * "para el 20", fechas dd/mm y "el 20 de marzo". ES + CA.
 */
export function parseDueDate(text: string, now: Date = new Date()): Date | null {
  const t = " " + strip(text) + " ";

  // Hoy / mañana / pasado mañana (ES + CA)
  if (/\b(pasado manana|dema passat)\b/.test(t)) return atNoon(addDays(now, 2));
  if (/\b(manana|dema)\b/.test(t)) return atNoon(addDays(now, 1));
  if (/\b(para hoy|avui|hoy mismo)\b/.test(t)) return atNoon(now);

  // Semana: "esta semana" → viernes de esta semana; "semana que viene" → viernes de la próxima
  const isoDow = now.getDay() === 0 ? 7 : now.getDay();
  if (/\b(la )?(semana que viene|proxima semana|setmana que ve|propera setmana)\b/.test(t)) {
    return atNoon(addDays(now, 7 - isoDow + 5));
  }
  if (/\b(esta semana|aquesta setmana)\b/.test(t)) {
    return atNoon(addDays(now, Math.max(0, 5 - isoDow)));
  }

  // Día de la semana: "el viernes", "antes del jueves", "para el dimecres"
  const dowMatch = t.match(
    /\b(?:el |del |para el |abans de |antes del |antes de el |pel |per )?(lunes|martes|miercoles|jueves|viernes|sabado|domingo|dilluns|dimarts|dimecres|dijous|divendres|dissabte|diumenge)\b/,
  );
  if (dowMatch) {
    const target = WEEKDAYS[dowMatch[1]];
    if (target) {
      const ahead = (target - isoDow + 7) % 7; // 0 = hoy (el más próximo)
      return atNoon(addDays(now, ahead));
    }
  }

  // Fecha explícita dd/mm o dd-mm (año opcional)
  const dm = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (dm) {
    const day = Number(dm[1]);
    const month = Number(dm[2]);
    let year = dm[3] ? Number(dm[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const d = atNoon(new Date(year, month - 1, day));
      // Sin año explícito y ya pasada → el año que viene
      if (!dm[3] && d < atNoon(now)) d.setFullYear(d.getFullYear() + 1);
      return d;
    }
  }

  // "el 20 de marzo" / "el 20 de març"
  const dmName = t.match(/\b(?:el |dia |día |el dia )?(\d{1,2}) de ([a-z]+)\b/);
  if (dmName) {
    const day = Number(dmName[1]);
    const month = MONTHS[dmName[2]] || MONTHS[strip(dmName[2])];
    if (month && day >= 1 && day <= 31) {
      const d = atNoon(new Date(now.getFullYear(), month - 1, day));
      if (d < atNoon(now)) d.setFullYear(d.getFullYear() + 1);
      return d;
    }
  }

  // "el día 20", "para el 20"
  const dayOnly = t.match(/\b(?:el dia|para el dia|para el|pel dia|abans del dia|antes del dia)\s+(\d{1,2})\b/);
  if (dayOnly) {
    const day = Number(dayOnly[1]);
    if (day >= 1 && day <= 31) {
      const d = atNoon(new Date(now.getFullYear(), now.getMonth(), day));
      if (d < atNoon(now)) d.setMonth(d.getMonth() + 1);
      return d;
    }
  }

  return null;
}
