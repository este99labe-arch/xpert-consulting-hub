
-- Employee documents table
CREATE TABLE public.employee_documents (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size bigint,
  category text NOT NULL DEFAULT 'OTHER',
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

-- Managers can manage all docs in their account
CREATE POLICY "Managers can manage account documents"
ON public.employee_documents FOR ALL
USING (
  account_id = get_user_account_id(auth.uid())
  AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
);

-- Users can view their own documents
CREATE POLICY "Users can view own documents"
ON public.employee_documents FOR SELECT
USING (user_id = auth.uid());

-- Storage bucket for employee documents
INSERT INTO storage.buckets (id, name, public) VALUES ('employee-documents', 'employee-documents', false);

-- Storage policies
CREATE POLICY "Managers can upload employee docs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'employee-documents'
  AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
);

CREATE POLICY "Managers can view employee docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'employee-documents'
  AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN') OR auth.uid()::text = (storage.foldername(name))[1])
);

CREATE POLICY "Managers can delete employee docs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'employee-documents'
  AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
);

-- Also allow managers to manage user_accounts in their own account (needed for employee listing)
CREATE POLICY "Managers can view account users"
ON public.user_accounts FOR SELECT
USING (
  account_id = get_user_account_id(auth.uid())
  AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
);
