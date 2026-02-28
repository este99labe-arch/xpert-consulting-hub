
-- Account settings for client configuration
CREATE TABLE public.account_settings (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id uuid NOT NULL UNIQUE REFERENCES public.accounts(id) ON DELETE CASCADE,
  work_start_time time NOT NULL DEFAULT '09:00',
  work_end_time time NOT NULL DEFAULT '18:00',
  work_days text[] NOT NULL DEFAULT ARRAY['MON','TUE','WED','THU','FRI'],
  vacation_days_per_year integer NOT NULL DEFAULT 22,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.account_settings ENABLE ROW LEVEL SECURITY;

-- Managers can manage their own account settings
CREATE POLICY "Managers can manage own account settings"
  ON public.account_settings FOR ALL
  USING (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
  );

-- Users can view their account settings
CREATE POLICY "Users can view own account settings"
  ON public.account_settings FOR SELECT
  USING (account_id = get_user_account_id(auth.uid()));

-- Master admins can manage all settings
CREATE POLICY "Master admins can manage all settings"
  ON public.account_settings FOR ALL
  USING (has_role(auth.uid(), 'MASTER_ADMIN'));
