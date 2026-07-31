-- Saldo de tesorería: el dinero del que dispone la empresa para operar.
--
-- Clave del diseño: la cuenta de tesorería NO se fija aquí, se resuelve con
-- _acc_resolver (account_settings.acc_treasury, por defecto '572'), que es la
-- misma que usa el motor contable al generar los asientos de cobro y pago.
-- Así el KPI cuadra siempre con la contabilidad, aunque se cambie la cuenta.
--
-- Solo cuenta apuntes POSTED: los borradores no representan dinero real.
CREATE OR REPLACE FUNCTION public.treasury_balance(_account_id uuid)
RETURNS TABLE(
  treasury_code text,
  treasury_name text,
  balance numeric,
  cash_code text,
  cash_name text,
  cash_balance numeric,
  entry_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_treas_code text;
BEGIN
  IF _account_id IS DISTINCT FROM public.get_user_account_id(auth.uid())
     AND NOT public.has_role(auth.uid(), 'MASTER_ADMIN') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT r.treas INTO v_treas_code FROM public._acc_resolver(_account_id) r;

  RETURN QUERY
  WITH saldos AS (
    SELECT ca.code, ca.name,
           COALESCE(SUM(jel.debit - jel.credit), 0) AS saldo,
           count(jel.id) AS n
      FROM public.chart_of_accounts ca
      LEFT JOIN public.journal_entry_lines jel ON jel.chart_account_id = ca.id
      LEFT JOIN public.journal_entries je
             ON je.id = jel.entry_id AND je.status = 'POSTED'
     WHERE ca.account_id = _account_id
       AND ca.code IN (v_treas_code, '570')
     GROUP BY ca.code, ca.name
  )
  SELECT
    t.code, t.name, t.saldo,
    c.code, c.name, COALESCE(c.saldo, 0),
    COALESCE(t.n, 0)
  FROM (SELECT * FROM saldos WHERE code = v_treas_code) t
  LEFT JOIN (SELECT * FROM saldos WHERE code = '570') c ON true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.treasury_balance(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.treasury_balance(uuid) TO authenticated;
