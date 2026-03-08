-- Add attachment columns to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text;

-- Create storage bucket for invoice attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-attachments', 'invoice-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can upload to their account folder
CREATE POLICY "Users can upload invoice attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoice-attachments' AND (storage.foldername(name))[1] = (SELECT get_user_account_id(auth.uid()))::text);

-- RLS: users can view their account's attachments
CREATE POLICY "Users can view invoice attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'invoice-attachments' AND (storage.foldername(name))[1] = (SELECT get_user_account_id(auth.uid()))::text);

-- RLS: managers can delete attachments
CREATE POLICY "Managers can delete invoice attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'invoice-attachments' AND (storage.foldername(name))[1] = (SELECT get_user_account_id(auth.uid()))::text AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN')));

-- RLS: users can update (replace) their account attachments  
CREATE POLICY "Users can update invoice attachments"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'invoice-attachments' AND (storage.foldername(name))[1] = (SELECT get_user_account_id(auth.uid()))::text);