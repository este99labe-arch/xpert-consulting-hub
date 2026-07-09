-- Panel personalizable del dashboard de manager: cada usuario guarda sus widgets
CREATE TABLE IF NOT EXISTS public.dashboard_configs (
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widgets jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, user_id)
);

ALTER TABLE public.dashboard_configs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_configs TO authenticated;

DROP POLICY IF EXISTS "Users manage own dashboard config" ON public.dashboard_configs;
CREATE POLICY "Users manage own dashboard config" ON public.dashboard_configs
  FOR ALL USING (
    user_id = (SELECT auth.uid())
    AND account_id = public.get_user_account_id((SELECT auth.uid()))
  ) WITH CHECK (
    user_id = (SELECT auth.uid())
    AND account_id = public.get_user_account_id((SELECT auth.uid()))
  );
