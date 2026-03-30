
-- Create invoice_payments table for partial payments
CREATE TABLE public.invoice_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  amount numeric NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  method text NOT NULL DEFAULT 'TRANSFER',
  notes text DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Managers can manage account invoice payments"
  ON public.invoice_payments FOR ALL TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
  );

CREATE POLICY "Users can view account invoice payments"
  ON public.invoice_payments FOR SELECT TO authenticated
  USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Users can insert account invoice payments"
  ON public.invoice_payments FOR INSERT TO authenticated
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
  );

-- Update invoice status constraint to include PARTIALLY_PAID
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check CHECK (
  (type IN ('INVOICE', 'EXPENSE') AND status IN ('DRAFT', 'SENT', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED'))
  OR
  (type = 'QUOTE' AND status IN ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'INVOICED', 'CANCELLED'))
);
