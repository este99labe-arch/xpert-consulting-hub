CREATE TABLE public.user_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  module_id uuid NOT NULL REFERENCES public.service_modules(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_id)
);

CREATE INDEX idx_user_modules_user ON public.user_modules(user_id);
CREATE INDEX idx_user_modules_account ON public.user_modules(account_id);

ALTER TABLE public.user_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can manage user modules in their account"
ON public.user_modules
FOR ALL
TO authenticated
USING (
  account_id = get_user_account_id(auth.uid())
  AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
)
WITH CHECK (
  account_id = get_user_account_id(auth.uid())
  AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
);

CREATE POLICY "Master admins can manage all user modules"
ON public.user_modules
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'MASTER_ADMIN'))
WITH CHECK (has_role(auth.uid(), 'MASTER_ADMIN'));

CREATE POLICY "Users can view own modules"
ON public.user_modules
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Service modules son catálogo público para usuarios autenticados
CREATE POLICY "Authenticated can view service modules"
ON public.service_modules
FOR SELECT
TO authenticated
USING (true);