
CREATE OR REPLACE FUNCTION public._install_encryption_key(_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sql text;
BEGIN
  IF _key IS NULL OR length(_key) < 16 THEN
    RAISE EXCEPTION 'Key too short';
  END IF;

  -- Build the function body with the key safely escaped as a SQL literal.
  v_sql :=
    'CREATE OR REPLACE FUNCTION public._get_encryption_key() ' ||
    'RETURNS text LANGUAGE sql IMMUTABLE SECURITY DEFINER ' ||
    'SET search_path = public, extensions ' ||
    'AS $body$ SELECT ' || quote_literal(_key) || '::text $body$;';

  EXECUTE v_sql;

  EXECUTE 'REVOKE EXECUTE ON FUNCTION public._get_encryption_key() FROM PUBLIC, anon, authenticated';
END;
$$;
