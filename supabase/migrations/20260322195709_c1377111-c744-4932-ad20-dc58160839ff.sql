
ALTER TABLE public.reminders 
ADD COLUMN status text NOT NULL DEFAULT 'REMINDER',
ADD COLUMN labels text[] NOT NULL DEFAULT '{}';
