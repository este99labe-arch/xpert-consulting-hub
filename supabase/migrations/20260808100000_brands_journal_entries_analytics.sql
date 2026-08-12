-- Fase 6: contabilidad analítica por marca.
--
-- El asiento hereda la marca de su factura. Se hace con un disparador y NO
-- modificando _acc_post_accrual / _acc_post_collection: son el motor contable,
-- el código más delicado del sistema, y tocarlos para rellenar una columna
-- informativa sería asumir un riesgo que no hace falta. Así además queda
-- cubierto cualquier otro camino que cree un asiento ligado a una factura,
-- incluido el alta manual desde la interfaz.
--
-- brand_id aquí es una DIMENSIÓN ANALÍTICA, no una frontera de seguridad: el
-- libro sigue siendo único y las RLS de contabilidad no miran la marca. Sirve
-- para desglosar la cuenta de resultados, no para ocultar apuntes.

CREATE OR REPLACE FUNCTION public._acc_set_entry_brand()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.brand_id IS NULL AND NEW.invoice_id IS NOT NULL THEN
    SELECT i.brand_id INTO NEW.brand_id
    FROM public.invoices i WHERE i.id = NEW.invoice_id;
  END IF;

  -- Sin factura de la que heredar (asiento manual), se atribuye a la marca
  -- principal para que ningún apunte quede fuera del desglose.
  IF NEW.brand_id IS NULL THEN
    SELECT b.id INTO NEW.brand_id
    FROM public.brands b
    WHERE b.account_id = NEW.account_id AND b.is_default;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_acc_set_entry_brand ON public.journal_entries;
CREATE TRIGGER trg_acc_set_entry_brand
  BEFORE INSERT OR UPDATE OF invoice_id ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public._acc_set_entry_brand();

-- Reatribuir los asientos existentes: en la Fase 0 todos fueron a la marca
-- principal, pero los que vienen de una factura deben seguir a la suya.
UPDATE public.journal_entries je
   SET brand_id = i.brand_id
  FROM public.invoices i
 WHERE i.id = je.invoice_id
   AND i.brand_id IS NOT NULL
   AND je.brand_id IS DISTINCT FROM i.brand_id;
