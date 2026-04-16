
-- =============================================
-- XpertRed: Red empresarial B2B con matching
-- =============================================

-- 1. Perfiles de empresa en la red
CREATE TABLE public.xred_profiles (
  account_id UUID NOT NULL PRIMARY KEY REFERENCES public.accounts(id) ON DELETE CASCADE,
  description TEXT DEFAULT '',
  services_offered TEXT[] DEFAULT '{}',
  services_needed TEXT[] DEFAULT '{}',
  cnae_code TEXT DEFAULT '',
  province TEXT DEFAULT '',
  employee_count INTEGER DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  reputation_score NUMERIC(3,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.xred_profiles ENABLE ROW LEVEL SECURITY;

-- Managers can manage their own profile
CREATE POLICY "Managers can manage own xred profile"
  ON public.xred_profiles FOR ALL
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
  )
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
  );

-- All authenticated users can view visible profiles
CREATE POLICY "Users can view visible xred profiles"
  ON public.xred_profiles FOR SELECT
  TO authenticated
  USING (is_visible = true);

-- Master admins can manage all profiles
CREATE POLICY "Master admins can manage all xred profiles"
  ON public.xred_profiles FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'MASTER_ADMIN'))
  WITH CHECK (has_role(auth.uid(), 'MASTER_ADMIN'));

-- 2. Interacciones (like/skip/block)
CREATE TABLE public.xred_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id_from UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  account_id_to UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'skip' CHECK (type IN ('like', 'skip', 'block')),
  is_match BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id_from, account_id_to),
  CHECK (account_id_from != account_id_to)
);

CREATE INDEX idx_xred_interactions_from ON public.xred_interactions(account_id_from);
CREATE INDEX idx_xred_interactions_to ON public.xred_interactions(account_id_to);
CREATE INDEX idx_xred_interactions_match ON public.xred_interactions(is_match) WHERE is_match = true;

ALTER TABLE public.xred_interactions ENABLE ROW LEVEL SECURITY;

-- Users can view interactions they're part of
CREATE POLICY "Users can view own xred interactions"
  ON public.xred_interactions FOR SELECT
  TO authenticated
  USING (
    account_id_from = get_user_account_id(auth.uid())
    OR account_id_to = get_user_account_id(auth.uid())
  );

-- Users can create interactions from their account
CREATE POLICY "Users can create xred interactions"
  ON public.xred_interactions FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id_from = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
  );

-- Users can update their own interactions (for match detection)
CREATE POLICY "Users can update own xred interactions"
  ON public.xred_interactions FOR UPDATE
  TO authenticated
  USING (
    account_id_from = get_user_account_id(auth.uid())
    OR account_id_to = get_user_account_id(auth.uid())
  );

-- Master admins can manage all
CREATE POLICY "Master admins can manage all xred interactions"
  ON public.xred_interactions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'MASTER_ADMIN'))
  WITH CHECK (has_role(auth.uid(), 'MASTER_ADMIN'));

-- 3. Function to detect mutual matches
CREATE OR REPLACE FUNCTION public.xred_check_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reverse_exists BOOLEAN;
BEGIN
  IF NEW.type != 'like' THEN
    NEW.is_match := false;
    RETURN NEW;
  END IF;

  -- Check if reverse like exists
  SELECT EXISTS (
    SELECT 1 FROM public.xred_interactions
    WHERE account_id_from = NEW.account_id_to
      AND account_id_to = NEW.account_id_from
      AND type = 'like'
  ) INTO reverse_exists;

  IF reverse_exists THEN
    NEW.is_match := true;
    -- Update the reverse interaction too
    UPDATE public.xred_interactions
    SET is_match = true
    WHERE account_id_from = NEW.account_id_to
      AND account_id_to = NEW.account_id_from
      AND type = 'like';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_xred_check_match
  BEFORE INSERT OR UPDATE ON public.xred_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.xred_check_match();

-- 4. Mensajes de chat post-match
CREATE TABLE public.xred_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  interaction_id UUID NOT NULL REFERENCES public.xred_interactions(id) ON DELETE CASCADE,
  sender_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_xred_messages_interaction ON public.xred_messages(interaction_id, created_at);

