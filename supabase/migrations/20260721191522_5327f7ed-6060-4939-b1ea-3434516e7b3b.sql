
DROP POLICY IF EXISTS "Managers can view employee docs" ON storage.objects;
DROP POLICY IF EXISTS "Managers can upload employee docs" ON storage.objects;
DROP POLICY IF EXISTS "Managers can delete employee docs" ON storage.objects;

CREATE POLICY "Managers can view employee docs" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND (storage.foldername(name))[1] = (public.get_user_account_id(auth.uid()))::text
  AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
);

CREATE POLICY "Managers can upload employee docs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'employee-documents'
  AND (storage.foldername(name))[1] = (public.get_user_account_id(auth.uid()))::text
  AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
);

CREATE POLICY "Managers can delete employee docs" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND (storage.foldername(name))[1] = (public.get_user_account_id(auth.uid()))::text
  AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
);
