import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfWeek, addDays, differenceInCalendarWeeks, isFuture, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtEUR } from "@/lib/format";

const WEEKS = 7;
const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

/** Escala secuencial azul: cuanto más se factura, más saturada la celda. */
const STEPS = ["bg-chart-5", "bg-chart-4", "bg-chart-3", "bg-chart-2", "bg-chart-1"];

interface Props {
  /** Facturas emitidas: se usan issue_date y amount_total. */
  invoices: { type: string; issue_date: string; amount_total: number | string }[];
}

/**
 * Ritmo de facturación por día de la semana.
 *
 * El dossier pide aquí un mapa de calor de cohortes, pero la app no tiene dato
 * de cohortes: inventarlo daría un gráfico bonito que no significa nada. Se
 * conserva la forma —rejilla, escala secuencial, lectura al pie— sobre el dato
 * que sí existe, que además responde a una pregunta real: en qué días se
 * concentra la emisión.
 */
const BillingHeatmap = ({ invoices }: Props) => {
  const navigate = useNavigate();

  const { grid, weekLabels, max, busiestDay } = useMemo(() => {
    const today = new Date();
    const firstWeek = startOfWeek(addDays(today, -7 * (WEEKS - 1)), { weekStartsOn: 1 });

    const totals = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.type !== "INVOICE" || !inv.issue_date) continue;
      totals.set(inv.issue_date, (totals.get(inv.issue_date) ?? 0) + Number(inv.amount_total || 0));
    }

    const grid: { date: Date; amount: number; future: boolean }[][] = [];
    const weekLabels: string[] = [];
    for (let w = 0; w < WEEKS; w++) {
      const weekStart = addDays(firstWeek, w * 7);
      weekLabels.push(format(weekStart, "d MMM", { locale: es }));
      const row: { date: Date; amount: number; future: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(weekStart, d);
        row.push({
          date,
          amount: totals.get(format(date, "yyyy-MM-dd")) ?? 0,
          future: isFuture(date) && !isSameDay(date, today),
        });
      }
      grid.push(row);
    }

    const max = Math.max(...grid.flat().map((c) => c.amount), 0);

    const perDay = DAY_LABELS.map((_, d) => grid.reduce((s, row) => s + row[d].amount, 0));
    const best = perDay.indexOf(Math.max(...perDay));
    const busiestDay = perDay[best] > 0 ? { index: best, amount: perDay[best] } : null;

    return { grid, weekLabels, max, busiestDay };
  }, [invoices]);

  const stepFor = (amount: number, future: boolean) => {
    if (future || max === 0) return STEPS[0];
    if (amount === 0) return STEPS[0];
    const ratio = amount / max;
    if (ratio > 0.75) return STEPS[4];
    if (ratio > 0.5) return STEPS[3];
    if (ratio > 0.25) return STEPS[2];
    return STEPS[1];
  };

  const weekdayName = busiestDay
    ? format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), busiestDay.index), "EEEE", { locale: es })
    : null;

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Ritmo de facturación</CardTitle>
        <div className="flex items-center gap-1" aria-hidden>
          {STEPS.map((s) => (
            <span key={s} className={cn("h-[9px] w-[14px] rounded-[2px]", s)} />
          ))}
        </div>
      </CardHeader>

      <div className="px-[18px]">
        <div className="grid grid-cols-[70px_repeat(7,1fr)] gap-1">
          <span />
          {DAY_LABELS.map((d) => (
            <span key={d} className="pb-1 text-center font-mono text-[9.5px] font-semibold text-faint">
              {d}
            </span>
          ))}

          {grid.map((row, w) => (
            <div key={w} className="contents">
              <span className="flex items-center font-mono text-[9.5px] text-faint">{weekLabels[w]}</span>
              {row.map((cell) => (
                <div
                  key={cell.date.toISOString()}
                  title={`${format(cell.date, "d MMM", { locale: es })} · ${fmtEUR(cell.amount)}`}
                  className={cn(
                    "flex h-7 items-center justify-center rounded-[4px] font-mono text-[9.5px] text-figure",
                    stepFor(cell.amount, cell.future),
                    cell.future && "opacity-40",
                  )}
                >
                  {cell.amount > 0 ? Math.round(cell.amount / 1000) || "" : ""}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-auto px-[18px] pb-4 pt-3.5 text-[11.5px] leading-[1.6] text-muted-foreground">
        {weekdayName ? (
          <>
            El <span className="text-foreground">{weekdayName}</span> concentra la mayor emisión de
            las últimas {WEEKS} semanas. Las cifras son miles de euros.{" "}
          </>
        ) : (
          <>Todavía no hay facturas emitidas en las últimas {WEEKS} semanas. </>
        )}
        <button
          type="button"
          onClick={() => navigate("/app/invoices?type=INVOICE")}
          className="text-accent-foreground transition-colors hover:underline"
        >
          Ver facturas
        </button>
      </p>
    </Card>
  );
};

export default BillingHeatmap;
