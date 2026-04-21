
-- Enable RLS on realtime.messages (Supabase uses this to authorize channel subscriptions)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can subscribe to own account channels" ON realtime.messages;

-- Allow authenticated users to subscribe only to channels scoped to their account_id or user_id
-- Convention: channel topics should be named like "<account_id>" or "<account_id>:<...>" or "user:<user_id>" or "user:<user_id>:<...>"
CREATE POLICY "Authenticated users can subscribe to own account channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Channel scoped to user's account_id (exact or prefix "<account_id>:")
  (
    public.get_user_account_id(auth.uid()) IS NOT NULL
    AND (
      realtime.topic() = public.get_user_account_id(auth.uid())::text
      OR realtime.topic() LIKE public.get_user_account_id(auth.uid())::text || ':%'
    )
  )
  -- Or channel scoped to user themselves
  OR realtime.topic() = 'user:' || auth.uid()::text
  OR realtime.topic() LIKE 'user:' || auth.uid()::text || ':%'
);
