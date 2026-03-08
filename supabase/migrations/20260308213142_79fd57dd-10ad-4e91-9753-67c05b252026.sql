
-- Email log table for tracking sent invoice emails and reminders
CREATE TABLE public.email_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  recipient text NOT NULL,
  type text NOT NULL DEFAULT 'invoice', -- 'invoice' or 'reminder'
  status text NOT NULL DEFAULT 'sent', -- 'sent', 'failed'
  error_message text,
  sent_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- Managers can manage email logs for their account
CREATE POLICY "Managers can manage account email logs"
  ON public.email_log
  FOR ALL
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
  );

-- Users can view email logs for their account
CREATE POLICY "Users can view account email logs"
  ON public.email_log
  FOR SELECT
  TO authenticated
  USING (account_id = get_user_account_id(auth.uid()));

-- Service role insert (edge functions use service role, but also allow authenticated insert)
CREATE POLICY "Users can insert email logs"
  ON public.email_log
  FOR INSERT
  TO authenticated
  WITH CHECK (account_id = get_user_account_id(auth.uid()));
