-- account_settings
DROP POLICY IF EXISTS "Managers can manage own account settings" ON public.account_settings;
DROP POLICY IF EXISTS "Master admins can manage all settings" ON public.account_settings;
DROP POLICY IF EXISTS "Users can view own account settings" ON public.account_settings;

CREATE POLICY "Managers can manage own account settings"
ON public.account_settings FOR ALL TO authenticated
USING (
  account_id = public.get_user_account_id(auth.uid())
  AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
)
WITH CHECK (
  account_id = public.get_user_account_id(auth.uid())
  AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
);

CREATE POLICY "Master admins can manage all settings"
ON public.account_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'MASTER_ADMIN'))
WITH CHECK (public.has_role(auth.uid(), 'MASTER_ADMIN'));

CREATE POLICY "Users can view own account settings"
ON public.account_settings FOR SELECT TO authenticated
USING (account_id = public.get_user_account_id(auth.uid()));

-- chart_of_accounts
DROP POLICY IF EXISTS "Managers can manage own account chart" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Master admins can view all chart" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Users can view own account chart" ON public.chart_of_accounts;

CREATE POLICY "Managers can manage own account chart"
ON public.chart_of_accounts FOR ALL TO authenticated
USING (
  account_id = public.get_user_account_id(auth.uid())
  AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
)
WITH CHECK (
  account_id = public.get_user_account_id(auth.uid())
  AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
);

CREATE POLICY "Master admins can view all chart"
ON public.chart_of_accounts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'MASTER_ADMIN'));

CREATE POLICY "Users can view own account chart"
ON public.chart_of_accounts FOR SELECT TO authenticated
USING (account_id = public.get_user_account_id(auth.uid()));

-- journal_entries
DROP POLICY IF EXISTS "Managers can manage own account entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Master admins can view all entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can view own account entries" ON public.journal_entries;

CREATE POLICY "Managers can manage own account entries"
ON public.journal_entries FOR ALL TO authenticated
USING (
  account_id = public.get_user_account_id(auth.uid())
  AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
)
WITH CHECK (
  account_id = public.get_user_account_id(auth.uid())
  AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
);

CREATE POLICY "Master admins can view all entries"
ON public.journal_entries FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'MASTER_ADMIN'));

CREATE POLICY "Users can view own account entries"
ON public.journal_entries FOR SELECT TO authenticated
USING (account_id = public.get_user_account_id(auth.uid()));

-- journal_entry_delete_requests
DROP POLICY IF EXISTS "Managers can update account entry delete requests" ON public.journal_entry_delete_requests;
DROP POLICY IF EXISTS "Managers can view account entry delete requests" ON public.journal_entry_delete_requests;
DROP POLICY IF EXISTS "Users can insert own entry delete requests" ON public.journal_entry_delete_requests;
DROP POLICY IF EXISTS "Users can view own entry delete requests" ON public.journal_entry_delete_requests;

CREATE POLICY "Managers can update account entry delete requests"
ON public.journal_entry_delete_requests FOR UPDATE TO authenticated
USING (
  account_id = public.get_user_account_id(auth.uid())
  AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
)
WITH CHECK (
  account_id = public.get_user_account_id(auth.uid())
  AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
);

CREATE POLICY "Managers can view account entry delete requests"
ON public.journal_entry_delete_requests FOR SELECT TO authenticated
USING (
  account_id = public.get_user_account_id(auth.uid())
  AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
);

CREATE POLICY "Users can insert own entry delete requests"
ON public.journal_entry_delete_requests FOR INSERT TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND account_id = public.get_user_account_id(auth.uid())
);

CREATE POLICY "Users can view own entry delete requests"
ON public.journal_entry_delete_requests FOR SELECT TO authenticated
USING (requested_by = auth.uid());

-- journal_entry_lines
DROP POLICY IF EXISTS "Managers can manage own account entry lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Master admins can view all entry lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Users can view own account entry lines" ON public.journal_entry_lines;

CREATE POLICY "Managers can manage own account entry lines"
ON public.journal_entry_lines FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.id = journal_entry_lines.entry_id
      AND je.account_id = public.get_user_account_id(auth.uid())
      AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.id = journal_entry_lines.entry_id
      AND je.account_id = public.get_user_account_id(auth.uid())
      AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
  )
);

CREATE POLICY "Master admins can view all entry lines"
ON public.journal_entry_lines FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'MASTER_ADMIN'));

CREATE POLICY "Users can view own account entry lines"
ON public.journal_entry_lines FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.id = journal_entry_lines.entry_id
      AND je.account_id = public.get_user_account_id(auth.uid())
  )
);