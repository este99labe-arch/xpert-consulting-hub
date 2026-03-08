
-- Table for employee delete requests on journal entries
CREATE TABLE public.journal_entry_delete_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT '',
  requested_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_entry_delete_requests ENABLE ROW LEVEL SECURITY;

-- Employees can insert their own requests
CREATE POLICY "Users can insert own entry delete requests"
  ON public.journal_entry_delete_requests FOR INSERT
  WITH CHECK (requested_by = auth.uid() AND account_id = get_user_account_id(auth.uid()));

-- Employees can view their own requests
CREATE POLICY "Users can view own entry delete requests"
  ON public.journal_entry_delete_requests FOR SELECT
  USING (requested_by = auth.uid());

-- Managers can view account requests
CREATE POLICY "Managers can view account entry delete requests"
  ON public.journal_entry_delete_requests FOR SELECT
  USING (account_id = get_user_account_id(auth.uid()) AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN')));

-- Managers can update (approve/reject)
CREATE POLICY "Managers can update account entry delete requests"
  ON public.journal_entry_delete_requests FOR UPDATE
  USING (account_id = get_user_account_id(auth.uid()) AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN')));