ALTER TABLE public.xred_messages ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user's account is part of an interaction
CREATE OR REPLACE FUNCTION public.xred_is_match_participant(_interaction_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.xred_interactions
    WHERE id = _interaction_id
      AND is_match = true
      AND (
        account_id_from = get_user_account_id(_user_id)
        OR account_id_to = get_user_account_id(_user_id)
      )
  )
$$;

-- Participants can view messages
CREATE POLICY "Match participants can view xred messages"
  ON public.xred_messages FOR SELECT
  TO authenticated
  USING (xred_is_match_participant(interaction_id, auth.uid()));

-- Participants can send messages
CREATE POLICY "Match participants can send xred messages"
  ON public.xred_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    xred_is_match_participant(interaction_id, auth.uid())
    AND sender_account_id = get_user_account_id(auth.uid())
  );

-- Participants can update (mark as read)
CREATE POLICY "Match participants can update xred messages"
  ON public.xred_messages FOR UPDATE
  TO authenticated
  USING (xred_is_match_participant(interaction_id, auth.uid()));

-- Master admins can view all (moderation metadata only)
CREATE POLICY "Master admins can manage all xred messages"
  ON public.xred_messages FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'MASTER_ADMIN'))
  WITH CHECK (has_role(auth.uid(), 'MASTER_ADMIN'));

-- Enable realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.xred_messages;

-- 5. Valoraciones
CREATE TABLE public.xred_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  interaction_id UUID NOT NULL REFERENCES public.xred_interactions(id) ON DELETE CASCADE,
  reviewer_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  reviewed_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  punctuality INTEGER NOT NULL CHECK (punctuality BETWEEN 1 AND 5),
  quality INTEGER NOT NULL CHECK (quality BETWEEN 1 AND 5),
  communication INTEGER NOT NULL CHECK (communication BETWEEN 1 AND 5),
  fair_price INTEGER NOT NULL CHECK (fair_price BETWEEN 1 AND 5),
  comment TEXT DEFAULT '',
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (interaction_id, reviewer_account_id),
  CHECK (reviewer_account_id != reviewed_account_id)
);

CREATE INDEX idx_xred_reviews_reviewed ON public.xred_reviews(reviewed_account_id);

ALTER TABLE public.xred_reviews ENABLE ROW LEVEL SECURITY;

-- Everyone in the network can view reviews (not flagged)
CREATE POLICY "Users can view xred reviews"
  ON public.xred_reviews FOR SELECT
  TO authenticated
  USING (is_flagged = false OR reviewer_account_id = get_user_account_id(auth.uid()));

-- Match participants can create reviews
CREATE POLICY "Match participants can create xred reviews"
  ON public.xred_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_account_id = get_user_account_id(auth.uid())
    AND xred_is_match_participant(interaction_id, auth.uid())
  );

-- Master admins can manage all reviews (moderation)
CREATE POLICY "Master admins can manage all xred reviews"
  ON public.xred_reviews FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'MASTER_ADMIN'))
  WITH CHECK (has_role(auth.uid(), 'MASTER_ADMIN'));

-- 6. Function to recalculate reputation score
CREATE OR REPLACE FUNCTION public.xred_update_reputation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  avg_score NUMERIC;
BEGIN
  SELECT AVG((punctuality + quality + communication + fair_price)::NUMERIC / 4.0)
  INTO avg_score
  FROM public.xred_reviews
  WHERE reviewed_account_id = NEW.reviewed_account_id
    AND is_flagged = false;

  UPDATE public.xred_profiles
  SET reputation_score = COALESCE(avg_score, 0),
      updated_at = now()
  WHERE account_id = NEW.reviewed_account_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_xred_update_reputation
  AFTER INSERT OR UPDATE ON public.xred_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.xred_update_reputation();

-- 7. Register XpertRed as an activable module
INSERT INTO public.service_modules (code, name, description)
VALUES ('XPERTRED', 'XpertRed', 'Red empresarial B2B con matching inteligente, chat y reputación verificada')
ON CONFLICT (code) DO NOTHING;
