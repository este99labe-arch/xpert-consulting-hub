
-- Remove the unscoped 'notifications-realtime' topic policy and replace with per-user / per-account scoped channels
DROP POLICY IF EXISTS "Authenticated users can subscribe to notifications-realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Users can listen notifications-realtime" ON realtime.messages;
DROP POLICY IF EXISTS "notifications-realtime topic" ON realtime.messages;
DROP POLICY IF EXISTS "Allow notifications-realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Users subscribe own notification channel" ON realtime.messages;
DROP POLICY IF EXISTS "Managers subscribe account notification channel" ON realtime.messages;

-- User-private channel: notifications:user:<auth.uid>
CREATE POLICY "Users subscribe own notification channel"
ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.topic() = 'notifications:user:' || auth.uid()::text
);

-- Account-wide channel for managers / master admins: notifications:account:<account_id>
CREATE POLICY "Managers subscribe account notification channel"
ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.topic() = 'notifications:account:' || public.get_user_account_id(auth.uid())::text
  AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
);
