-- ============================================================================
-- Módulo Chat + WhatsApp Business (fundación)
--  - Conversaciones y mensajes bidireccionales
--  - Bot por reglas (intenciones) + creación/asignación de tareas
--  - Notificación de tarea completada por WhatsApp
--  - Multi-tenant: credenciales y configuración por cuenta
-- ============================================================================

-- 1. Credenciales + configuración del bot por cuenta (amplía whatsapp_config) --
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS access_token           text,
  ADD COLUMN IF NOT EXISTS waba_id                text,
  ADD COLUMN IF NOT EXISTS display_phone          text,
  ADD COLUMN IF NOT EXISTS bot_enabled            boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS welcome_message        text NOT NULL DEFAULT '¡Hola! Gracias por escribirnos. ¿En qué podemos ayudarte? Cuéntanos tu solicitud y la registraremos.',
  ADD COLUMN IF NOT EXISTS fallback_message       text NOT NULL DEFAULT 'Hemos recibido tu mensaje. Un miembro del equipo lo revisará en breve.',
  ADD COLUMN IF NOT EXISTS task_ack_message       text NOT NULL DEFAULT 'Tu solicitud ha quedado registrada. Te avisaremos cuando esté resuelta. ¡Gracias!',
  ADD COLUMN IF NOT EXISTS task_completed_template text NOT NULL DEFAULT 'Hola {{contacto}}, tu solicitud "{{tarea}}" se ha completado. ¡Gracias por confiar en nosotros!',
  ADD COLUMN IF NOT EXISTS default_assignee       uuid;

-- 2. Conversaciones -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  contact_phone       text NOT NULL,
  contact_name        text,
  client_id           uuid REFERENCES public.business_clients(id) ON DELETE SET NULL,
  contact_id          uuid REFERENCES public.client_contacts(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'BOT',      -- BOT | PENDING | HUMAN | CLOSED
  assigned_to         uuid,
  bot_paused          boolean NOT NULL DEFAULT false,
  last_message_at     timestamptz,
  last_message_preview text,
  last_direction      text,                              -- IN | OUT
  unread_count        int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, contact_phone)
);
CREATE INDEX IF NOT EXISTS idx_chat_conv_account ON public.chat_conversations(account_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conv_assigned ON public.chat_conversations(assigned_to);

-- 3. Mensajes -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  conversation_id  uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  direction        text NOT NULL,                        -- IN | OUT
  author_type      text NOT NULL DEFAULT 'CONTACT',      -- CONTACT | BOT | AGENT | SYSTEM
  author_user_id   uuid,
  body             text,
  media_url        text,
  wa_message_id    text,
  status           text NOT NULL DEFAULT 'SENT',         -- QUEUED | SENT | DELIVERED | READ | FAILED
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_msg_conv ON public.chat_messages(conversation_id, created_at);

-- 4. Intenciones del bot (reglas por palabras clave) --------------------------
CREATE TABLE IF NOT EXISTS public.chat_intents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name          text NOT NULL,
  kind          text NOT NULL DEFAULT 'GENERAL',         -- TASK | GENERAL | COMPLAINT | OTHER
  keywords      text[] NOT NULL DEFAULT '{}',
  auto_reply    text,
  creates_task  boolean NOT NULL DEFAULT false,
  assignee      uuid,
  sort_order    int NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_intents_account ON public.chat_intents(account_id, sort_order);

-- 5. Enlace de tareas (reminders) con el chat --------------------------------
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS origin              text NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS chat_conversation_id uuid REFERENCES public.chat_conversations(id) ON DELETE SET NULL;

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_intents ENABLE ROW LEVEL SECURITY;

-- Conversaciones: managers ven todas; empleados solo las asignadas a ellos
DROP POLICY IF EXISTS "chat_conv_select" ON public.chat_conversations;
CREATE POLICY "chat_conv_select" ON public.chat_conversations FOR SELECT
  USING (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN')
              OR assigned_to = auth.uid()));

