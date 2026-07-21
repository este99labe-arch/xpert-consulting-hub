-- Cada intención puede dirigir su tarea a un tablero concreto.
ALTER TABLE public.chat_intents
  ADD COLUMN IF NOT EXISTS board_id uuid REFERENCES public.task_boards(id) ON DELETE SET NULL;
