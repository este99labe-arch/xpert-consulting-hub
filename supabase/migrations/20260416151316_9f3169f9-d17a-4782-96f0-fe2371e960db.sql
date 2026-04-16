
-- Update the match trigger to support accept-based flow
CREATE OR REPLACE FUNCTION public.xred_check_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When someone accepts a connection request, mark both sides as match
  IF NEW.type = 'accept' THEN
    NEW.is_match := true;
    -- Also update the original like interaction to is_match = true
    UPDATE public.xred_interactions
    SET is_match = true
    WHERE account_id_from = NEW.account_id_to
      AND account_id_to = NEW.account_id_from
      AND type = 'like';
    RETURN NEW;
  END IF;

  -- For like/skip/block, no auto-match
  NEW.is_match := false;
  RETURN NEW;
END;
$$;
