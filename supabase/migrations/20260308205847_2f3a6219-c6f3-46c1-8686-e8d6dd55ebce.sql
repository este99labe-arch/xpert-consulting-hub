
-- Create notifications table
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  link text NULL,
  reference_id text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can see their own notifications (user_id matches)
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Managers can see account-wide notifications (user_id IS NULL)
CREATE POLICY "Managers can view account notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (
  user_id IS NULL
  AND account_id = get_user_account_id(auth.uid())
  AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
);

-- Users can update (mark read) their own notifications
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Managers can update account-wide notifications
CREATE POLICY "Managers can update account notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (
  user_id IS NULL
  AND account_id = get_user_account_id(auth.uid())
  AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
);

-- Service role / edge functions can insert
CREATE POLICY "Service can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (account_id = get_user_account_id(auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Index for fast queries
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_account_unread ON public.notifications(account_id, is_read) WHERE user_id IS NULL AND is_read = false;
