-- ============================================================================
-- Bot por cuenta: contexto del negocio + retroalimentación (correcciones)
-- ============================================================================

ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS business_context text;

GRANT SELECT (business_context) ON public.whatsapp_config TO authenticated;
GRANT UPDATE (business_context) ON public.whatsapp_config TO authenticated;

CREATE TABLE IF NOT EXISTS public.chat_bot_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  message_text text NOT NULL,
  expected_action text NOT NULL CHECK (expected_action IN ('CREATE_TASK','NO_TASK','REPLY_ONLY')),
  expected_intent_id uuid REFERENCES public.chat_intents(id) ON DELETE SET NULL,
  comment text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_bot_feedback_account ON public.chat_bot_feedback(account_id, is_active, created_at DESC);

ALTER TABLE public.chat_bot_feedback ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_bot_feedback TO authenticated;

DROP POLICY IF EXISTS "Members insert bot feedback" ON public.chat_bot_feedback;
CREATE POLICY "Members insert bot feedback" ON public.chat_bot_feedback
  FOR INSERT WITH CHECK (
    account_id = public.get_user_account_id((SELECT auth.uid()))
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Managers manage bot feedback" ON public.chat_bot_feedback;
CREATE POLICY "Managers manage bot feedback" ON public.chat_bot_feedback
  FOR ALL USING (
    account_id = public.get_user_account_id((SELECT auth.uid()))
    AND (public.has_role((SELECT auth.uid()), 'MANAGER') OR public.has_role((SELECT auth.uid()), 'MASTER_ADMIN'))
  ) WITH CHECK (
    account_id = public.get_user_account_id((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Authors view own bot feedback" ON public.chat_bot_feedback;
CREATE POLICY "Authors view own bot feedback" ON public.chat_bot_feedback
  FOR SELECT USING (created_by = (SELECT auth.uid()));
