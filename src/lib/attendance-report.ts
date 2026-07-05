// Registro diario de jornada (art. 34.9 del Estatuto de los Trabajadores,
// RD-ley 8/2019): informe mensual por empleado con espacios para firma.
import jsPDF from "jspdf";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";

export interface AttendanceRecordRow {
  work_date: string;
  check_in: string | null;
  check_out: string | null;
}

export interface EmployeeReport {
  label: string; // nombre o email del empleado
  records: AttendanceRecordRow[];
}

const fmtMins = (mins: number) => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;

function drawEmployeePage(doc: jsPDF, company: string, monthLabel: string, emp: EmployeeReport) {
  const left = 15;
  const right = 195;
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Registro diario de jornada", left, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("Art. 34.9 del Estatuto de los Trabajadores (RD-ley 8/2019)", right, y, { align: "right" });
  doc.setTextColor(0);
  y += 9;

  doc.setFontSize(10);
  doc.text(`Empresa: ${company}`, left, y);
  doc.text(`Mes: ${monthLabel}`, right, y, { align: "right" });
  y += 6;
  doc.text(`Persona trabajadora: ${emp.label}`, left, y);
  y += 8;

  // Cabecera de tabla
  const cols = { fecha: left, entrada: 80, salida: 120, horas: right };
  const header = () => {
    doc.setFillColor(240, 243, 248);
    doc.rect(left - 2, y - 4.5, right - left + 4, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Fecha", cols.fecha, y);
    doc.text("Entrada", cols.entrada, y);
    doc.text("Salida", cols.salida, y);
    doc.text("Horas", cols.horas, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 6;
  };
  header();

  const sorted = [...emp.records].sort((a, b) => {
    const d = a.work_date.localeCompare(b.work_date);
    return d !== 0 ? d : (a.check_in || "").localeCompare(b.check_in || "");
  });

  let totalMins = 0;
  doc.setFontSize(9);
  for (const r of sorted) {
    if (y > 250) {
      doc.addPage();
      y = 18;
      header();
    }
    const ci = r.check_in ? format(parseISO(r.check_in), "HH:mm") : "—";
    const co = r.check_out ? format(parseISO(r.check_out), "HH:mm") : "—";
    const mins = r.check_in && r.check_out
      ? Math.max(0, differenceInMinutes(parseISO(r.check_out), parseISO(r.check_in)))
      : 0;
    totalMins += mins;
    doc.text(format(parseISO(r.work_date), "EEEE, dd/MM/yyyy", { locale: es }), cols.fecha, y);
    doc.text(ci, cols.entrada, y);
    doc.text(co, cols.salida, y);
    doc.text(mins ? fmtMins(mins) : "—", cols.horas, y, { align: "right" });
    doc.setDrawColor(230);
    doc.line(left - 2, y + 1.5, right + 2, y + 1.5);
    y += 6;
  }

  if (sorted.length === 0) {
    doc.setTextColor(120);
    doc.text("Sin fichajes registrados este mes.", left, y);
    doc.setTextColor(0);
    y += 6;
  }

  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Total del mes:", 120, y);
  doc.text(fmtMins(totalMins), right, y, { align: "right" });
  doc.setFont("helvetica", "normal");

  // Bloque de firmas
  if (y > 235) { doc.addPage(); y = 30; } else { y = Math.max(y + 22, 240); }
  doc.setDrawColor(60);
  doc.line(left, y, left + 70, y);
  doc.line(right - 70, y, right, y);
  doc.setFontSize(9);
  doc.text("Firma de la empresa", left, y + 5);
  doc.text("Firma de la persona trabajadora", right - 70, y + 5);
  doc.setFontSize(7.5);
  doc.setTextColor(120);
  doc.text(
    "Registro generado por XpertConsulting ERP. Debe conservarse durante cuatro años a disposición de la Inspección de Trabajo.",
    left, y + 14
  );
  doc.setTextColor(0);
}

/** Genera y descarga el registro mensual; una página (o más) por empleado. */
export function generateAttendanceReport(opts: {
  companyName: string;
  month: Date;
  employees: EmployeeReport[];
}) {
  const doc = new jsPDF();
  const monthLabel = format(opts.month, "MMMM yyyy", { locale: es });
  opts.employees.forEach((emp, i) => {
    if (i > 0) doc.addPage();
    drawEmployeePage(doc, opts.companyName, monthLabel, emp);
  });
  doc.save(`registro_jornada_${format(opts.month, "yyyy-MM")}.pdf`);
}
