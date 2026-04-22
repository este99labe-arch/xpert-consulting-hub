
CREATE TABLE public.task_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  entity_label text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  UNIQUE (task_id, entity_type, entity_id)
);

CREATE INDEX idx_task_links_task ON public.task_links(task_id);
CREATE INDEX idx_task_links_account ON public.task_links(account_id);
CREATE INDEX idx_task_links_entity ON public.task_links(entity_type, entity_id);

ALTER TABLE public.task_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view account task links"
ON public.task_links FOR SELECT TO authenticated
USING (account_id = public.get_user_account_id(auth.uid()));

CREATE POLICY "Users can insert account task links"
ON public.task_links FOR INSERT TO authenticated
WITH CHECK (account_id = public.get_user_account_id(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Users can delete account task links"
ON public.task_links FOR DELETE TO authenticated
USING (account_id = public.get_user_account_id(auth.uid()));
