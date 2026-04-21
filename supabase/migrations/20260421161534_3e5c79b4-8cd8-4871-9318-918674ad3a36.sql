-- === api_keys: restrict SELECT to managers/master admins ===
DROP POLICY IF EXISTS "Users can view account api keys" ON public.api_keys;
DROP POLICY IF EXISTS "Authenticated users can view account api keys" ON public.api_keys;
DROP POLICY IF EXISTS "Account users can view api keys" ON public.api_keys;

CREATE POLICY "Managers can view account api keys"
ON public.api_keys FOR SELECT TO authenticated
USING (
  account_id = public.get_user_account_id(auth.uid())
  AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
);

-- === employee-documents storage: add UPDATE policy ===
DROP POLICY IF EXISTS "Managers update employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Users update own employee documents" ON storage.objects;

-- Managers/MasterAdmins of the same account can update any file under their account folder
CREATE POLICY "Managers update employee documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND (storage.foldername(name))[1] = public.get_user_account_id(auth.uid())::text
  AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
)
WITH CHECK (
  bucket_id = 'employee-documents'
  AND (storage.foldername(name))[1] = public.get_user_account_id(auth.uid())::text
  AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
);

-- Users can update only their own files (<account_id>/<user_id>/<file>)
CREATE POLICY "Users update own employee documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND (storage.foldername(name))[1] = public.get_user_account_id(auth.uid())::text
  AND (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'employee-documents'
  AND (storage.foldername(name))[1] = public.get_user_account_id(auth.uid())::text
  AND (storage.foldername(name))[2] = auth.uid()::text
);