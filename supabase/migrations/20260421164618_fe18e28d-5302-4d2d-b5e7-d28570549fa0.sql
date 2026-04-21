-- ============================================
-- 1. TASK COLUMNS (configurable Kanban columns)
-- ============================================
CREATE TABLE public.task_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  sort_order integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_columns_account ON public.task_columns(account_id, sort_order);

ALTER TABLE public.task_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view account task columns"
  ON public.task_columns FOR SELECT TO authenticated
  USING (account_id = public.get_user_account_id(auth.uid()));

CREATE POLICY "Managers manage account task columns"
  ON public.task_columns FOR ALL TO authenticated
  USING (
    account_id = public.get_user_account_id(auth.uid())
    AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
  )
  WITH CHECK (
    account_id = public.get_user_account_id(auth.uid())
    AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
  );

-- ============================================
-- 2. EXTEND REMINDERS (tasks)
-- ============================================
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.business_clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS column_id uuid REFERENCES public.task_columns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Validate priority values via trigger (avoid CHECK so we can extend later)
CREATE OR REPLACE FUNCTION public.validate_task_priority()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.priority NOT IN ('CRITICAL','HIGH','MEDIUM','LOW') THEN
    RAISE EXCEPTION 'Invalid priority: %', NEW.priority;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_task_priority ON public.reminders;
CREATE TRIGGER trg_validate_task_priority
  BEFORE INSERT OR UPDATE OF priority ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.validate_task_priority();

CREATE INDEX IF NOT EXISTS idx_reminders_assigned_to ON public.reminders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_reminders_client_id ON public.reminders(client_id);
CREATE INDEX IF NOT EXISTS idx_reminders_column_id ON public.reminders(column_id);

-- ============================================
-- 3. TASK COMMENTS
-- ============================================
CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_comments_task ON public.task_comments(task_id, created_at);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view account task comments"
  ON public.task_comments FOR SELECT TO authenticated
  USING (account_id = public.get_user_account_id(auth.uid()));

CREATE POLICY "Users insert own task comments"
  ON public.task_comments FOR INSERT TO authenticated
  WITH CHECK (
    account_id = public.get_user_account_id(auth.uid())
    AND author_id = auth.uid()
  );

CREATE POLICY "Authors update own comments"
  ON public.task_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Authors or managers delete comments"
  ON public.task_comments FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR (
      account_id = public.get_user_account_id(auth.uid())
      AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
    )
  );

-- ============================================
-- 4. TASK ACTIVITY (audit trail per task)
-- ============================================
CREATE TABLE public.task_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
  user_id uuid,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_activity_task ON public.task_activity(task_id, created_at DESC);

ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view account task activity"
  ON public.task_activity FOR SELECT TO authenticated
  USING (account_id = public.get_user_account_id(auth.uid()));

-- No INSERT/UPDATE/DELETE policies: only the trigger (security definer) writes here.

-- ============================================
-- 5. AUTO-ASSIGN DEFAULT COLUMN
-- ============================================
CREATE OR REPLACE FUNCTION public.assign_default_task_column()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.column_id IS NULL THEN
    SELECT id INTO NEW.column_id
    FROM public.task_columns
    WHERE account_id = NEW.account_id AND is_archived = false
    ORDER BY sort_order ASC, created_at ASC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_default_task_column ON public.reminders;
CREATE TRIGGER trg_assign_default_task_column
  BEFORE INSERT ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_task_column();

-- ============================================
-- 6. ACTIVITY LOGGING TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.log_task_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_activity(account_id, task_id, user_id, field_name, new_value)
    VALUES (NEW.account_id, NEW.id, v_user, 'created', NEW.title);
    RETURN NEW;
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title THEN
    INSERT INTO public.task_activity(account_id, task_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.account_id, NEW.id, v_user, 'title', OLD.title, NEW.title);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.task_activity(account_id, task_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.account_id, NEW.id, v_user, 'status', OLD.status, NEW.status);
  END IF;
  IF NEW.column_id IS DISTINCT FROM OLD.column_id THEN
    INSERT INTO public.task_activity(account_id, task_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.account_id, NEW.id, v_user, 'column', OLD.column_id::text, NEW.column_id::text);
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.task_activity(account_id, task_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.account_id, NEW.id, v_user, 'priority', OLD.priority, NEW.priority);
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.task_activity(account_id, task_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.account_id, NEW.id, v_user, 'assigned_to', OLD.assigned_to::text, NEW.assigned_to::text);
  END IF;
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at AND NEW.archived_at IS NOT NULL THEN
    INSERT INTO public.task_activity(account_id, task_id, user_id, field_name, new_value)
    VALUES (NEW.account_id, NEW.id, v_user, 'archived', NEW.archived_at::text);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_task_activity ON public.reminders;
CREATE TRIGGER trg_log_task_activity
  AFTER INSERT OR UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.log_task_activity();

-- ============================================
-- 7. ASSIGNMENT NOTIFICATION TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL
     AND NEW.assigned_to IS DISTINCT FROM auth.uid()
     AND (TG_OP = 'INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) THEN
    INSERT INTO public.notifications(account_id, user_id, type, title, message, link, reference_id)
    VALUES (
      NEW.account_id,
      NEW.assigned_to,
      'TASK_ASSIGNED',
      'Nueva tarea asignada',
      'Se te ha asignado: ' || NEW.title,
      '/app/tasks',
      NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_assignment ON public.reminders;
CREATE TRIGGER trg_notify_task_assignment
  AFTER INSERT OR UPDATE OF assigned_to ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignment();

-- ============================================
-- 8. SEED DEFAULT COLUMNS FOR EXISTING ACCOUNTS
-- ============================================
INSERT INTO public.task_columns (account_id, name, color, sort_order)
SELECT a.id, c.name, c.color, c.sort_order
FROM public.accounts a
CROSS JOIN (VALUES
  ('Por hacer', '#3b82f6', 0),
  ('En proceso', '#eab308', 1),
  ('QA', '#a855f7', 2),
  ('Completado', '#22c55e', 3)
) AS c(name, color, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.task_columns tc WHERE tc.account_id = a.id
);

-- Backfill column_id on existing reminders by mapping current status to default columns
UPDATE public.reminders r
SET column_id = (
  SELECT tc.id FROM public.task_columns tc
  WHERE tc.account_id = r.account_id
    AND tc.name = CASE r.status
      WHEN 'IN_PROGRESS' THEN 'En proceso'
      WHEN 'QA' THEN 'QA'
      WHEN 'DONE' THEN 'Completado'
      ELSE 'Por hacer'
    END
  LIMIT 1
)
WHERE r.column_id IS NULL;

-- ============================================
-- 9. AUTO-CREATE DEFAULT COLUMNS FOR NEW ACCOUNTS
-- ============================================
CREATE OR REPLACE FUNCTION public.create_default_task_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.task_columns (account_id, name, color, sort_order) VALUES
    (NEW.id, 'Por hacer', '#3b82f6', 0),
    (NEW.id, 'En proceso', '#eab308', 1),
    (NEW.id, 'QA', '#a855f7', 2),
    (NEW.id, 'Completado', '#22c55e', 3);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_default_task_columns ON public.accounts;
CREATE TRIGGER trg_create_default_task_columns
  AFTER INSERT ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.create_default_task_columns();