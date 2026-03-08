
CREATE TABLE public.profile_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value text,
  new_value text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE public.profile_change_requests ENABLE ROW LEVEL SECURITY;

-- Employees can insert their own requests
CREATE POLICY "Users can insert own change requests"
ON public.profile_change_requests
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND account_id = get_user_account_id(auth.uid()));

-- Employees can view their own requests
CREATE POLICY "Users can view own change requests"
ON public.profile_change_requests
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Managers can view all account requests
CREATE POLICY "Managers can view account change requests"
ON public.profile_change_requests
FOR SELECT
TO authenticated
USING (
  account_id = get_user_account_id(auth.uid())
  AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
);

-- Managers can update account requests (approve/reject)
CREATE POLICY "Managers can update account change requests"
ON public.profile_change_requests
FOR UPDATE
TO authenticated
USING (
  account_id = get_user_account_id(auth.uid())
  AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
);
