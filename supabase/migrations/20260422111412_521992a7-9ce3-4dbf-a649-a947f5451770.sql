-- =====================================================================
-- FASE 1 GDPR: Cifrado AES-256 a nivel de columna con pgcrypto
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Helper: clave de cifrado (configurable vía ALTER DATABASE ... SET app.encryption_key = '...')
CREATE OR REPLACE FUNCTION public._get_encryption_key()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_key text;
BEGIN
  BEGIN
    v_key := current_setting('app.encryption_key', true);
  EXCEPTION WHEN OTHERS THEN v_key := NULL;
  END;
  IF v_key IS NULL OR v_key = '' THEN
    v_key := 'xpert_default_dev_key_REPLACE_IN_PRODUCTION_2026';
  END IF;
  RETURN v_key;
END;
$$;

CREATE OR REPLACE FUNCTION public._encrypt_text(_plain text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF _plain IS NULL THEN RETURN NULL; END IF;
  RETURN extensions.pgp_sym_encrypt(_plain, public._get_encryption_key(), 'cipher-algo=aes256');
END;
$$;

CREATE OR REPLACE FUNCTION public._decrypt_text(_cipher bytea)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF _cipher IS NULL THEN RETURN NULL; END IF;
  RETURN extensions.pgp_sym_decrypt(_cipher, public._get_encryption_key());
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public._hash_search(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT CASE
    WHEN _value IS NULL OR _value = '' THEN NULL
    ELSE encode(extensions.digest(lower(trim(_value)), 'sha256'), 'hex')
  END;
$$;

-- =====================================================================
-- BUSINESS_CLIENTS
-- =====================================================================
ALTER TABLE public.business_clients
  ADD COLUMN IF NOT EXISTS tax_id_enc bytea,
  ADD COLUMN IF NOT EXISTS tax_id_hash text,
  ADD COLUMN IF NOT EXISTS email_enc bytea,
  ADD COLUMN IF NOT EXISTS email_hash text,
  ADD COLUMN IF NOT EXISTS phone_enc bytea,
  ADD COLUMN IF NOT EXISTS address_enc bytea,
  ADD COLUMN IF NOT EXISTS billing_address_enc bytea;

CREATE INDEX IF NOT EXISTS idx_business_clients_tax_id_hash ON public.business_clients(tax_id_hash);
CREATE INDEX IF NOT EXISTS idx_business_clients_email_hash ON public.business_clients(email_hash);

UPDATE public.business_clients
SET tax_id_enc = public._encrypt_text(tax_id),
    tax_id_hash = public._hash_search(tax_id),
    email_enc = public._encrypt_text(email),
    email_hash = public._hash_search(email),
    phone_enc = public._encrypt_text(phone),
    address_enc = public._encrypt_text(address),
    billing_address_enc = public._encrypt_text(billing_address)
WHERE tax_id_enc IS NULL;

CREATE OR REPLACE FUNCTION public.business_clients_encrypt_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.tax_id IS DISTINCT FROM OLD.tax_id THEN
    NEW.tax_id_enc := public._encrypt_text(NEW.tax_id);
    NEW.tax_id_hash := public._hash_search(NEW.tax_id);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.email IS DISTINCT FROM OLD.email THEN
    NEW.email_enc := public._encrypt_text(NEW.email);
    NEW.email_hash := public._hash_search(NEW.email);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.phone IS DISTINCT FROM OLD.phone THEN
    NEW.phone_enc := public._encrypt_text(NEW.phone);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.address IS DISTINCT FROM OLD.address THEN
    NEW.address_enc := public._encrypt_text(NEW.address);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.billing_address IS DISTINCT FROM OLD.billing_address THEN
    NEW.billing_address_enc := public._encrypt_text(NEW.billing_address);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_clients_encrypt ON public.business_clients;
CREATE TRIGGER trg_business_clients_encrypt
  BEFORE INSERT OR UPDATE ON public.business_clients
  FOR EACH ROW EXECUTE FUNCTION public.business_clients_encrypt_trigger();

CREATE OR REPLACE FUNCTION public.list_business_clients_decrypted(_account_id uuid)
RETURNS TABLE(
  id uuid, account_id uuid, name text, tax_id text, email text, phone text,
  address text, city text, postal_code text, country text,
  billing_address text, billing_city text, billing_postal_code text, billing_country text,
  website text, notes text, status text,
  default_vat_percentage numeric, auto_journal_entry boolean, plan_id uuid, created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
    bc.default_vat_percentage, bc.auto_journal_entry, bc.plan_id, bc.created_at
  FROM public.business_clients bc
  WHERE bc.account_id = _account_id
  ORDER BY bc.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_decrypted_business_client(_id uuid)
RETURNS TABLE(
  id uuid, account_id uuid, name text, tax_id text, email text, phone text,
  address text, city text, postal_code text, country text,
  billing_address text, billing_city text, billing_postal_code text, billing_country text,
  website text, notes text, status text,
  default_vat_percentage numeric, auto_journal_entry boolean, plan_id uuid, created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
    bc.default_vat_percentage, bc.auto_journal_entry, bc.plan_id, bc.created_at
  FROM public.business_clients bc WHERE bc.id = _id;
END;
$$;

-- =====================================================================
-- CLIENT_CONTACTS  (escapamos "position" porque es palabra reservada)
-- =====================================================================
ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS email_enc bytea,
  ADD COLUMN IF NOT EXISTS phone_enc bytea;

UPDATE public.client_contacts
SET email_enc = public._encrypt_text(email),
    phone_enc = public._encrypt_text(phone)
WHERE email_enc IS NULL AND phone_enc IS NULL;

CREATE OR REPLACE FUNCTION public.client_contacts_encrypt_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.email IS DISTINCT FROM OLD.email THEN
    NEW.email_enc := public._encrypt_text(NEW.email);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.phone IS DISTINCT FROM OLD.phone THEN
    NEW.phone_enc := public._encrypt_text(NEW.phone);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_contacts_encrypt ON public.client_contacts;
CREATE TRIGGER trg_client_contacts_encrypt
  BEFORE INSERT OR UPDATE ON public.client_contacts
  FOR EACH ROW EXECUTE FUNCTION public.client_contacts_encrypt_trigger();

CREATE OR REPLACE FUNCTION public.list_client_contacts_decrypted(_client_id uuid)
RETURNS TABLE(
  id uuid, account_id uuid, client_id uuid, name text,
  job_position text, email text, phone text, is_primary boolean, created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_account_id uuid;
BEGIN
  SELECT bc.account_id INTO v_account_id FROM public.business_clients bc WHERE bc.id = _client_id;
  IF v_account_id IS DISTINCT FROM public.get_user_account_id(auth.uid())
     AND NOT public.has_role(auth.uid(), 'MASTER_ADMIN') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT cc.id, cc.account_id, cc.client_id, cc.name,
         cc.position::text,
         public._decrypt_text(cc.email_enc),
         public._decrypt_text(cc.phone_enc),
         cc.is_primary, cc.created_at
  FROM public.client_contacts cc
  WHERE cc.client_id = _client_id
  ORDER BY cc.is_primary DESC NULLS LAST, cc.created_at;
END;
$$;

-- =====================================================================
-- EMPLOYEE_PROFILES
-- =====================================================================
ALTER TABLE public.employee_profiles
  ADD COLUMN IF NOT EXISTS dni_enc bytea,
  ADD COLUMN IF NOT EXISTS dni_hash text,
  ADD COLUMN IF NOT EXISTS ssn_enc bytea,
  ADD COLUMN IF NOT EXISTS phone_enc bytea,
  ADD COLUMN IF NOT EXISTS address_enc bytea,
  ADD COLUMN IF NOT EXISTS date_of_birth_enc bytea;

CREATE INDEX IF NOT EXISTS idx_employee_profiles_dni_hash ON public.employee_profiles(dni_hash);

UPDATE public.employee_profiles
SET dni_enc = public._encrypt_text(dni),
    dni_hash = public._hash_search(dni),
    ssn_enc = public._encrypt_text(social_security_number),
    phone_enc = public._encrypt_text(phone),
    address_enc = public._encrypt_text(address),
    date_of_birth_enc = public._encrypt_text(date_of_birth::text)
WHERE dni_enc IS NULL;

CREATE OR REPLACE FUNCTION public.employee_profiles_encrypt_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.dni IS DISTINCT FROM OLD.dni THEN
    NEW.dni_enc := public._encrypt_text(NEW.dni);
    NEW.dni_hash := public._hash_search(NEW.dni);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.social_security_number IS DISTINCT FROM OLD.social_security_number THEN
    NEW.ssn_enc := public._encrypt_text(NEW.social_security_number);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.phone IS DISTINCT FROM OLD.phone THEN
    NEW.phone_enc := public._encrypt_text(NEW.phone);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.address IS DISTINCT FROM OLD.address THEN
    NEW.address_enc := public._encrypt_text(NEW.address);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth THEN
    NEW.date_of_birth_enc := public._encrypt_text(NEW.date_of_birth::text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employee_profiles_encrypt ON public.employee_profiles;
CREATE TRIGGER trg_employee_profiles_encrypt
  BEFORE INSERT OR UPDATE ON public.employee_profiles
  FOR EACH ROW EXECUTE FUNCTION public.employee_profiles_encrypt_trigger();

CREATE OR REPLACE FUNCTION public.list_employee_profiles_decrypted(_account_id uuid)
RETURNS TABLE(
  id uuid, account_id uuid, user_id uuid,
  first_name text, last_name text, dni text, social_security_number text,
  phone text, address text, city text, postal_code text,
  date_of_birth date, job_position text, department text, start_date date,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF _account_id IS DISTINCT FROM public.get_user_account_id(auth.uid())
     AND NOT public.has_role(auth.uid(), 'MASTER_ADMIN') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT ep.id, ep.account_id, ep.user_id,
    ep.first_name, ep.last_name,
    public._decrypt_text(ep.dni_enc),
    public._decrypt_text(ep.ssn_enc),
    public._decrypt_text(ep.phone_enc),
    public._decrypt_text(ep.address_enc),
    ep.city, ep.postal_code,
    NULLIF(public._decrypt_text(ep.date_of_birth_enc), '')::date,
    ep.position::text, ep.department, ep.start_date,
    ep.created_at, ep.updated_at
  FROM public.employee_profiles ep
  WHERE ep.account_id = _account_id
    AND (
      public.has_role(auth.uid(), 'MANAGER')
      OR public.has_role(auth.uid(), 'MASTER_ADMIN')
      OR ep.user_id = auth.uid()
    )
  ORDER BY ep.first_name, ep.last_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_decrypted_employee_profile(_user_id uuid)
RETURNS TABLE(
  id uuid, account_id uuid, user_id uuid,
  first_name text, last_name text, dni text, social_security_number text,
  phone text, address text, city text, postal_code text,
  date_of_birth date, job_position text, department text, start_date date,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_account_id uuid;
BEGIN
  SELECT ep.account_id INTO v_account_id FROM public.employee_profiles ep WHERE ep.user_id = _user_id LIMIT 1;
  IF v_account_id IS NULL THEN RETURN; END IF;

  IF _user_id <> auth.uid()
     AND v_account_id IS DISTINCT FROM public.get_user_account_id(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF _user_id <> auth.uid()
     AND NOT (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN')) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT ep.id, ep.account_id, ep.user_id,
    ep.first_name, ep.last_name,
    public._decrypt_text(ep.dni_enc),
    public._decrypt_text(ep.ssn_enc),
    public._decrypt_text(ep.phone_enc),
    public._decrypt_text(ep.address_enc),
    ep.city, ep.postal_code,
    NULLIF(public._decrypt_text(ep.date_of_birth_enc), '')::date,
    ep.position::text, ep.department, ep.start_date,
    ep.created_at, ep.updated_at
  FROM public.employee_profiles ep
  WHERE ep.user_id = _user_id;
END;
$$;

-- =====================================================================
-- ACCOUNTS
-- =====================================================================
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS tax_id_enc bytea,
  ADD COLUMN IF NOT EXISTS tax_id_hash text,
  ADD COLUMN IF NOT EXISTS phone_enc bytea,
  ADD COLUMN IF NOT EXISTS address_enc bytea;

CREATE INDEX IF NOT EXISTS idx_accounts_tax_id_hash ON public.accounts(tax_id_hash);

UPDATE public.accounts
SET tax_id_enc = public._encrypt_text(tax_id),
    tax_id_hash = public._hash_search(tax_id),
    phone_enc = public._encrypt_text(phone),
    address_enc = public._encrypt_text(address)
WHERE tax_id_enc IS NULL;

CREATE OR REPLACE FUNCTION public.accounts_encrypt_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.tax_id IS DISTINCT FROM OLD.tax_id THEN
    NEW.tax_id_enc := public._encrypt_text(NEW.tax_id);
    NEW.tax_id_hash := public._hash_search(NEW.tax_id);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.phone IS DISTINCT FROM OLD.phone THEN
    NEW.phone_enc := public._encrypt_text(NEW.phone);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.address IS DISTINCT FROM OLD.address THEN
    NEW.address_enc := public._encrypt_text(NEW.address);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounts_encrypt ON public.accounts;
CREATE TRIGGER trg_accounts_encrypt
  BEFORE INSERT OR UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.accounts_encrypt_trigger();

CREATE OR REPLACE FUNCTION public.get_decrypted_account(_id uuid)
RETURNS TABLE(
  id uuid, name text, type text, email text, tax_id text, phone text,
  address text, city text, postal_code text, is_active boolean, created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF _id IS DISTINCT FROM public.get_user_account_id(auth.uid())
     AND NOT public.has_role(auth.uid(), 'MASTER_ADMIN') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT a.id, a.name, a.type, a.email,
    public._decrypt_text(a.tax_id_enc),
    public._decrypt_text(a.phone_enc),
    public._decrypt_text(a.address_enc),
    a.city, a.postal_code, a.is_active, a.created_at
  FROM public.accounts a WHERE a.id = _id;
END;
$$;

-- =====================================================================
-- Permisos
-- =====================================================================
GRANT EXECUTE ON FUNCTION public.list_business_clients_decrypted(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_decrypted_business_client(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_client_contacts_decrypted(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_employee_profiles_decrypted(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_decrypted_employee_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_decrypted_account(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public._encrypt_text(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._decrypt_text(bytea) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._get_encryption_key() FROM PUBLIC;