
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Managers can view their account's logs
CREATE POLICY "Managers can view account audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
  account_id = get_user_account_id(auth.uid())
  AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
);

-- Master admins can view all logs
CREATE POLICY "Master admins can view all audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'MASTER_ADMIN'));

-- Authenticated users can insert logs for their account
CREATE POLICY "Users can insert audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND account_id = get_user_account_id(auth.uid())
);

CREATE INDEX idx_audit_logs_account ON public.audit_logs(account_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
