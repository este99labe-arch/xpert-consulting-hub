-- Las funciones SECURITY DEFINER se saltan las políticas: hay que acotarlas a
-- mano o el aislamiento es de mentira.
--
-- La lista de clientes, por ejemplo, no lee la tabla: llama a
-- list_business_clients_decrypted, que filtraba solo por cuenta. Con las
-- políticas bien puestas, la pantalla habría seguido enseñando los clientes de
-- todas las marcas.

-- ── Comprobaciones de acceso a hijos ──────────────────────────────────────
-- Líneas de factura, cobros, contactos, mensajes… cuelgan de estas funciones.
-- Sin el foco, dentro de una marca se llegaba al detalle de un registro de
-- otra por su identificador.
CREATE OR REPLACE FUNCTION public.can_access_client(_client uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT _client IS NULL OR EXISTS (
    SELECT 1 FROM public.business_clients c
    WHERE c.id = _client AND public.brand_in_scope(c.brand_id));
$function$;

CREATE OR REPLACE FUNCTION public.can_access_invoice(_invoice uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = _invoice AND public.brand_in_scope(i.brand_id));
$function$;

CREATE OR REPLACE FUNCTION public.can_access_product(_product uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT _product IS NULL OR EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = _product AND public.brand_in_scope(p.brand_id));
$function$;

CREATE OR REPLACE FUNCTION public.can_access_recurring(_rec uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.recurring_invoices r
    WHERE r.id = _rec AND public.brand_in_scope(r.brand_id));
$function$;

CREATE OR REPLACE FUNCTION public.can_access_task(_task uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT _task IS NULL OR EXISTS (
    SELECT 1 FROM public.reminders r
    WHERE r.id = _task AND public.brand_in_scope(r.brand_id));
$function$;

CREATE OR REPLACE FUNCTION public.can_access_conversation(_conv uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT _conv IS NULL OR EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = _conv AND public.brand_in_scope(c.brand_id));
$function$;

-- ── Lecturas que devuelven datos descifrados ──────────────────────────────
-- Devuelve además la marca de cada cliente: desde la cuenta principal se ven
-- los de todas y hay que poder distinguirlos de un vistazo.
DROP FUNCTION IF EXISTS public.list_business_clients_decrypted(uuid);

CREATE FUNCTION public.list_business_clients_decrypted(_account_id uuid)
RETURNS TABLE(id uuid, account_id uuid, name text, tax_id text, email text, phone text,
  address text, city text, postal_code text, country text, billing_address text,
  billing_city text, billing_postal_code text, billing_country text, website text,
  notes text, status text, default_vat_percentage numeric, auto_journal_entry boolean,
  plan_id uuid, created_at timestamp with time zone,
  brand_id uuid, brand_name text, brand_color text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'extensions'
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
    bc.default_vat_percentage, bc.auto_journal_entry, bc.plan_id, bc.created_at,
    bc.brand_id, b.name, b.color
  FROM public.business_clients bc
  LEFT JOIN public.brands b ON b.id = bc.brand_id
  WHERE bc.account_id = _account_id
    AND public.brand_in_scope(bc.brand_id)
  ORDER BY bc.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_decrypted_business_client(_id uuid)
RETURNS TABLE(id uuid, account_id uuid, name text, tax_id text, email text, phone text,
  address text, city text, postal_code text, country text, billing_address text,
  billing_city text, billing_postal_code text, billing_country text, website text,
  notes text, status text, default_vat_percentage numeric, auto_journal_entry boolean,
  plan_id uuid, created_at timestamp with time zone)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_account_id uuid;
BEGIN
  SELECT bc.account_id INTO v_account_id FROM public.business_clients bc WHERE bc.id = _id;
  IF v_account_id IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF v_account_id IS DISTINCT FROM public.get_user_account_id(auth.uid())
     AND NOT public.has_role(auth.uid(), 'MASTER_ADMIN') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  -- Entrar por el identificador no puede saltarse la marca en la que estás.
  IF NOT public.can_access_client(_id) THEN
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
    bc.default_vat_percentage, bc.auto_journal_entry, bc.plan_id, bc.created_at
  FROM public.business_clients bc WHERE bc.id = _id;
END;
$function$;

-- Los indicadores del panel deben contar solo lo de la marca en la que estás.
CREATE OR REPLACE FUNCTION public.invoice_kpis(_account_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'total_income',    COALESCE(SUM(CASE WHEN type = 'INVOICE' THEN amount_total ELSE 0 END), 0),
    'total_expenses',  COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount_total ELSE 0 END), 0),
    'total_paid',      COALESCE(SUM(CASE WHEN type = 'INVOICE' AND status = 'PAID' THEN amount_total ELSE 0 END), 0),
    'total_pending',   COALESCE(SUM(CASE WHEN type = 'INVOICE' AND status != 'PAID' THEN amount_total ELSE 0 END), 0),
    'total_quotes',    COALESCE(SUM(CASE WHEN type = 'QUOTE' THEN amount_total ELSE 0 END), 0),
    'accepted_quotes', COALESCE(SUM(CASE WHEN type = 'QUOTE' AND status IN ('ACCEPTED', 'INVOICED') THEN amount_total ELSE 0 END), 0),
    'pending_quotes',  COALESCE(SUM(CASE WHEN type = 'QUOTE' AND status IN ('DRAFT', 'SENT') THEN amount_total ELSE 0 END), 0)
  )
  FROM public.invoices
  WHERE account_id = _account_id
    AND public.brand_in_scope(brand_id)
$function$;
