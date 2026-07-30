-- Sesiones de soporte: permiten a un MASTER_ADMIN operar dentro de una cuenta
-- cliente para dar soporte, viendo la app como la ve el cliente.
--
-- Punto clave del diseño: en vez de tocar las 63 políticas RLS que solo
-- permitían la cuenta propia, se hace consciente de la suplantación la función
-- get_user_account_id(), de la que dependen las 186 políticas. Así el cambio es
-- uno solo y no quedan tablas olvidadas.
--
-- Es retrocompatible: sin sesión de soporte activa, la función devuelve
-- exactamente lo mismo que antes.

CREATE TABLE IF NOT EXISTS public.support_sessions (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  reason     text,
  started_at timestamptz NOT NULL DEFAULT now(),
  -- Caducidad de seguridad: una sesión olvidada deja de dar acceso sola.
  expires_at timestamptz NOT NULL DEFAULT now() + interval '8 hours'
);

ALTER TABLE public.support_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Master admin manages own support session" ON public.support_sessions;
CREATE POLICY "Master admin manages own support session"
  ON public.support_sessions FOR ALL
  USING (user_id = (SELECT auth.uid()) AND public.has_role((SELECT auth.uid()), 'MASTER_ADMIN'))
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.has_role((SELECT auth.uid()), 'MASTER_ADMIN'));

-- No hay recursión de RLS: la función es SECURITY DEFINER y las tablas que
-- consulta no tienen FORCE ROW LEVEL SECURITY.
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
    (SELECT ua.account_id
       FROM public.user_accounts ua
      WHERE ua.user_id = _user_id
        AND ua.is_active = true
      LIMIT 1)
  )
$function$;

-- Cuenta real del usuario, ignorando la suplantación (la usa el Panel Master
-- para sus propios datos, que no deben desviarse a la cuenta del cliente).
CREATE OR REPLACE FUNCTION public.get_real_account_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT ua.account_id
    FROM public.user_accounts ua
   WHERE ua.user_id = _user_id
     AND ua.is_active = true
   LIMIT 1
$function$;

-- Entrar en una cuenta cliente. Deja rastro en audit_logs (RGPD).
CREATE OR REPLACE FUNCTION public.start_support_session(_account_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid  uuid := auth.uid();
  v_real uuid;
BEGIN
  IF NOT public.has_role(v_uid, 'MASTER_ADMIN') THEN
    RAISE EXCEPTION 'Solo un administrador puede iniciar una sesión de soporte';
  END IF;

  v_real := public.get_real_account_id(v_uid);
  IF _account_id = v_real THEN
    RAISE EXCEPTION 'Esa ya es tu propia cuenta';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = _account_id) THEN
    RAISE EXCEPTION 'La cuenta no existe';
  END IF;

  INSERT INTO public.support_sessions (user_id, account_id, reason, started_at, expires_at)
  VALUES (v_uid, _account_id, _reason, now(), now() + interval '8 hours')
  ON CONFLICT (user_id) DO UPDATE
    SET account_id = EXCLUDED.account_id,
        reason     = EXCLUDED.reason,
        started_at = now(),
        expires_at = now() + interval '8 hours';

  INSERT INTO public.audit_logs (account_id, user_id, action, entity_type, entity_id, details)
  VALUES (_account_id, v_uid, 'SUPPORT_SESSION_START', 'account', _account_id::text,
          jsonb_build_object('reason', _reason, 'expires_at', now() + interval '8 hours'));
END;
$function$;

CREATE OR REPLACE FUNCTION public.end_support_session()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_account uuid;
BEGIN
  SELECT account_id INTO v_account FROM public.support_sessions WHERE user_id = v_uid;
  IF v_account IS NULL THEN RETURN; END IF;

  DELETE FROM public.support_sessions WHERE user_id = v_uid;

  INSERT INTO public.audit_logs (account_id, user_id, action, entity_type, entity_id, details)
  VALUES (v_account, v_uid, 'SUPPORT_SESSION_END', 'account', v_account::text, '{}'::jsonb);
END;
$function$;

-- Estado de la sesión actual (para el aviso permanente de la interfaz).
CREATE OR REPLACE FUNCTION public.current_support_session()
RETURNS TABLE(account_id uuid, account_name text, reason text, started_at timestamptz, expires_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT ss.account_id, a.name, ss.reason, ss.started_at, ss.expires_at
    FROM public.support_sessions ss
    JOIN public.accounts a ON a.id = ss.account_id
   WHERE ss.user_id = auth.uid()
     AND ss.expires_at > now()
$function$;

-- Estas funciones no tienen sentido sin sesión iniciada.
REVOKE EXECUTE ON FUNCTION public.start_support_session(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.end_support_session() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_support_session() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_real_account_id(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.start_support_session(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_support_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_support_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_real_account_id(uuid) TO authenticated;