DROP POLICY IF EXISTS "chat_conv_manage" ON public.chat_conversations;
CREATE POLICY "chat_conv_manage" ON public.chat_conversations FOR ALL
  USING (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN')))
  WITH CHECK (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN')));

DROP POLICY IF EXISTS "chat_conv_update_assigned" ON public.chat_conversations;
CREATE POLICY "chat_conv_update_assigned" ON public.chat_conversations FOR UPDATE
  USING (account_id = public.get_user_account_id(auth.uid()) AND assigned_to = auth.uid())
  WITH CHECK (account_id = public.get_user_account_id(auth.uid()));

-- Mensajes: visibles si puedes ver la conversación
DROP POLICY IF EXISTS "chat_msg_select" ON public.chat_messages;
CREATE POLICY "chat_msg_select" ON public.chat_messages FOR SELECT
  USING (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN')
              OR EXISTS (SELECT 1 FROM public.chat_conversations c
                         WHERE c.id = conversation_id AND c.assigned_to = auth.uid())));

-- Intenciones: managers gestionan, cuenta lee
DROP POLICY IF EXISTS "chat_intents_select" ON public.chat_intents;
CREATE POLICY "chat_intents_select" ON public.chat_intents FOR SELECT
  USING (account_id = public.get_user_account_id(auth.uid()));
DROP POLICY IF EXISTS "chat_intents_manage" ON public.chat_intents;
CREATE POLICY "chat_intents_manage" ON public.chat_intents FOR ALL
  USING (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN')))
  WITH CHECK (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN')));

-- Master admin: lectura global
DROP POLICY IF EXISTS "chat_conv_master" ON public.chat_conversations;
CREATE POLICY "chat_conv_master" ON public.chat_conversations FOR SELECT
  USING (public.has_role(auth.uid(),'MASTER_ADMIN'));
DROP POLICY IF EXISTS "chat_msg_master" ON public.chat_messages;
CREATE POLICY "chat_msg_master" ON public.chat_messages FOR SELECT
  USING (public.has_role(auth.uid(),'MASTER_ADMIN'));

-- ============================================================================
-- Realtime
-- ============================================================================
ALTER TABLE public.chat_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ============================================================================
-- Módulo CHAT en el menú
-- ============================================================================
INSERT INTO public.service_modules (code, name, description)
VALUES ('CHAT', 'Chat', 'Conversaciones de WhatsApp Business, bot y tareas automáticas')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.account_modules (account_id, module_id, is_enabled)
SELECT a.id, sm.id, true
FROM public.accounts a
CROSS JOIN public.service_modules sm
WHERE sm.code = 'CHAT'
  AND NOT EXISTS (
    SELECT 1 FROM public.account_modules am WHERE am.account_id = a.id AND am.module_id = sm.id
  );

-- ============================================================================
-- Semilla de intenciones por defecto (por cuenta)
-- ============================================================================
INSERT INTO public.chat_intents (account_id, name, kind, keywords, auto_reply, creates_task, sort_order)
SELECT a.id, i.name, i.kind, i.keywords, i.auto_reply, i.creates_task, i.sort_order
FROM public.accounts a
CROSS JOIN (VALUES
  ('Solicitud / incidencia', 'TASK',      ARRAY['solicito','solicitud','necesito','incidencia','problema','ayuda','presupuesto','cita','pedido'], NULL, true, 1),
  ('Consulta general',       'GENERAL',   ARRAY['consulta','pregunta','informacion','información','horario','precio'], 'Gracias por tu consulta, enseguida te atendemos.', false, 2),
  ('Queja / reclamación',    'COMPLAINT', ARRAY['queja','reclamacion','reclamación','mal','fatal','denuncia'], 'Sentimos el inconveniente. Damos prioridad a tu caso.', false, 3)
) AS i(name, kind, keywords, auto_reply, creates_task, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.chat_intents x WHERE x.account_id = a.id);

-- ============================================================================
-- Trigger: tarea (origen CHAT) completada -> notificación WhatsApp
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_chat_task_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.origin = 'CHAT'
     AND NEW.chat_conversation_id IS NOT NULL
     AND COALESCE(NEW.is_completed,false) = true
     AND COALESCE(OLD.is_completed,false) = false THEN
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
        'task_title', NEW.title
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_chat_task_completed ON public.reminders;
CREATE TRIGGER trg_notify_chat_task_completed
  AFTER UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.notify_chat_task_completed();
