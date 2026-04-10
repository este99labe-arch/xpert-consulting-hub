
-- Table for tracking imported invoice files
CREATE TABLE public.invoice_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  status text NOT NULL DEFAULT 'PROCESSING',
  extracted_data jsonb DEFAULT '{}'::jsonb,
  error_message text,
  created_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  uploaded_by uuid NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.invoice_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can manage account invoice imports"
ON public.invoice_imports FOR ALL TO authenticated
USING (
  account_id = get_user_account_id(auth.uid())
  AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
);

CREATE POLICY "Users can view own account imports"
ON public.invoice_imports FOR SELECT TO authenticated
USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Users can insert own imports"
ON public.invoice_imports FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND account_id = get_user_account_id(auth.uid())
);

-- Storage bucket for import files
INSERT INTO storage.buckets (id, name, public) VALUES ('import-files', 'import-files', false);

-- Storage RLS policies
CREATE POLICY "Users can upload import files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'import-files');

CREATE POLICY "Users can view own account import files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'import-files');
