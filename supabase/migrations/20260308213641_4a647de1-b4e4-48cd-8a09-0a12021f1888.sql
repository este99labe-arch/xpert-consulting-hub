
-- Recurring invoices table
CREATE TABLE public.recurring_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.business_clients(id) ON DELETE CASCADE,
  concept text NOT NULL DEFAULT '',
  amount_net numeric NOT NULL,
  vat_percentage numeric NOT NULL DEFAULT 21,
  amount_vat numeric NOT NULL,
  amount_total numeric NOT NULL,
  type text NOT NULL DEFAULT 'INVOICE',
  frequency text NOT NULL DEFAULT 'MONTHLY', -- MONTHLY, QUARTERLY, YEARLY
  next_run_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_generated_at timestamp with time zone,
  created_by uuid NOT NULL
);

-- Enable RLS
ALTER TABLE public.recurring_invoices ENABLE ROW LEVEL SECURITY;

-- Managers can manage recurring invoices for their account
CREATE POLICY "Managers can manage account recurring invoices"
  ON public.recurring_invoices
  FOR ALL
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
  );

-- Users can view recurring invoices for their account
CREATE POLICY "Users can view account recurring invoices"
  ON public.recurring_invoices
  FOR SELECT
  TO authenticated
  USING (account_id = get_user_account_id(auth.uid()));
