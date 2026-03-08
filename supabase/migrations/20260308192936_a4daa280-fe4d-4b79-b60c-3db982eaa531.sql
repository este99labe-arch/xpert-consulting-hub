-- Table for employee invoice deletion requests
CREATE TABLE public.invoice_delete_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  requested_by uuid NOT NULL,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'PENDING',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_delete_requests ENABLE ROW LEVEL SECURITY;

-- Employees can insert their own requests
CREATE POLICY "Users can insert own delete requests"
  ON public.invoice_delete_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND account_id = get_user_account_id(auth.uid()));

-- Users can view their own requests
CREATE POLICY "Users can view own delete requests"
  ON public.invoice_delete_requests FOR SELECT TO authenticated
  USING (requested_by = auth.uid());

-- Managers can view all account requests
CREATE POLICY "Managers can view account delete requests"
  ON public.invoice_delete_requests FOR SELECT TO authenticated
  USING (account_id = get_user_account_id(auth.uid()) AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN')));

-- Managers can update (approve/reject) account requests
CREATE POLICY "Managers can update account delete requests"
  ON public.invoice_delete_requests FOR UPDATE TO authenticated
  USING (account_id = get_user_account_id(auth.uid()) AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN')));

-- Allow managers to delete invoices
CREATE POLICY "Managers can delete own account invoices"
  ON public.invoices FOR DELETE TO authenticated
  USING (account_id = get_user_account_id(auth.uid()) AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN')));