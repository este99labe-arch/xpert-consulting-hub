-- Facturas recurrentes: IRPF, varias líneas, fecha de fin, sufijo de periodo
-- y categoría contable.
--
-- Retrocompatible: se conservan concept/amount_net como "línea única". Si la
-- plantilla no tiene líneas en recurring_invoice_lines, el generador sigue
-- usando esos campos exactamente como hasta ahora.

ALTER TABLE public.recurring_invoices
  ADD COLUMN IF NOT EXISTS irpf_percentage numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS irpf_amount     numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS end_date        date,
  ADD COLUMN IF NOT EXISTS append_period   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS category_id     uuid REFERENCES public.accounting_categories(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.recurring_invoices.end_date IS
  'Último día en que puede generarse. NULL = indefinida.';
COMMENT ON COLUMN public.recurring_invoices.append_period IS
  'Si es true, al concepto se le añade el periodo facturado según la frecuencia.';
COMMENT ON COLUMN public.recurring_invoices.category_id IS
  'Categoría contable con la que se generará el asiento de la factura.';

CREATE TABLE IF NOT EXISTS public.recurring_invoice_lines (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  recurring_id uuid NOT NULL REFERENCES public.recurring_invoices(id) ON DELETE CASCADE,
  description  text NOT NULL,
  quantity     numeric NOT NULL DEFAULT 1,
  unit_price   numeric NOT NULL DEFAULT 0,
  service_id   uuid REFERENCES public.services(id) ON DELETE SET NULL,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_lines_parent
  ON public.recurring_invoice_lines(recurring_id, sort_order);

ALTER TABLE public.recurring_invoice_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own account recurring lines" ON public.recurring_invoice_lines;
CREATE POLICY "Users can view own account recurring lines" ON public.recurring_invoice_lines FOR SELECT
  USING (account_id = public.get_user_account_id((SELECT auth.uid())));

DROP POLICY IF EXISTS "Master admins can view all recurring lines" ON public.recurring_invoice_lines;
CREATE POLICY "Master admins can view all recurring lines" ON public.recurring_invoice_lines FOR SELECT
  USING (public.has_role((SELECT auth.uid()), 'MASTER_ADMIN'));

DROP POLICY IF EXISTS "Managers manage own account recurring lines" ON public.recurring_invoice_lines;
CREATE POLICY "Managers manage own account recurring lines" ON public.recurring_invoice_lines FOR ALL
  USING (account_id = public.get_user_account_id((SELECT auth.uid()))
         AND (public.has_role((SELECT auth.uid()), 'MANAGER') OR public.has_role((SELECT auth.uid()), 'MASTER_ADMIN')))
  WITH CHECK (account_id = public.get_user_account_id((SELECT auth.uid()))
         AND (public.has_role((SELECT auth.uid()), 'MANAGER') OR public.has_role((SELECT auth.uid()), 'MASTER_ADMIN')));
