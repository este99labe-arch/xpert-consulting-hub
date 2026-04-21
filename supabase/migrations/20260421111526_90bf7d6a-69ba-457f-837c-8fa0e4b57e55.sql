
DROP POLICY IF EXISTS "Authenticated users can subscribe to own account channels" ON realtime.messages;

CREATE POLICY "Scoped realtime channel subscriptions"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Notifications channel: row-level filtering is enforced by notifications table RLS
  realtime.topic() = 'notifications-realtime'
  -- XpertRed chat channels: only match participants
  OR (
    realtime.topic() LIKE 'xred-chat-%'
    AND public.xred_is_match_participant(
      substring(realtime.topic() from 11)::uuid,
      auth.uid()
    )
  )
  -- Account-scoped channels (future-proof convention)
  OR (
    public.get_user_account_id(auth.uid()) IS NOT NULL
    AND (
      realtime.topic() = public.get_user_account_id(auth.uid())::text
      OR realtime.topic() LIKE public.get_user_account_id(auth.uid())::text || ':%'
    )
  )
  -- User-scoped channels (future-proof convention)
  OR realtime.topic() = 'user:' || auth.uid()::text
  OR realtime.topic() LIKE 'user:' || auth.uid()::text || ':%'
);
