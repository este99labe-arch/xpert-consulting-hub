-- Allow Managers and Master Admins to update their own account's company/fiscal data
CREATE POLICY "Managers can update own account"
ON public.accounts
FOR UPDATE
TO authenticated
USING (
  id = get_user_account_id(auth.uid())
  AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
)
WITH CHECK (
  id = get_user_account_id(auth.uid())
  AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
);