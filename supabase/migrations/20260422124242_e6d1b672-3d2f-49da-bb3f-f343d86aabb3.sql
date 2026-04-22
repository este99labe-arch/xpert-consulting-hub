-- Tabla de consentimientos RGPD
CREATE TABLE public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text,
  consent_type text NOT NULL CHECK (consent_type IN ('necessary', 'analytics', 'marketing', 'all')),
  granted boolean NOT NULL,
  policy_version text NOT NULL DEFAULT '1.0',
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_consents_user_id ON public.user_consents(user_id);
CREATE INDEX idx_user_consents_session_id ON public.user_consents(session_id);
CREATE INDEX idx_user_consents_created_at ON public.user_consents(created_at DESC);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

-- Cualquiera (incl. anónimos) puede insertar su propio consentimiento
CREATE POLICY "Anyone can insert their own consent"
ON public.user_consents
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (auth.uid() IS NULL AND user_id IS NULL AND session_id IS NOT NULL)
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
);

-- Los usuarios pueden ver sus propios consentimientos
CREATE POLICY "Users can view their own consents"
ON public.user_consents
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- MASTER_ADMIN puede ver todos los consentimientos
CREATE POLICY "Master admin can view all consents"
ON public.user_consents
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'MASTER_ADMIN'));