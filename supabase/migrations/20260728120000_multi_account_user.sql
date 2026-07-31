-- MULTI-CUENTA POR USUARIO: un mismo usuario (p. ej. un manager) puede
-- pertenecer a varias cuentas ERP y elegir en cuál está trabajando.
--
-- Hasta ahora la cuenta se resolvía con LIMIT 1 sin ORDER BY: con dos
-- pertenencias, frontend y RLS podían elegir cuentas DISTINTAS y la app
-- quedaba en blanco sin error. Se arregla con:
--   1. una selección explícita de "cuenta activa" por usuario, y
--   2. un orden determinista como último recurso.

CREATE TABLE IF NOT EXISTS public.user_active_account (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_active_account ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own active account" ON public.user_active_account;
CREATE POLICY "Users manage own active account"
  ON public.user_active_account FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Resolución de cuenta (usada por las 186 políticas RLS):
--   1) sesión de soporte (solo MASTER_ADMIN)
--   2) cuenta activa elegida por el usuario (validada contra sus pertenencias:
--      una selección inválida simplemente se ignora)
--   3) primera pertenencia por orden determinista (created_at, account_id)
CREATE OR REPLACE FUNCTION public.get_user_account_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT ss.account_id
       FROM public.support_sessions ss
      WHERE ss.user_id = _user_id
        AND ss.expires_at > now()
        AND public.has_role(_user_id, 'MASTER_ADMIN')),
    (SELECT uaa.account_id
       FROM public.user_active_account uaa
      WHERE uaa.user_id = _user_id
        AND EXISTS (
              SELECT 1 FROM public.user_accounts ua
               WHERE ua.user_id = _user_id
                 AND ua.account_id = uaa.account_id
                 AND ua.is_active = true)),
    (SELECT ua.account_id
       FROM public.user_accounts ua
      WHERE ua.user_id = _user_id
        AND ua.is_active = true
      ORDER BY ua.created_at, ua.account_id
      LIMIT 1)
  )
$function$;

-- Cuenta real (ignora la suplantación de soporte, pero SÍ respeta la
-- selección de cuenta activa del usuario).
CREATE OR REPLACE FUNCTION public.get_real_account_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT uaa.account_id
       FROM public.user_active_account uaa
      WHERE uaa.user_id = _user_id
        AND EXISTS (
              SELECT 1 FROM public.user_accounts ua
               WHERE ua.user_id = _user_id
                 AND ua.account_id = uaa.account_id
                 AND ua.is_active = true)),
    (SELECT ua.account_id
       FROM public.user_accounts ua
      WHERE ua.user_id = _user_id
        AND ua.is_active = true
      ORDER BY ua.created_at, ua.account_id
      LIMIT 1)
  )
$function$;

-- Pertenencias del usuario con nombre de cuenta y rol. Es SECURITY DEFINER
-- porque la RLS de accounts solo deja ver la cuenta ACTIVA: sin esto, el
-- conmutador no podría mostrar los nombres de las demás cuentas.
CREATE OR REPLACE FUNCTION public.list_my_memberships()
RETURNS TABLE(account_id uuid, account_name text, role_code text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT ua.account_id, a.name, r.code
    FROM public.user_accounts ua
    JOIN public.accounts a ON a.id = ua.account_id
    JOIN public.roles r ON r.id = ua.role_id
   WHERE ua.user_id = auth.uid()
     AND ua.is_active = true
   ORDER BY ua.created_at, ua.account_id
$function$;

-- Cambiar de cuenta activa (valida la pertenencia).
CREATE OR REPLACE FUNCTION public.set_active_account(_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_accounts
     WHERE user_id = auth.uid() AND account_id = _account_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'No perteneces a esa cuenta';
  END IF;

  INSERT INTO public.user_active_account (user_id, account_id)
  VALUES (auth.uid(), _account_id)
  ON CONFLICT (user_id) DO UPDATE
    SET account_id = EXCLUDED.account_id, updated_at = now();
END;
$function$;

-- Localizar un usuario por email (solo para el alta de cuentas desde la Edge
-- Function con service_role: permite vincular un manager EXISTENTE a una
-- cuenta nueva en vez de fallar por email duplicado).
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1
$function$;

REVOKE EXECUTE ON FUNCTION public.list_my_memberships() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_active_account(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.list_my_memberships() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO service_role;
