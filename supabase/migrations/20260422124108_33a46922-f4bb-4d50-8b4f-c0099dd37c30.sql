CREATE OR REPLACE FUNCTION public.reencrypt_all_with_key(_old_key text, _new_key text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  r record;
  v_plain text;
  v_bc_ok int := 0; v_bc_err int := 0;
  v_cc_ok int := 0; v_cc_err int := 0;
  v_ep_ok int := 0; v_ep_err int := 0;
  v_ac_ok int := 0; v_ac_err int := 0;
  v_sample_ok boolean := false;
BEGIN
  -- Sanity: validate old key against an existing sample before mutating anything
  BEGIN
    SELECT extensions.pgp_sym_decrypt(tax_id_enc, _old_key) INTO v_plain
    FROM public.business_clients WHERE tax_id_enc IS NOT NULL LIMIT 1;
    v_sample_ok := true;
  EXCEPTION WHEN OTHERS THEN v_sample_ok := false;
  END;

  IF NOT v_sample_ok THEN
    BEGIN
      SELECT extensions.pgp_sym_decrypt(tax_id_enc, _old_key) INTO v_plain
      FROM public.accounts WHERE tax_id_enc IS NOT NULL LIMIT 1;
      v_sample_ok := true;
    EXCEPTION WHEN OTHERS THEN v_sample_ok := false;
    END;
  END IF;

  IF NOT v_sample_ok THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Old key does not match existing encrypted data. Aborting to prevent data loss.'
    );
  END IF;

  -- business_clients (per-row to isolate failures)
  FOR r IN SELECT id, tax_id_enc, email_enc, phone_enc, address_enc, billing_address_enc
           FROM public.business_clients
  LOOP
    BEGIN
      UPDATE public.business_clients SET
        tax_id_enc = CASE WHEN r.tax_id_enc IS NOT NULL
          THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(r.tax_id_enc, _old_key), _new_key, 'cipher-algo=aes256') END,
        email_enc = CASE WHEN r.email_enc IS NOT NULL
          THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(r.email_enc, _old_key), _new_key, 'cipher-algo=aes256') END,
        phone_enc = CASE WHEN r.phone_enc IS NOT NULL
          THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(r.phone_enc, _old_key), _new_key, 'cipher-algo=aes256') END,
        address_enc = CASE WHEN r.address_enc IS NOT NULL
          THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(r.address_enc, _old_key), _new_key, 'cipher-algo=aes256') END,
        billing_address_enc = CASE WHEN r.billing_address_enc IS NOT NULL
          THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(r.billing_address_enc, _old_key), _new_key, 'cipher-algo=aes256') END
      WHERE id = r.id;
      v_bc_ok := v_bc_ok + 1;
    EXCEPTION WHEN OTHERS THEN v_bc_err := v_bc_err + 1;
    END;
  END LOOP;

  -- client_contacts
  FOR r IN SELECT id, email_enc, phone_enc FROM public.client_contacts LOOP
    BEGIN
      UPDATE public.client_contacts SET
        email_enc = CASE WHEN r.email_enc IS NOT NULL
          THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(r.email_enc, _old_key), _new_key, 'cipher-algo=aes256') END,
        phone_enc = CASE WHEN r.phone_enc IS NOT NULL
          THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(r.phone_enc, _old_key), _new_key, 'cipher-algo=aes256') END
      WHERE id = r.id;
      v_cc_ok := v_cc_ok + 1;
    EXCEPTION WHEN OTHERS THEN v_cc_err := v_cc_err + 1;
    END;
  END LOOP;

  -- employee_profiles
  FOR r IN SELECT id, dni_enc, ssn_enc, phone_enc, address_enc, date_of_birth_enc
           FROM public.employee_profiles
  LOOP
    BEGIN
      UPDATE public.employee_profiles SET
        dni_enc = CASE WHEN r.dni_enc IS NOT NULL
          THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(r.dni_enc, _old_key), _new_key, 'cipher-algo=aes256') END,
        ssn_enc = CASE WHEN r.ssn_enc IS NOT NULL
          THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(r.ssn_enc, _old_key), _new_key, 'cipher-algo=aes256') END,
        phone_enc = CASE WHEN r.phone_enc IS NOT NULL
          THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(r.phone_enc, _old_key), _new_key, 'cipher-algo=aes256') END,
        address_enc = CASE WHEN r.address_enc IS NOT NULL
          THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(r.address_enc, _old_key), _new_key, 'cipher-algo=aes256') END,
        date_of_birth_enc = CASE WHEN r.date_of_birth_enc IS NOT NULL
          THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(r.date_of_birth_enc, _old_key), _new_key, 'cipher-algo=aes256') END
      WHERE id = r.id;
      v_ep_ok := v_ep_ok + 1;
    EXCEPTION WHEN OTHERS THEN v_ep_err := v_ep_err + 1;
    END;
  END LOOP;

  -- accounts
  FOR r IN SELECT id, tax_id_enc, phone_enc, address_enc FROM public.accounts LOOP
    BEGIN
      UPDATE public.accounts SET
        tax_id_enc = CASE WHEN r.tax_id_enc IS NOT NULL
          THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(r.tax_id_enc, _old_key), _new_key, 'cipher-algo=aes256') END,
        phone_enc = CASE WHEN r.phone_enc IS NOT NULL
          THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(r.phone_enc, _old_key), _new_key, 'cipher-algo=aes256') END,
        address_enc = CASE WHEN r.address_enc IS NOT NULL
          THEN extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(r.address_enc, _old_key), _new_key, 'cipher-algo=aes256') END
      WHERE id = r.id;
      v_ac_ok := v_ac_ok + 1;
    EXCEPTION WHEN OTHERS THEN v_ac_err := v_ac_err + 1;
    END;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'business_clients', json_build_object('ok', v_bc_ok, 'err', v_bc_err),
    'client_contacts', json_build_object('ok', v_cc_ok, 'err', v_cc_err),
    'employee_profiles', json_build_object('ok', v_ep_ok, 'err', v_ep_err),
    'accounts', json_build_object('ok', v_ac_ok, 'err', v_ac_err)
  );
END;
$function$;