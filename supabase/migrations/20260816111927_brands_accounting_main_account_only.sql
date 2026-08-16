-- La contabilidad se lleva entera desde la cuenta principal.
--
-- El libro es único para todas las marcas: los asientos no se filtran por
-- marca (solo la llevan como dimensión analítica). Ofrecer el módulo dentro
-- de una marca enseñaría la contabilidad completa de la cuenta desde lo que
-- pretende ser una identidad aparte, que es justo lo contrario del
-- aislamiento. Se impide en la base de datos y no solo ocultando el menú,
-- porque el menú es una sugerencia y esto es una regla.

DELETE FROM public.brand_modules bm
 USING public.brands b, public.service_modules sm
 WHERE bm.brand_id = b.id AND sm.id = bm.module_id
   AND NOT b.is_default AND sm.code = 'ACCOUNTING';

CREATE OR REPLACE FUNCTION public._brand_modules_reject_accounting()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.service_modules sm
              WHERE sm.id = NEW.module_id AND sm.code = 'ACCOUNTING')
     AND NOT EXISTS (SELECT 1 FROM public.brands b
                      WHERE b.id = NEW.brand_id AND b.is_default) THEN
    RAISE EXCEPTION 'La contabilidad se lleva desde la cuenta principal, no desde una marca'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_brand_modules_reject_accounting ON public.brand_modules;
CREATE TRIGGER trg_brand_modules_reject_accounting
  BEFORE INSERT OR UPDATE ON public.brand_modules
  FOR EACH ROW EXECUTE FUNCTION public._brand_modules_reject_accounting();
