-- ============================================================================
-- Chat: consolidación de tareas, trazabilidad, borrado lógico de conversaciones
-- ============================================================================

-- Borrado lógico de conversaciones (auditable; se reactiva si llega mensaje)
ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Trazabilidad: mensajes de origen de cada tarea generada desde el chat
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS chat_message_ids uuid[] NOT NULL DEFAULT '{}';

-- Ventana de consolidación (minutos): mensajes dentro de la ventana se añaden
-- al ticket abierto de la conversación en vez de crear uno nuevo
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS task_consolidation_minutes integer NOT NULL DEFAULT 60;

GRANT SELECT (task_consolidation_minutes) ON public.whatsapp_config TO authenticated;
GRANT UPDATE (task_consolidation_minutes) ON public.whatsapp_config TO authenticated;
