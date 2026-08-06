import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTreasuryBalance } from "@/components/accounting/TreasuryKpi";
import { fmtEUR } from "@/lib/format";

interface Props {
  accountId: string;
  /** Serie de saldo acumulado, la más antigua primero. */
  trend: { label: string; value: number }[];
  /** Gasto medio mensual, para estimar cuánto aguanta la caja. */
  monthlyBurn: number;
}

/**
 * Caja disponible: la cifra protagonista del dashboard.
 *
 * Es el único sitio donde aparece el saldo de tesorería — antes lo repetían
 * TreasuryKpi y una de las ocho tarjetas KPI, y bastaba con que una calculara
 * distinto para que el panel se contradijera a sí mismo.
 */
const CashFeatureCard = ({ accountId, trend, monthlyBurn }: Props) => {
  const navigate = useNavigate();
  const { data, isLoading } = useTreasuryBalance(accountId);
  const balance = data?.balance ?? 0;

  const variation = useMemo(() => {
    if (trend.length < 2) return null;
    const first = trend[0].value;
    const last = trend[trend.length - 1].value;
    if (!first) return null;
    return ((last - first) / Math.abs(first)) * 100;
  }, [trend]);

  // Meses que aguanta la caja al ritmo de gasto actual. Sin gasto no hay
  // horizonte que calcular, así que no se inventa ninguno.
  const runway = monthlyBurn > 0 && balance > 0 ? balance / monthlyBurn : null;

  const [whole, cents] = fmtEUR(balance).replace("€", "").trim().split(",");

  return (
    <Card tone="feature" className="flex flex-col overflow-hidden">
      <div className="px-[18px] pt-4">
        <div className="flex items-start justify-between gap-3">
          <span className="text-[11px] font-medium text-muted-foreground">Caja disponible</span>
          {variation !== null && (
            <Badge variant={variation >= 0 ? "success" : "softDestructive"} className="tnum">
              {variation >= 0 ? "+" : ""}
              {variation.toFixed(1)} %
            </Badge>
          )}
        </div>

        <div className="mt-2.5 flex items-baseline gap-1.5">
          <span className="tnum text-[44px] font-semibold leading-none tracking-[-.03em] text-figure">
            {isLoading ? "—" : whole}
            {cents && <span className="text-[26px]">,{cents}</span>}
          </span>
          <span className="tnum text-[22px] font-semibold text-subtle">€</span>
        </div>

        <p className="mt-2.5 text-[11.5px] leading-[1.6] text-muted-foreground">
          {data?.entryCount === 0
            ? "Sin movimientos contabilizados todavía."
            : runway
              ? `Runway estimado ${runway.toFixed(1)} meses al ritmo de gasto actual.`
              : `Cuenta ${data?.treasuryCode ?? "572"} · ${data?.treasuryName ?? "Bancos"}.`}{" "}
          <button
            type="button"
            onClick={() => navigate("/app/accounting")}
            className="text-accent-foreground transition-colors hover:underline"
          >
            Ver tesorería
          </button>
        </p>
      </div>

      {/* Área pegada al borde inferior de la tarjeta */}
      <div className="mt-auto h-[132px] w-full pt-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trend} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="cashArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={1.5}
              fill="url(#cashArea)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default CashFeatureCard;
