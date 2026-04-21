
-- ===== Fix 1: employee-documents storage cross-tenant access =====
DROP POLICY IF EXISTS "Managers can upload employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Managers can delete employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Managers can view employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Managers manage employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own employee documents" ON storage.objects;

-- Path layout assumed: <account_id>/<user_id>/<filename>
CREATE POLICY "Managers manage own account employee documents"
ON storage.objects FOR ALL TO authenticated
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

CREATE POLICY "Users view own employee documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND (storage.foldername(name))[1] = public.get_user_account_id(auth.uid())::text
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- ===== Fix 2: webhooks.secret readable by all account users =====
DROP POLICY IF EXISTS "Users can view account webhooks" ON public.webhooks;

CREATE POLICY "Managers can view account webhooks"
ON public.webhooks FOR SELECT TO authenticated
USING (
  account_id = public.get_user_account_id(auth.uid())
  AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
);
