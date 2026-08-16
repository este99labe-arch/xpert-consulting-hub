-- Las marcas las da de alta y de baja XpertConsulting, no el cliente.
--
-- Antes cualquier MANAGER podía crear y borrar marcas de su cuenta. Pasa a ser
-- una decisión comercial: se administra desde el Panel Admin. Al cliente le
-- queda la identidad de sus marcas —nombre, logotipo, color, plantilla y pie
-- legal—, que es su imagen y cambia a menudo, pero no qué marcas existen ni
-- qué módulos tiene cada una.
--
-- La asignación de personas y departamentos a marcas (user_brands,
-- department_brands) NO se toca: decidir quién ve qué es trabajo del día a día
-- del Manager, no una decisión comercial.

-- ── brands ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS brands_write ON public.brands;

-- El administrador de XpertConsulting manda sobre las marcas de cualquier
-- cuenta. Mismo patrón que accounts y account_modules.
CREATE POLICY brands_master_all ON public.brands FOR ALL
  USING (public.has_role(auth.uid(), 'MASTER_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'MASTER_ADMIN'));

-- El Manager del cliente solo modifica las marcas que ya tiene. Ni INSERT ni
-- DELETE: no puede inventarse marcas nuevas ni hacer desaparecer una.
CREATE POLICY brands_manager_update ON public.brands FOR UPDATE
  USING (account_id = public.get_user_account_id(auth.uid())
         AND public.has_role(auth.uid(), 'MANAGER'))
  WITH CHECK (account_id = public.get_user_account_id(auth.uid())
              AND public.has_role(auth.uid(), 'MANAGER'));

-- Las RLS no distinguen columnas, así que lo estructural se protege aquí.
-- Sin esto, un Manager podría desactivar una marca y borrarla de hecho, o
-- moverla a otra cuenta, saltándose la regla por la puerta de atrás.
CREATE OR REPLACE FUNCTION public._brands_guard_structural()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Sin sesión de usuario es el backend con clave de servicio (funciones
  -- edge, migraciones): ahí no hay nada que proteger.
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'MASTER_ADMIN') THEN
    RETURN NEW;
  END IF;

  IF NEW.account_id IS DISTINCT FROM OLD.account_id
     OR NEW.is_default IS DISTINCT FROM OLD.is_default
     OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION
      'Activar, desactivar o reasignar una marca corresponde a XpertConsulting'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_brands_guard_structural ON public.brands;
CREATE TRIGGER trg_brands_guard_structural
  BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public._brands_guard_structural();

-- ── brand_modules ─────────────────────────────────────────────────────────
-- Qué módulos tiene cada marca es lo que se vende. Solo lectura para el
-- cliente; el alta la hace XpertConsulting.
DROP POLICY IF EXISTS brand_modules_write ON public.brand_modules;

CREATE POLICY brand_modules_master_all ON public.brand_modules FOR ALL
  USING (public.has_role(auth.uid(), 'MASTER_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'MASTER_ADMIN'));
