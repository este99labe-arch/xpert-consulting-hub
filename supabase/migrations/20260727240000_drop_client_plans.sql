-- ============================================================================
-- FASE 5 — Retirada de client_plans (sustituida por verticals/services)
-- ============================================================================
-- ⚠️ MIGRACIÓN DESTRUCTIVA — REVISAR ANTES DE APLICAR
--
-- Comprobado en producción antes de escribir esta migración:
--   client_plans .......................... 0 filas
--   business_clients con plan_id ........... 0 filas
-- Por tanto no se pierde ningún dato. Vuelve a comprobarlo antes de ejecutar:
--
--   SELECT (SELECT count(*) FROM client_plans) AS planes,
--          (SELECT count(*) FROM business_clients WHERE plan_id IS NOT NULL) AS con_plan;
--
-- Si ambos siguen a 0, es seguro aplicarla.
--
-- ORDEN IMPORTANTE: primero se recrean las dos RPC que devolvían plan_id. Si se
-- soltara la columna antes, quedarían rotas y caería el módulo de Clientes
-- (las usan el listado y la ficha). Como cambia el tipo de retorno, hace falta
-- DROP + CREATE en vez de CREATE OR REPLACE.
--
-- El frontend ya no lee plan_id (la pestaña "Plan" se retiró), así que aplicar
-- esta migración no requiere ningún cambio adicional de código.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_decrypted_business_client(uuid);
CREATE FUNCTION public.get_decrypted_business_client(_id uuid)
RETURNS TABLE(id uuid, account_id uuid, name text, tax_id text, email text, phone text,
              address text, city text, postal_code text, country text,
              billing_address text, billing_city text, billing_postal_code text, billing_country text,
              website text, notes text, status text,
              default_vat_percentage numeric, auto_journal_entry boolean, created_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_account_id uuid;
BEGIN
  SELECT bc.account_id INTO v_account_id FROM public.business_clients bc WHERE bc.id = _id;
  IF v_account_id IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF v_account_id IS DISTINCT FROM public.get_user_account_id(auth.uid())
     AND NOT public.has_role(auth.uid(), 'MASTER_ADMIN') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT bc.id, bc.account_id, bc.name,
    public._decrypt_text(bc.tax_id_enc),
    public._decrypt_text(bc.email_enc),
    public._decrypt_text(bc.phone_enc),
    public._decrypt_text(bc.address_enc),
    bc.city, bc.postal_code, bc.country,
    public._decrypt_text(bc.billing_address_enc),
    bc.billing_city, bc.billing_postal_code, bc.billing_country,
    bc.website, bc.notes, bc.status,
    bc.default_vat_percentage, bc.auto_journal_entry, bc.created_at
  FROM public.business_clients bc WHERE bc.id = _id;
END;
$function$;

DROP FUNCTION IF EXISTS public.list_business_clients_decrypted(uuid);
CREATE FUNCTION public.list_business_clients_decrypted(_account_id uuid)
RETURNS TABLE(id uuid, account_id uuid, name text, tax_id text, email text, phone text,
              address text, city text, postal_code text, country text,
              billing_address text, billing_city text, billing_postal_code text, billing_country text,
              website text, notes text, status text,
              default_vat_percentage numeric, auto_journal_entry boolean, created_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF _account_id IS DISTINCT FROM public.get_user_account_id(auth.uid())
     AND NOT public.has_role(auth.uid(), 'MASTER_ADMIN') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT bc.id, bc.account_id, bc.name,
    public._decrypt_text(bc.tax_id_enc),
    public._decrypt_text(bc.email_enc),
    public._decrypt_text(bc.phone_enc),
    public._decrypt_text(bc.address_enc),
    bc.city, bc.postal_code, bc.country,
    public._decrypt_text(bc.billing_address_enc),
    bc.billing_city, bc.billing_postal_code, bc.billing_country,
    bc.website, bc.notes, bc.status,
    bc.default_vat_percentage, bc.auto_journal_entry, bc.created_at
  FROM public.business_clients bc
  WHERE bc.account_id = _account_id
  ORDER BY bc.created_at DESC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_decrypted_business_client(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_business_clients_decrypted(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_decrypted_business_client(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_business_clients_decrypted(uuid) TO authenticated;

-- Ya sin dependencias: se sueltan la columna y la tabla.
ALTER TABLE public.business_clients DROP COLUMN IF EXISTS plan_id;
DROP TABLE IF EXISTS public.client_plans;
