
-- Add new columns to attendance_records
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'APP',
  ADD COLUMN IF NOT EXISTS location_lat numeric NULL,
  ADD COLUMN IF NOT EXISTS location_lng numeric NULL,
  ADD COLUMN IF NOT EXISTS phone_number text NULL;

-- Create whatsapp_config table
CREATE TABLE public.whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  phone_number_id text NOT NULL DEFAULT '',
  verify_token text NOT NULL DEFAULT '',
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(account_id)
);

-- Enable RLS
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

-- Managers can manage own account whatsapp config
CREATE POLICY "Managers can manage account whatsapp config"
  ON public.whatsapp_config
  FOR ALL
  TO authenticated
  USING (
    (account_id = get_user_account_id(auth.uid()))
    AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
  );

-- Master admins can manage all whatsapp config
CREATE POLICY "Master admins can manage all whatsapp config"
  ON public.whatsapp_config
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'MASTER_ADMIN'));

-- Users can view own account whatsapp config
CREATE POLICY "Users can view account whatsapp config"
  ON public.whatsapp_config
  FOR SELECT
  TO authenticated
  USING (account_id = get_user_account_id(auth.uid()));
