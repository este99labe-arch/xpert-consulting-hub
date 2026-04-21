
DROP POLICY IF EXISTS "Users can upload import files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own account import files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own account import files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload import files to own account" ON storage.objects;

CREATE POLICY "Users can upload import files to own account"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'import-files'
  AND (storage.foldername(name))[1] = public.get_user_account_id(auth.uid())::text
);

CREATE POLICY "Users can view own account import files"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'import-files'
  AND (storage.foldername(name))[1] = public.get_user_account_id(auth.uid())::text
);

CREATE POLICY "Users can delete own account import files"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'import-files'
  AND (storage.foldername(name))[1] = public.get_user_account_id(auth.uid())::text
);
