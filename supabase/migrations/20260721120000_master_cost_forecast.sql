-- Previsión de costes mensuales de la cuenta matriz (XpertConsulting).
-- Cada fila es un coste recurrente mensual esperado; se compara con los
-- ingresos reales (facturas de la propia cuenta) para estimar el beneficio.
CREATE TABLE IF NOT EXISTS public.master_cost_forecast (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  concept text NOT NULL,
  monthly_amount numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_master_cost_forecast_account ON public.master_cost_forecast(account_id);

ALTER TABLE public.master_cost_forecast ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_cost_forecast TO authenticated;

DROP POLICY IF EXISTS "Master admin manages cost forecast" ON public.master_cost_forecast;
CREATE POLICY "Master admin manages cost forecast" ON public.master_cost_forecast
  FOR ALL USING (
    account_id = public.get_user_account_id((SELECT auth.uid()))
    AND public.has_role((SELECT auth.uid()), 'MASTER_ADMIN')
  ) WITH CHECK (
    account_id = public.get_user_account_id((SELECT auth.uid()))
    AND public.has_role((SELECT auth.uid()), 'MASTER_ADMIN')
  );
