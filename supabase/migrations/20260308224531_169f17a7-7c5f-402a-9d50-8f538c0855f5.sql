
-- Create document_folders table
CREATE TABLE public.document_folders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  user_id uuid NOT NULL,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add folder_id to employee_documents
ALTER TABLE public.employee_documents ADD COLUMN folder_id uuid REFERENCES public.document_folders(id);

-- Enable RLS
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;

-- RLS: Managers can manage all folders in their account
CREATE POLICY "Managers can manage account document folders"
ON public.document_folders FOR ALL TO authenticated
USING (
  account_id = get_user_account_id(auth.uid())
  AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
);

-- RLS: Employees can view only their own folders
CREATE POLICY "Users can view own document folders"
ON public.document_folders FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Function to ensure default folders exist for an employee
CREATE OR REPLACE FUNCTION public.ensure_default_folders(_account_id uuid, _user_id uuid, _created_by uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  folder_names text[] := ARRAY['Contratos', 'Nóminas', 'Certificados', 'Identificación', 'Otros'];
  fname text;
BEGIN
  FOREACH fname IN ARRAY folder_names LOOP
    INSERT INTO public.document_folders (account_id, user_id, name, is_default, created_by)
    VALUES (_account_id, _user_id, fname, true, _created_by)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- Add unique constraint to prevent duplicate default folders
ALTER TABLE public.document_folders ADD CONSTRAINT unique_folder_per_user UNIQUE (account_id, user_id, name);
