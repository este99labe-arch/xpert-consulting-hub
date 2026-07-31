import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import StatCard from "@/components/shared/StatCard";
import { Wallet, Banknote } from "lucide-react";
import { fmtEUR as EUR } from "@/lib/format";

interface Props {
  accountId: string;
  /** Muestra también el efectivo en caja (570) junto al saldo bancario. */
  showCash?: boolean;
  className?: string;
}

/**
 * Dinero disponible para operar (saldo de tesorería).
 *
 * La cuenta de tesorería NO está fijada aquí: la RPC la resuelve desde los
 * ajustes contables (account_settings.acc_treasury, por defecto 572), que es la
 * misma que usa el motor al generar los asientos de cobro y pago. Así el KPI
 * cuadra siempre con la contabilidad, aunque se cambie la cuenta.
 *
 * Solo suma apuntes contabilizados (POSTED): los borradores no son dinero real.
 */
export const useTreasuryBalance = (accountId?: string) =>
  useQuery({
    queryKey: ["treasury-balance", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("treasury_balance", { _account_id: accountId! });
      if (error) throw error;
      const row = ((data as any[]) || [])[0];
      return row
        ? {
            treasuryCode: row.treasury_code as string,
            treasuryName: row.treasury_name as string,
            balance: Number(row.balance ?? 0),
            cashCode: row.cash_code as string | null,
            cashBalance: Number(row.cash_balance ?? 0),
            entryCount: Number(row.entry_count ?? 0),
          }
        : null;
    },
    enabled: !!accountId,
  });

const TreasuryKpi = ({ accountId, showCash = false, className }: Props) => {
  const { data, isLoading } = useTreasuryBalance(accountId);

  if (isLoading || !data) {
    return (
      <StatCard
        label="Disponible en banco"
        value={isLoading ? "…" : EUR(0)}
        icon={Banknote}
        tone="primary"
        className={className}
      />
    );
  }

  // En negativo (descubierto) se marca como incidencia, no como saldo sano.
  const tone = data.balance < 0 ? "destructive" : "primary";

  return (
    <>
      <StatCard
        label="Disponible en banco"
        value={EUR(data.balance)}
        icon={Banknote}
        tone={tone}
        hint={
          data.entryCount === 0
            ? "Sin movimientos contabilizados todavía"
            : `Cuenta ${data.treasuryCode} · ${data.treasuryName}`
        }
        className={className}
      />
      {showCash && (
        <StatCard
          label="Efectivo en caja"
          value={EUR(data.cashBalance)}
          icon={Wallet}
          tone={data.cashBalance < 0 ? "destructive" : "default"}
          hint={data.cashCode ? `Cuenta ${data.cashCode}` : undefined}
        />
      )}
    </>
  );
};

export default TreasuryKpi;
