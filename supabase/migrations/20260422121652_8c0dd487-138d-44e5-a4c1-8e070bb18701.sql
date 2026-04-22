
CREATE OR REPLACE FUNCTION public._install_encryption_key(_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_db text;
BEGIN
  IF _key IS NULL OR length(_key) < 16 THEN
    RAISE EXCEPTION 'Key too short';
  END IF;

  SELECT current_database() INTO v_db;

  -- Persist key as a database-level GUC (properly quoted via format %L)
  EXECUTE format('ALTER DATABASE %I SET app.encryption_key = %L', v_db, _key);

  -- Apply to current session immediately so re-encryption / reads work right away
  PERFORM set_config('app.encryption_key', _key, false);

  -- Restore the dynamic key reader (in case a previous version hard-coded it)
  CREATE OR REPLACE FUNCTION public._get_encryption_key()
  RETURNS text
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = public, extensions
  AS $f$
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
  $f$;

  REVOKE EXECUTE ON FUNCTION public._get_encryption_key() FROM PUBLIC, anon, authenticated;
END;
$$;
