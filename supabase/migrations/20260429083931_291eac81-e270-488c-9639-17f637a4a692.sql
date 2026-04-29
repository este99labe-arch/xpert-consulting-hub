-- 1. Fix user_accounts: restrict "Managers can view account users" to authenticated role
DROP POLICY IF EXISTS "Managers can view account users" ON public.user_accounts;
CREATE POLICY "Managers can view account users"
ON public.user_accounts
FOR SELECT
TO authenticated
USING (
  account_id = get_user_account_id(auth.uid())
  AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
);

-- 2. Tighten realtime policies: remove broad account-prefixed wildcard subscriptions
DROP POLICY IF EXISTS "Scoped realtime channel subscriptions" ON realtime.messages;
CREATE POLICY "Scoped realtime channel subscriptions"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- xred chat: only match participants
  (
    realtime.topic() LIKE 'xred-chat-%'
    AND xred_is_match_participant(SUBSTRING(realtime.topic() FROM 11)::uuid, auth.uid())
  )
  -- per-user named channels only
  OR realtime.topic() = ('user:' || (auth.uid())::text)
  OR realtime.topic() LIKE ('user:' || (auth.uid())::text || ':%')
);

-- 3. Lock down SECURITY DEFINER functions: revoke EXECUTE from PUBLIC, anon, authenticated
-- Trigger functions (only invoked by triggers, never directly)
REVOKE EXECUTE ON FUNCTION public.accounts_encrypt_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_default_task_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_journal_entry_from_invoice() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.business_clients_encrypt_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.client_contacts_encrypt_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_default_task_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.employee_profiles_encrypt_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_entry_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_invoice_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_task_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_task_assignment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_client_account_to_business_clients() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_product_stock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.xred_check_match() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.xred_update_reputation() FROM PUBLIC, anon, authenticated;

-- Helpers used internally / by edge functions only
REVOKE EXECUTE ON FUNCTION public.ensure_default_folders(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Note: has_role and get_user_account_id remain executable by authenticated/anon
-- because they are used inside RLS policies (which evaluate as the calling role).
-- All RPCs (invoice_kpis, list_*_decrypted, get_decrypted_*, log_audit_event,
-- xred_resolve_names, xred_is_match_participant) keep EXECUTE for authenticated
-- only — they each enforce internal access checks.
