-- employee_profiles: drop public-role policies and recreate scoped to authenticated
DROP POLICY IF EXISTS "Managers can manage account profiles" ON public.employee_profiles;
DROP POLICY IF EXISTS "Master admins can manage all profiles" ON public.employee_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.employee_profiles;

CREATE POLICY "Managers can manage account profiles"
ON public.employee_profiles
AS PERMISSIVE
FOR ALL
TO authenticated
USING ((account_id = get_user_account_id(auth.uid())) AND (has_role(auth.uid(), 'MANAGER'::text) OR has_role(auth.uid(), 'MASTER_ADMIN'::text)))
WITH CHECK ((account_id = get_user_account_id(auth.uid())) AND (has_role(auth.uid(), 'MANAGER'::text) OR has_role(auth.uid(), 'MASTER_ADMIN'::text)));

CREATE POLICY "Master admins can manage all profiles"
ON public.employee_profiles
AS PERMISSIVE
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'MASTER_ADMIN'::text))
WITH CHECK (has_role(auth.uid(), 'MASTER_ADMIN'::text));

CREATE POLICY "Users can view own profile"
ON public.employee_profiles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- employee_documents: same issue, fix while we're here
DROP POLICY IF EXISTS "Managers can manage account documents" ON public.employee_documents;
DROP POLICY IF EXISTS "Users can view own documents" ON public.employee_documents;

CREATE POLICY "Managers can manage account documents"
ON public.employee_documents
AS PERMISSIVE
FOR ALL
TO authenticated
USING ((account_id = get_user_account_id(auth.uid())) AND (has_role(auth.uid(), 'MANAGER'::text) OR has_role(auth.uid(), 'MASTER_ADMIN'::text)))
WITH CHECK ((account_id = get_user_account_id(auth.uid())) AND (has_role(auth.uid(), 'MANAGER'::text) OR has_role(auth.uid(), 'MASTER_ADMIN'::text)));

CREATE POLICY "Users can view own documents"
ON public.employee_documents
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (user_id = auth.uid());