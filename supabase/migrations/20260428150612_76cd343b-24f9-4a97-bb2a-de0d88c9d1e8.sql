
-- 1. Fix storage policies: scope to authenticated role only
DROP POLICY IF EXISTS "Managers can delete employee docs" ON storage.objects;
DROP POLICY IF EXISTS "Managers can upload employee docs" ON storage.objects;
DROP POLICY IF EXISTS "Managers can view employee docs" ON storage.objects;

CREATE POLICY "Managers can delete employee docs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
);

CREATE POLICY "Managers can upload employee docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'employee-documents'
  AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
);

CREATE POLICY "Managers can view employee docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'MANAGER')
    OR has_role(auth.uid(), 'MASTER_ADMIN')
    OR (auth.uid())::text = (storage.foldername(name))[1]
  )
);

-- 2. Restrict whatsapp_config SELECT to managers only (verify_token is sensitive)
DROP POLICY IF EXISTS "Users can view account whatsapp config" ON public.whatsapp_config;

CREATE POLICY "Managers can view account whatsapp config"
ON public.whatsapp_config FOR SELECT
TO authenticated
USING (
  account_id = get_user_account_id(auth.uid())
  AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
);

-- 3. Remove blanket 'notifications-realtime' allow from realtime policy
DROP POLICY IF EXISTS "Scoped realtime channel subscriptions" ON realtime.messages;

CREATE POLICY "Scoped realtime channel subscriptions"
ON realtime.messages FOR SELECT
TO authenticated
USING (
  ((realtime.topic() ~~ 'xred-chat-%') AND xred_is_match_participant((SUBSTRING(realtime.topic() FROM 11))::uuid, auth.uid()))
  OR (
    get_user_account_id(auth.uid()) IS NOT NULL
    AND (
      realtime.topic() = (get_user_account_id(auth.uid()))::text
      OR realtime.topic() LIKE ((get_user_account_id(auth.uid()))::text || ':%')
    )
  )
  OR realtime.topic() = ('user:' || (auth.uid())::text)
  OR realtime.topic() LIKE (('user:' || (auth.uid())::text) || ':%')
);
