-- Las tareas creadas desde el Chat no llevan fecha límite (solo fecha de creación).
ALTER TABLE public.reminders ALTER COLUMN remind_at DROP NOT NULL;
