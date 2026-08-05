-- Deduplicación de mensajes de WhatsApp por id de Meta.
--
-- Con la coexistencia activada, Meta envía un "eco" (smb_message_echoes) de
-- CADA mensaje que sale del número, venga del móvil o de nuestra propia API.
-- Sin esta restricción, un mensaje enviado desde el SaaS se guardaría dos
-- veces: una al enviarlo y otra al recibir su eco.
--
-- Índice parcial: los mensajes sin wa_message_id (fallos de envío, mensajes
-- internos) no compiten entre sí.
create unique index if not exists chat_messages_wa_id_uniq
  on public.chat_messages (account_id, wa_message_id)
  where wa_message_id is not null;
