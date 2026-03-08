
-- Webhooks table
CREATE TABLE public.webhooks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  url text NOT NULL,
  secret text NOT NULL DEFAULT '',
  events text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can manage account webhooks"
  ON public.webhooks
  FOR ALL
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
  );

CREATE POLICY "Users can view account webhooks"
  ON public.webhooks
  FOR SELECT
  TO authenticated
  USING (account_id = get_user_account_id(auth.uid()));

-- Webhook delivery logs
CREATE TABLE public.webhook_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id uuid NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_status integer,
  response_body text,
  duration_ms integer,
  success boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view account webhook logs"
  ON public.webhook_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.webhooks w
      WHERE w.id = webhook_logs.webhook_id
        AND w.account_id = get_user_account_id(auth.uid())
        AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
    )
  );

-- Allow service role inserts (edge functions use service role)
-- No insert policy needed for authenticated users since edge function uses service role
