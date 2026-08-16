-- Lo que se crea dentro de una marca nace con esa marca.
--
-- Antes solo dos diálogos —clientes y facturas— rellenaban brand_id a mano.
-- Todo lo demás nacía sin marca, y ahora que las políticas filtran por la
-- marca activa, eso significa crear algo y verlo desaparecer al instante.
--
-- Se hace con un disparador por tabla y no en el cliente porque el requisito
-- es que valga para toda la aplicación: cualquier pantalla, cualquier
-- importación y cualquier función edge quedan cubiertas sin acordarse de
-- nada. En la vista de cuenta principal, lo nuevo cae en la marca principal.

CREATE OR REPLACE FUNCTION public._set_brand_from_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.brand_id IS NULL THEN
    NEW.brand_id := COALESCE(
      public.active_brand_id(),
      (SELECT b.id FROM public.brands b
        WHERE b.account_id = NEW.account_id AND b.is_default)
    );
  END IF;
  RETURN NEW;
END;
$function$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'business_clients', 'invoices', 'products', 'purchase_orders',
    'recurring_invoices', 'reminders', 'task_boards', 'chat_conversations',
    'xred_profiles', 'document_folders'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_brand_from_context ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_brand_from_context BEFORE INSERT ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public._set_brand_from_context()', t);
  END LOOP;
END $$;
