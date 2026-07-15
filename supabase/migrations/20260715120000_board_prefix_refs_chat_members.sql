-- ============================================================================
-- (1) Referencias incrementales por tablero (DEV-001…) para tareas
-- (2) Multi-asignación de conversaciones de chat a empleados
-- ============================================================================

ALTER TABLE public.task_boards
  ADD COLUMN IF NOT EXISTS prefix text,
  ADD COLUMN IF NOT EXISTS next_task_number integer NOT NULL DEFAULT 1;

ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS reference text;
CREATE INDEX IF NOT EXISTS idx_reminders_reference ON public.reminders(account_id, reference);

-- Asigna la referencia al crear la tarea, según el tablero de su columna.
-- El contador se incrementa de forma atómica (UPDATE ... RETURNING).
CREATE OR REPLACE FUNCTION public.assign_task_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prefix text;
  v_num integer;
BEGIN
  IF NEW.reference IS NOT NULL OR NEW.column_id IS NULL THEN
    RETURN NEW;
  END IF;
  UPDATE public.task_boards b
  SET next_task_number = b.next_task_number + 1
  FROM public.task_columns c
  WHERE c.id = NEW.column_id AND b.id = c.board_id
    AND b.prefix IS NOT NULL AND b.prefix <> ''
  RETURNING b.prefix, b.next_task_number - 1 INTO v_prefix, v_num;

  IF v_prefix IS NOT NULL THEN
    NEW.reference := v_prefix || '-' || lpad(v_num::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.assign_task_reference() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_assign_task_reference ON public.reminders;
CREATE TRIGGER trg_assign_task_reference
  BEFORE INSERT ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.assign_task_reference();

-- Miembros de conversación (multi-asignación de chats)
CREATE TABLE IF NOT EXISTS public.chat_conversation_members (
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_conv_members_user ON public.chat_conversation_members(user_id);
ALTER TABLE public.chat_conversation_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_conversation_members TO authenticated;

DROP POLICY IF EXISTS "Managers manage conv members" ON public.chat_conversation_members;
CREATE POLICY "Managers manage conv members" ON public.chat_conversation_members
  FOR ALL USING (
    account_id = public.get_user_account_id((SELECT auth.uid()))
    AND (public.has_role((SELECT auth.uid()), 'MANAGER') OR public.has_role((SELECT auth.uid()), 'MASTER_ADMIN'))
  ) WITH CHECK (
    account_id = public.get_user_account_id((SELECT auth.uid()))
    AND (public.has_role((SELECT auth.uid()), 'MANAGER') OR public.has_role((SELECT auth.uid()), 'MASTER_ADMIN'))
  );

DROP POLICY IF EXISTS "Users view own conv membership" ON public.chat_conversation_members;
CREATE POLICY "Users view own conv membership" ON public.chat_conversation_members
  FOR SELECT USING (
    account_id = public.get_user_account_id((SELECT auth.uid()))
    AND user_id = (SELECT auth.uid())
  );

-- Empleado miembro ve la conversación y sus mensajes
DROP POLICY IF EXISTS "chat_conv_select_member" ON public.chat_conversations;
CREATE POLICY "chat_conv_select_member" ON public.chat_conversations
  FOR SELECT USING (
    account_id = public.get_user_account_id((SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.chat_conversation_members m
      WHERE m.conversation_id = chat_conversations.id AND m.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "chat_msg_select_member" ON public.chat_messages;
CREATE POLICY "chat_msg_select_member" ON public.chat_messages
  FOR SELECT USING (
    account_id = public.get_user_account_id((SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.chat_conversation_members m
      WHERE m.conversation_id = chat_messages.conversation_id AND m.user_id = (SELECT auth.uid())
    )
  );

-- Backfill: los assigned_to actuales pasan a ser miembros
INSERT INTO public.chat_conversation_members (conversation_id, user_id, account_id)
SELECT id, assigned_to, account_id FROM public.chat_conversations WHERE assigned_to IS NOT NULL
ON CONFLICT DO NOTHING;
