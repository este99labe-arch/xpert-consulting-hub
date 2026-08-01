-- Costes previstos: distinguir suscripciones (recurrentes) de costes puntuales
-- y poder acotarlos en el tiempo, para verlos mes a mes.
--
-- Retrocompatible: las filas existentes quedan como recurrentes sin fechas,
-- que es exactamente el comportamiento actual (se aplican todos los meses).
ALTER TABLE public.master_cost_forecast
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS start_month date,
  ADD COLUMN IF NOT EXISTS end_month date;

COMMENT ON COLUMN public.master_cost_forecast.is_recurring IS
  'true = suscripción/coste fijo mensual; false = coste puntual del mes indicado en start_month.';
COMMENT ON COLUMN public.master_cost_forecast.start_month IS
  'Primer mes en que aplica (día 1). En costes puntuales, el mes del gasto.';
COMMENT ON COLUMN public.master_cost_forecast.end_month IS
  'Último mes en que aplica (día 1). NULL = indefinido.';

ALTER TABLE public.master_cost_forecast
  DROP CONSTRAINT IF EXISTS master_cost_forecast_period_ok;
ALTER TABLE public.master_cost_forecast
  ADD CONSTRAINT master_cost_forecast_period_ok CHECK (
    (is_recurring = true AND (end_month IS NULL OR start_month IS NULL OR end_month >= start_month))
    OR (is_recurring = false AND start_month IS NOT NULL)
  );
