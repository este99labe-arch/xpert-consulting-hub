-- 1. Ampliar el CHECK de tipos en xred_interactions
ALTER TABLE public.xred_interactions
  DROP CONSTRAINT IF EXISTS xred_interactions_type_check;

ALTER TABLE public.xred_interactions
  ADD CONSTRAINT xred_interactions_type_check
  CHECK (type IN ('like', 'skip', 'block', 'accept', 'reject'));

-- 2. Trigger actualizado para manejar accept/reject
CREATE OR REPLACE FUNCTION public.xred_check_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.type = 'accept' THEN
    NEW.is_match := true;
    UPDATE public.xred_interactions
      SET is_match = true
    WHERE account_id_from = NEW.account_id_to
      AND account_id_to = NEW.account_id_from
      AND type = 'like';
    RETURN NEW;
  END IF;

  NEW.is_match := false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS xred_check_match_trigger ON public.xred_interactions;
CREATE TRIGGER xred_check_match_trigger
  BEFORE INSERT ON public.xred_interactions
  FOR EACH ROW EXECUTE FUNCTION public.xred_check_match();

-- 3. Vista pública del directorio (security_invoker off => usa permisos del owner)
DROP VIEW IF EXISTS public.xred_directory;
CREATE VIEW public.xred_directory
WITH (security_invoker = off) AS
SELECT
  p.account_id,
  a.name AS account_name,
  p.description,
  p.cnae_code,
  p.province,
  p.services_offered,
  p.services_needed,
  p.reputation_score,
  p.is_visible,
  p.created_at,
  p.updated_at
FROM public.xred_profiles p
JOIN public.accounts a ON a.id = p.account_id
WHERE p.is_visible = true AND a.is_active = true;

GRANT SELECT ON public.xred_directory TO authenticated;

-- 4. RPC para resolver nombres + contacto de empresas con las que tengo interacción
CREATE OR REPLACE FUNCTION public.xred_resolve_names(_ids uuid[])
RETURNS TABLE(id uuid, name text, email text, phone text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.id, a.name, a.email, a.phone
  FROM public.accounts a
  WHERE a.id = ANY(_ids)
    AND (
      a.id = get_user_account_id(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.xred_interactions xi
        WHERE (
          (xi.account_id_from = get_user_account_id(auth.uid()) AND xi.account_id_to = a.id)
          OR (xi.account_id_to = get_user_account_id(auth.uid()) AND xi.account_id_from = a.id)
        )
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.xred_resolve_names(uuid[]) TO authenticated;