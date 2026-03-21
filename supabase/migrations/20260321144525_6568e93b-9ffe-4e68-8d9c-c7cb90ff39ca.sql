
-- Create reminders table
CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  remind_at timestamp with time zone NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  entity_type text DEFAULT NULL, -- CLIENT, INVOICE, QUOTE, EXPENSE, JOURNAL_ENTRY, ATTENDANCE, etc.
  entity_id text DEFAULT NULL,
  entity_label text DEFAULT NULL, -- Human-readable label for the linked entity
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone DEFAULT NULL
);

-- Enable RLS
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- Users can view their own reminders
CREATE POLICY "Users can view own reminders"
  ON public.reminders FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- Managers can view all account reminders
CREATE POLICY "Managers can view account reminders"
  ON public.reminders FOR SELECT TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
  );

-- Users can insert own reminders
CREATE POLICY "Users can insert own reminders"
  ON public.reminders FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND account_id = get_user_account_id(auth.uid())
  );

-- Users can update own reminders
CREATE POLICY "Users can update own reminders"
  ON public.reminders FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- Users can delete own reminders
CREATE POLICY "Users can delete own reminders"
  ON public.reminders FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Managers can manage all account reminders
CREATE POLICY "Managers can manage account reminders"
  ON public.reminders FOR ALL TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
  );
