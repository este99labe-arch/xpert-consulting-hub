
-- Invoice line items table
CREATE TABLE public.invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view account invoice lines" ON public.invoice_lines
  FOR SELECT TO authenticated
  USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Managers can manage account invoice lines" ON public.invoice_lines
  FOR ALL TO authenticated
  USING (account_id = get_user_account_id(auth.uid()) AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN')));

CREATE POLICY "Users can insert account invoice lines" ON public.invoice_lines
  FOR INSERT TO authenticated
  WITH CHECK (account_id = get_user_account_id(auth.uid()));

-- New columns on invoices for Spanish legal compliance
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS operation_date date,
  ADD COLUMN IF NOT EXISTS irpf_percentage numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS irpf_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS special_mentions text;
