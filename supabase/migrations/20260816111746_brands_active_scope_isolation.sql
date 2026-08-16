-- Aislamiento real: dentro de una marca solo se ve lo de esa marca.
--
-- Hasta ahora las políticas preguntaban "¿puedo acceder a esta marca?"
-- (can_access_brand), que para un MANAGER es siempre sí. Faltaba la otra
-- pregunta: "¿en qué marca estoy trabajando ahora?". Sin ella, cambiar de
-- marca solo cambiaba el rótulo del panel.
--
-- Se resuelve en la base de datos y no en las consultas del cliente para que
-- valga para TODA la aplicación —incluidas las pantallas que aún no existen—
-- y para que un fallo al filtrar en el navegador no enseñe datos de otra
-- marca.

-- La marca principal ES la cuenta: estar en ella significa verlo todo, así
-- que no filtra. Por eso devuelve NULL cuando la activa es la principal.
CREATE OR REPLACE FUNCTION public.active_brand_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT uab.brand_id
    FROM public.user_active_brand uab
    JOIN public.brands b ON b.id = uab.brand_id
   WHERE uab.user_id = auth.uid()
     AND b.is_active
     AND NOT b.is_default;
$function$;

-- Permiso Y foco. Dentro de una marca, las filas sin marca tampoco se ven:
-- son de la cuenta, y la marca debe parecer una cuenta independiente.
CREATE OR REPLACE FUNCTION public.brand_in_scope(_brand uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN public.active_brand_id() IS NULL THEN public.can_access_brand(_brand)
    ELSE _brand = public.active_brand_id()
  END;
$function$;

-- Reescribir en bloque las políticas que ya miraban la marca. Se hace por
-- sustitución sobre la expresión existente en vez de redactarlas de nuevo:
-- son 27 y copiarlas a mano es donde se cuelan los errores.
DO $$
DECLARE r record; q text; c text;
BEGIN
  FOR r IN
    SELECT tablename, policyname, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (qual LIKE '%can_access_brand%' OR with_check LIKE '%can_access_brand%')
  LOOP
    q := replace(r.qual, 'can_access_brand(', 'brand_in_scope(');
    c := replace(r.with_check, 'can_access_brand(', 'brand_in_scope(');
    IF r.qual IS NOT NULL AND r.with_check IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)',
                     r.policyname, r.tablename, q, c);
    ELSIF r.qual IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)', r.policyname, r.tablename, q);
    ELSE
      EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)', r.policyname, r.tablename, c);
    END IF;
  END LOOP;
END $$;

-- Las políticas SELECT se combinan con OR, así que un "el master lo ve todo"
-- sin condición de marca deja el aislamiento en nada justo para quien más lo
-- usa. Se les añade el foco. Contabilidad NO entra: se lleva entera desde la
-- cuenta principal y debe seguir viéndose completa.
ALTER POLICY "Master admins can view all products" ON public.products
  USING (public.has_role(auth.uid(), 'MASTER_ADMIN') AND public.brand_in_scope(brand_id));

ALTER POLICY "Master admins can view all orders" ON public.purchase_orders
  USING (public.has_role(auth.uid(), 'MASTER_ADMIN') AND public.brand_in_scope(brand_id));

ALTER POLICY "Master admins can manage all xred profiles" ON public.xred_profiles
  USING (public.has_role(auth.uid(), 'MASTER_ADMIN') AND public.brand_in_scope(brand_id))
  WITH CHECK (public.has_role(auth.uid(), 'MASTER_ADMIN') AND public.brand_in_scope(brand_id));
