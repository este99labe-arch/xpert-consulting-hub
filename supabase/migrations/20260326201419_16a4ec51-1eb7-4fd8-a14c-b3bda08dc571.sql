
-- Table for attendance delete requests (follows invoice_delete_requests pattern)
CREATE TABLE public.attendance_delete_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_id uuid NOT NULL REFERENCES public.attendance_records(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  requested_by uuid NOT NULL,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'PENDING',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_delete_requests ENABLE ROW LEVEL SECURITY;

-- Employees can request deletion
CREATE POLICY "Users can insert own attendance delete requests"
ON public.attendance_delete_requests FOR INSERT TO authenticated
WITH CHECK (requested_by = auth.uid() AND account_id = get_user_account_id(auth.uid()));

-- Users can view own requests
CREATE POLICY "Users can view own attendance delete requests"
ON public.attendance_delete_requests FOR SELECT TO authenticated
USING (requested_by = auth.uid());

-- Managers can view account requests
CREATE POLICY "Managers can view account attendance delete requests"
ON public.attendance_delete_requests FOR SELECT TO authenticated
USING (account_id = get_user_account_id(auth.uid()) AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN')));

-- Managers can update (approve/reject)
CREATE POLICY "Managers can update account attendance delete requests"
ON public.attendance_delete_requests FOR UPDATE TO authenticated
USING (account_id = get_user_account_id(auth.uid()) AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN')));

-- Managers can directly delete attendance records
CREATE POLICY "Managers can delete account attendance"
ON public.attendance_records FOR DELETE TO authenticated
USING (account_id = get_user_account_id(auth.uid()) AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN')));

-- Managers can also delete requests
CREATE POLICY "Managers can delete attendance delete requests"
ON public.attendance_delete_requests FOR DELETE TO authenticated
USING (account_id = get_user_account_id(auth.uid()) AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN')));
