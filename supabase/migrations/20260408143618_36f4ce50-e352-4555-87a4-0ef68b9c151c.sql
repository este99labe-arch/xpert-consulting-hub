
-- Bank transactions table (imported from CSV)
CREATE TABLE public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  transaction_date date NOT NULL,
  value_date date,
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL,
  balance numeric,
  reference text,
  source_file text,
  is_reconciled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid NOT NULL
);

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can manage account bank transactions"
ON public.bank_transactions FOR ALL TO authenticated
USING (account_id = get_user_account_id(auth.uid()) AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN')));

CREATE POLICY "Users can view account bank transactions"
ON public.bank_transactions FOR SELECT TO authenticated
USING (account_id = get_user_account_id(auth.uid()));

-- Reconciliation matches table
CREATE TABLE public.reconciliation_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  bank_transaction_id uuid NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  match_type text NOT NULL DEFAULT 'MANUAL',
  confidence numeric DEFAULT 0,
  matched_by uuid NOT NULL,
  matched_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  UNIQUE(bank_transaction_id, invoice_id)
);

ALTER TABLE public.reconciliation_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can manage account reconciliation matches"
ON public.reconciliation_matches FOR ALL TO authenticated
USING (account_id = get_user_account_id(auth.uid()) AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN')));

CREATE POLICY "Users can view account reconciliation matches"
ON public.reconciliation_matches FOR SELECT TO authenticated
USING (account_id = get_user_account_id(auth.uid()));

-- Index for performance
CREATE INDEX idx_bank_transactions_account ON public.bank_transactions(account_id);
CREATE INDEX idx_bank_transactions_date ON public.bank_transactions(transaction_date);
CREATE INDEX idx_reconciliation_matches_account ON public.reconciliation_matches(account_id);
CREATE INDEX idx_reconciliation_matches_transaction ON public.reconciliation_matches(bank_transaction_id);
CREATE INDEX idx_reconciliation_matches_invoice ON public.reconciliation_matches(invoice_id);
