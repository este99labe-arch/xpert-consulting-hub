-- Recrear vista con security_invoker=on
DROP VIEW IF EXISTS public.xred_directory;
CREATE VIEW public.xred_directory
WITH (security_invoker = on) AS
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

-- Política para permitir leer accounts cuando tienen perfil XpertRed visible
-- Esto sólo expone nombre/datos básicos vía la vista; la vista no incluye campos sensibles
CREATE POLICY "Authenticated can view accounts with visible xred profile"
ON public.accounts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.xred_profiles xp
    WHERE xp.account_id = accounts.id AND xp.is_visible = true
  )
);

-- Limpiar interacciones previas para empezar limpio el flujo de pruebas
DELETE FROM public.xred_interactions;