-- Toda cuenta nace con su marca principal.
--
-- La Fase 0 rellenó las cuentas existentes, pero el alta de una cuenta nueva
-- no creaba nada: quedaba sin marca principal y, al no haber dónde caer, las
-- facturas y los asientos se quedaban sin atribuir. La marca principal ES la
-- cuenta —mismo nombre, misma identidad—; las demás son las que se añaden
-- luego desde el Panel Admin.

CREATE OR REPLACE FUNCTION public._accounts_create_default_brand()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.brands (account_id, name, is_default, is_active, sort_order)
  VALUES (NEW.id, NEW.name, true, true, 0)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_accounts_create_default_brand ON public.accounts;
CREATE TRIGGER trg_accounts_create_default_brand
  AFTER INSERT ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public._accounts_create_default_brand();


-- Los módulos de la cuenta se contratan DESPUÉS de crearla, así que la marca
-- principal no puede recibirlos en el alta: los va heredando según se activan.
-- Y al retirar un módulo de la cuenta se retira de todas sus marcas, porque
-- una marca no puede ofrecer lo que la cuenta ya no tiene.
CREATE OR REPLACE FUNCTION public._account_modules_sync_brands()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_default uuid;
BEGIN
  IF TG_OP = 'DELETE' OR NOT NEW.is_enabled THEN
    DELETE FROM public.brand_modules bm
     USING public.brands b
     WHERE bm.brand_id = b.id
       AND b.account_id = COALESCE(OLD.account_id, NEW.account_id)
       AND bm.module_id = COALESCE(OLD.module_id, NEW.module_id);
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT id INTO v_default FROM public.brands
   WHERE account_id = NEW.account_id AND is_default;

  IF v_default IS NOT NULL THEN
    INSERT INTO public.brand_modules (account_id, brand_id, module_id, is_enabled)
    VALUES (NEW.account_id, v_default, NEW.module_id, true)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_account_modules_sync_brands ON public.account_modules;
CREATE TRIGGER trg_account_modules_sync_brands
  AFTER INSERT OR UPDATE OF is_enabled OR DELETE ON public.account_modules
  FOR EACH ROW EXECUTE FUNCTION public._account_modules_sync_brands();
