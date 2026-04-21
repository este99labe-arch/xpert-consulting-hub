-- Drop the permissive user INSERT policy on audit_logs
DROP POLICY IF EXISTS "Users can insert audit logs" ON public.audit_logs;

-- Create a SECURITY DEFINER function that forces user_id and account_id
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _action text,
  _entity_type text,
  _entity_id uuid,
  _details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_account_id := public.get_user_account_id(auth.uid());
  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'No active account for user';
  END IF;

  IF _action NOT IN ('CREATE','UPDATE','DELETE') THEN
    RAISE EXCEPTION 'Invalid action: %', _action;
  END IF;

  INSERT INTO public.audit_logs (account_id, user_id, action, entity_type, entity_id, details)
  VALUES (v_account_id, auth.uid(), _action, _entity_type, _entity_id, COALESCE(_details, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.log_audit_event(text, text, uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, uuid, jsonb) TO authenticated;