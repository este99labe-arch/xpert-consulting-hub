-- F1: optimización RLS — auth.uid() se evaluaba POR FILA en 155 políticas.
-- Se reescriben todas para usar (select auth.uid()) (InitPlan: una evaluación
-- por consulta). Mismo resultado, coste por fila eliminado. Idempotente.
DO $$
DECLARE r record; cmd text;
BEGIN
  FOR r IN
    SELECT policyname, tablename, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual IS NOT NULL AND qual LIKE '%auth.uid()%' AND qual NOT ILIKE '%select auth.uid()%')
        OR (with_check IS NOT NULL AND with_check LIKE '%auth.uid()%' AND with_check NOT ILIKE '%select auth.uid()%')
      )
  LOOP
    cmd := format('ALTER POLICY %I ON public.%I', r.policyname, r.tablename);
    IF r.qual IS NOT NULL THEN
      cmd := cmd || format(' USING (%s)', replace(r.qual, 'auth.uid()', '(select auth.uid())'));
    END IF;
    IF r.with_check IS NOT NULL THEN
      cmd := cmd || format(' WITH CHECK (%s)', replace(r.with_check, 'auth.uid()', '(select auth.uid())'));
    END IF;
    EXECUTE cmd;
  END LOOP;
END $$;
