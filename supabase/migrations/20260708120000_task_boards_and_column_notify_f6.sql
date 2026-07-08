-- ============================================================================
-- F6 Tareas: (1) múltiples tableros Kanban con acceso por empleado
--            (2) notificación WhatsApp configurable por columna
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.task_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3860AA',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_boards_account ON public.task_boards(account_id);

CREATE TABLE IF NOT EXISTS public.task_board_members (
  board_id uuid NOT NULL REFERENCES public.task_boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_task_board_members_user ON public.task_board_members(user_id);
CREATE INDEX IF NOT EXISTS idx_task_board_members_account ON public.task_board_members(account_id);

ALTER TABLE public.task_columns
  ADD COLUMN IF NOT EXISTS board_id uuid REFERENCES public.task_boards(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS notify_on_enter boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_task_columns_board ON public.task_columns(board_id);

-- Backfill: un tablero principal por cuenta con columnas existentes
INSERT INTO public.task_boards (account_id, name, sort_order)
SELECT DISTINCT c.account_id, 'Tablero principal', 0
FROM public.task_columns c
WHERE NOT EXISTS (SELECT 1 FROM public.task_boards b WHERE b.account_id = c.account_id);

UPDATE public.task_columns c
SET board_id = b.id
FROM public.task_boards b
WHERE b.account_id = c.account_id AND c.board_id IS NULL;

INSERT INTO public.task_board_members (board_id, user_id, account_id)
SELECT b.id, ua.user_id, b.account_id
FROM public.task_boards b
JOIN public.user_accounts ua ON ua.account_id = b.account_id AND ua.is_active = true
WHERE b.name = 'Tablero principal'
ON CONFLICT DO NOTHING;

-- Helper de acceso usado en RLS
CREATE OR REPLACE FUNCTION public.can_access_task_board(_board_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task_boards b
    WHERE b.id = _board_id
      AND b.account_id = public.get_user_account_id(_uid)
      AND (
        public.has_role(_uid, 'MANAGER') OR public.has_role(_uid, 'MASTER_ADMIN')
        OR EXISTS (SELECT 1 FROM public.task_board_members m WHERE m.board_id = b.id AND m.user_id = _uid)
      )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_access_task_board(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_task_board(uuid, uuid) TO authenticated;

ALTER TABLE public.task_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_board_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_boards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_board_members TO authenticated;

DROP POLICY IF EXISTS "Users view accessible boards" ON public.task_boards;
CREATE POLICY "Users view accessible boards" ON public.task_boards
  FOR SELECT USING (
    account_id = public.get_user_account_id((SELECT auth.uid()))
    AND can_access_task_board(id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Managers manage boards" ON public.task_boards;
CREATE POLICY "Managers manage boards" ON public.task_boards
  FOR ALL USING (
    account_id = public.get_user_account_id((SELECT auth.uid()))
    AND (public.has_role((SELECT auth.uid()), 'MANAGER') OR public.has_role((SELECT auth.uid()), 'MASTER_ADMIN'))
  ) WITH CHECK (
    account_id = public.get_user_account_id((SELECT auth.uid()))
    AND (public.has_role((SELECT auth.uid()), 'MANAGER') OR public.has_role((SELECT auth.uid()), 'MASTER_ADMIN'))
  );

DROP POLICY IF EXISTS "Users view own board membership" ON public.task_board_members;
CREATE POLICY "Users view own board membership" ON public.task_board_members
  FOR SELECT USING (
    account_id = public.get_user_account_id((SELECT auth.uid()))
    AND (
      user_id = (SELECT auth.uid())
      OR public.has_role((SELECT auth.uid()), 'MANAGER') OR public.has_role((SELECT auth.uid()), 'MASTER_ADMIN')
    )
  );

DROP POLICY IF EXISTS "Managers manage board membership" ON public.task_board_members;
CREATE POLICY "Managers manage board membership" ON public.task_board_members
  FOR ALL USING (
    account_id = public.get_user_account_id((SELECT auth.uid()))
    AND (public.has_role((SELECT auth.uid()), 'MANAGER') OR public.has_role((SELECT auth.uid()), 'MASTER_ADMIN'))
  ) WITH CHECK (
    account_id = public.get_user_account_id((SELECT auth.uid()))
    AND (public.has_role((SELECT auth.uid()), 'MANAGER') OR public.has_role((SELECT auth.uid()), 'MASTER_ADMIN'))
  );

DROP POLICY IF EXISTS "Users view account task columns" ON public.task_columns;
DROP POLICY IF EXISTS "Users view accessible task columns" ON public.task_columns;
CREATE POLICY "Users view accessible task columns" ON public.task_columns
  FOR SELECT USING (
    account_id = public.get_user_account_id((SELECT auth.uid()))
    AND (board_id IS NULL OR can_access_task_board(board_id, (SELECT auth.uid())))
  );

DROP POLICY IF EXISTS "Users view accessible board reminders" ON public.reminders;
CREATE POLICY "Users view accessible board reminders" ON public.reminders
  FOR SELECT USING (
    account_id = public.get_user_account_id((SELECT auth.uid()))
    AND column_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.task_columns c
      WHERE c.id = reminders.column_id AND can_access_task_board(c.board_id, (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users update accessible board reminders" ON public.reminders;
CREATE POLICY "Users update accessible board reminders" ON public.reminders
  FOR UPDATE USING (
    account_id = public.get_user_account_id((SELECT auth.uid()))
    AND column_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.task_columns c
      WHERE c.id = reminders.column_id AND can_access_task_board(c.board_id, (SELECT auth.uid()))
    )
  ) WITH CHECK (
    account_id = public.get_user_account_id((SELECT auth.uid()))
  );

-- Trigger: notificación por columna (sustituye a la basada en is_completed)
CREATE OR REPLACE FUNCTION public.notify_chat_task_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  should_notify boolean := false;
BEGIN
  IF NEW.origin = 'CHAT' AND NEW.chat_conversation_id IS NOT NULL
     AND NEW.column_id IS DISTINCT FROM OLD.column_id AND NEW.column_id IS NOT NULL THEN
    SELECT c.notify_on_enter INTO should_notify
    FROM public.task_columns c WHERE c.id = NEW.column_id;

    IF COALESCE(should_notify, false) THEN
      PERFORM net.http_post(
        url := 'https://wgeyspfcfjmbkmwmwfyc.supabase.co/functions/v1/whatsapp_send',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZXlzcGZjZmptYmttd213ZnljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNDQyNTAsImV4cCI6MjA5NzcyMDI1MH0.VbGIcR9Z91vuw_QF7aoyttDmpY-LO4Ar8dQ-TBd5X-o'
        ),
        body := jsonb_build_object(
          'event','task_completed',
          'conversation_id', NEW.chat_conversation_id,
          'task_id', NEW.id,
          'task_title', NEW.title,
          'task_desc', COALESCE(NEW.description,'')
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
