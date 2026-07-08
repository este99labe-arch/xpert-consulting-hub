-- ============================================================================
-- Chat: soporte de media (audio/imagen) + acceso de empleados a chats por tarea
-- ============================================================================

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS media_mime text,
  ADD COLUMN IF NOT EXISTS media_transcription text;
-- message_type: text | audio | image | document | template

-- Bucket privado para adjuntos de WhatsApp
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', false)
ON CONFLICT (id) DO NOTHING;

-- Convención de ruta: <account_id>/<conversation_id>/<archivo>
DROP POLICY IF EXISTS "chat_media_read_account" ON storage.objects;
CREATE POLICY "chat_media_read_account" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[1] = public.get_user_account_id((SELECT auth.uid()))::text
  );

DROP POLICY IF EXISTS "chat_media_insert_account" ON storage.objects;
CREATE POLICY "chat_media_insert_account" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[1] = public.get_user_account_id((SELECT auth.uid()))::text
  );

-- RLS: empleado ve las tareas asignadas a él
DROP POLICY IF EXISTS "Users view assigned reminders" ON public.reminders;
CREATE POLICY "Users view assigned reminders" ON public.reminders
  FOR SELECT USING (assigned_to = (SELECT auth.uid()));

-- RLS: empleado ve el chat de un cliente si tiene una tarea (de ese chat) asignada
DROP POLICY IF EXISTS "chat_conv_select_via_task" ON public.chat_conversations;
CREATE POLICY "chat_conv_select_via_task" ON public.chat_conversations
  FOR SELECT USING (
    account_id = public.get_user_account_id((SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.reminders r
      WHERE r.chat_conversation_id = chat_conversations.id
        AND r.assigned_to = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "chat_msg_select_via_task" ON public.chat_messages;
CREATE POLICY "chat_msg_select_via_task" ON public.chat_messages
  FOR SELECT USING (
    account_id = public.get_user_account_id((SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.reminders r
      WHERE r.chat_conversation_id = chat_messages.conversation_id
        AND r.assigned_to = (SELECT auth.uid())
    )
  );
