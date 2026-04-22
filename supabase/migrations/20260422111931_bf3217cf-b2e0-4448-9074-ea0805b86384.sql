CREATE OR REPLACE FUNCTION public._install_encryption_key(_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $outer$
BEGIN
  IF _key IS NULL OR length(_key) < 16 THEN
    RAISE EXCEPTION 'Key too short';
  END IF;

  EXECUTE format($f$
    CREATE OR REPLACE FUNCTION public._get_encryption_key()
    RETURNS text
    LANGUAGE sql
    IMMUTABLE
    SECURITY DEFINER
    SET search_path = public, extensions
    AS 'SELECT %L::text';
  $f$, _key);

  EXECUTE 'REVOKE EXECUTE ON FUNCTION public._get_encryption_key() FROM PUBLIC, authenticated, anon';
END;
$outer$;

REVOKE EXECUTE ON FUNCTION public._install_encryption_key(text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public._install_encryption_key(text) TO service_role;