-- Función para re-cifrar todos los datos con una nueva clave (uso único, vía edge function service-role)
CREATE OR REPLACE FUNCTION public.reencrypt_all_with_key(_old_key text, _new_key text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_bc int := 0;
  v_cc int := 0;
  v_ep int := 0;
  v_ac int := 0;
BEGIN
  -- business_clients
  UPDATE public.business_clients SET
    tax_id_enc = CASE WHEN tax_id_enc IS NOT NULL
      THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(tax_id_enc, _old_key), _new_key, 'cipher-algo=aes256') END,
    email_enc = CASE WHEN email_enc IS NOT NULL
      THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(email_enc, _old_key), _new_key, 'cipher-algo=aes256') END,
    phone_enc = CASE WHEN phone_enc IS NOT NULL
      THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(phone_enc, _old_key), _new_key, 'cipher-algo=aes256') END,
    address_enc = CASE WHEN address_enc IS NOT NULL
      THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(address_enc, _old_key), _new_key, 'cipher-algo=aes256') END,
    billing_address_enc = CASE WHEN billing_address_enc IS NOT NULL
      THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(billing_address_enc, _old_key), _new_key, 'cipher-algo=aes256') END;
  GET DIAGNOSTICS v_bc = ROW_COUNT;

  -- client_contacts
  UPDATE public.client_contacts SET
    email_enc = CASE WHEN email_enc IS NOT NULL
      THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(email_enc, _old_key), _new_key, 'cipher-algo=aes256') END,
    phone_enc = CASE WHEN phone_enc IS NOT NULL
      THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(phone_enc, _old_key), _new_key, 'cipher-algo=aes256') END;
  GET DIAGNOSTICS v_cc = ROW_COUNT;

  -- employee_profiles
  UPDATE public.employee_profiles SET
    dni_enc = CASE WHEN dni_enc IS NOT NULL
      THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(dni_enc, _old_key), _new_key, 'cipher-algo=aes256') END,
    ssn_enc = CASE WHEN ssn_enc IS NOT NULL
      THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(ssn_enc, _old_key), _new_key, 'cipher-algo=aes256') END,
    phone_enc = CASE WHEN phone_enc IS NOT NULL
      THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(phone_enc, _old_key), _new_key, 'cipher-algo=aes256') END,
    address_enc = CASE WHEN address_enc IS NOT NULL
      THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(address_enc, _old_key), _new_key, 'cipher-algo=aes256') END,
    date_of_birth_enc = CASE WHEN date_of_birth_enc IS NOT NULL
      THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(date_of_birth_enc, _old_key), _new_key, 'cipher-algo=aes256') END;
  GET DIAGNOSTICS v_ep = ROW_COUNT;

  -- accounts
  UPDATE public.accounts SET
    tax_id_enc = CASE WHEN tax_id_enc IS NOT NULL
      THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(tax_id_enc, _old_key), _new_key, 'cipher-algo=aes256') END,
    phone_enc = CASE WHEN phone_enc IS NOT NULL
      THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(phone_enc, _old_key), _new_key, 'cipher-algo=aes256') END,
    address_enc = CASE WHEN address_enc IS NOT NULL
      THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(address_enc, _old_key), _new_key, 'cipher-algo=aes256') END;
  GET DIAGNOSTICS v_ac = ROW_COUNT;

  RETURN json_build_object(
    'business_clients', v_bc,
    'client_contacts', v_cc,
    'employee_profiles', v_ep,
    'accounts', v_ac
  );
END;
$$;

-- Solo service_role puede invocar esto
REVOKE EXECUTE ON FUNCTION public.reencrypt_all_with_key(text, text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.reencrypt_all_with_key(text, text) TO service_role;