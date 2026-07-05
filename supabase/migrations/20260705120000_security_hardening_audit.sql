-- Auditoría P0: endurecimiento de seguridad y rendimiento (aplicada 2026-07-05)
-- 1) Revocar ejecución pública de funciones internas (motor contable y triggers).
--    Cierra la posibilidad de invocar el motor de asientos vía /rest/v1/rpc/
--    desde cualquier sesión (manipulación entre cuentas).
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        '_acc_chart_id', '_acc_creator', '_acc_next_entry_number',
        '_acc_post_accrual', '_acc_post_collection', '_acc_resolver',
        'auto_journal_entry_from_invoice', 'auto_journal_entry_from_payment',
        'notify_chat_task_completed', 'rls_auto_enable',
        'accounts_encrypt_trigger', 'generate_invoice_number',
        'sync_client_account_to_business_clients',
        'verifactu_enforce_immutability', 'verifactu_protect_lines'
      )
  LOOP
    EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || fn.sig || ' FROM PUBLIC, anon, authenticated';
  END LOOP;
END $$;

-- 2) Índices en claves foráneas sin indexar (51 detectadas por el linter).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.connamespace = 'public'::regnamespace
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1]
      )
  LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (%I)',
      'idx_fk_' || replace(replace(r.tbl::text, '.', '_'), '"', '') || '_' || r.col,
      r.tbl, r.col);
  END LOOP;
END $$;
