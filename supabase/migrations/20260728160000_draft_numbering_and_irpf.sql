-- 1) NUMERACIÓN: los borradores dejan de consumir números de la serie fiscal.
--
-- Al numerar en el INSERT, un borrador reservaba un FAC y, si se borraba,
-- dejaba un HUECO en la serie (de hecho ya faltaba el FAC-2026-0001). La
-- normativa exige serie correlativa y sin huecos.
--
-- Los borradores usan serie provisional (BORR facturas / BGAS gastos) y el
-- número definitivo se asigna al EMITIRSE, al salir de borrador. Se asigna en
-- la emisión y no en el cobro porque la factura que se entrega al cliente debe
-- llevar ya su número definitivo, y VERI*FACTU impide renumerar una factura
-- ya registrada. Los presupuestos (PRE) no cambian: no son fiscales.

CREATE OR REPLACE FUNCTION public._invoice_prefix(_type text, _status text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _type = 'QUOTE' THEN 'PRE'
    WHEN _status = 'DRAFT' AND _type = 'INVOICE' THEN 'BORR'
    WHEN _status = 'DRAFT' AND _type = 'EXPENSE' THEN 'BGAS'
    WHEN _type = 'INVOICE' THEN 'FAC'
    ELSE 'GAS'
  END
$function$;

CREATE OR REPLACE FUNCTION public._next_invoice_number(_account uuid, _prefix text, _date date)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  year_str text := to_char(_date, 'YYYY');
  next_seq int;
BEGIN
  SELECT COALESCE(MAX(CAST(NULLIF(split_part(invoice_number, '-', 3), '') AS int)), 0) + 1
    INTO next_seq FROM public.invoices
   WHERE account_id = _account AND invoice_number LIKE _prefix || '-' || year_str || '-%';
  RETURN _prefix || '-' || year_str || '-' || LPAD(next_seq::text, 4, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := public._next_invoice_number(
      NEW.account_id, public._invoice_prefix(NEW.type, NEW.status), NEW.issue_date);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_final_invoice_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_prefix text;
BEGIN
  IF OLD.status = 'DRAFT' AND NEW.status <> 'DRAFT'
     AND (NEW.invoice_number LIKE 'BORR-%' OR NEW.invoice_number LIKE 'BGAS-%') THEN
    v_prefix := public._invoice_prefix(NEW.type, NEW.status);
    NEW.invoice_number := public._next_invoice_number(NEW.account_id, v_prefix, NEW.issue_date);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_assign_final_invoice_number ON public.invoices;
CREATE TRIGGER trg_assign_final_invoice_number
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.assign_final_invoice_number();

-- Pasa los borradores existentes a la serie provisional. Las facturas YA
-- EMITIDAS no se tocan: renumerar un documento entregado no es válido.
WITH borradores AS (
  SELECT i.id, public._invoice_prefix(i.type, i.status) AS nuevo_prefijo,
         to_char(i.issue_date, 'YYYY') AS anio,
         ROW_NUMBER() OVER (
           PARTITION BY i.account_id, public._invoice_prefix(i.type, i.status), to_char(i.issue_date,'YYYY')
           ORDER BY i.created_at, i.invoice_number) AS seq
    FROM public.invoices i
   WHERE i.status = 'DRAFT' AND i.type <> 'QUOTE'
     AND i.invoice_number NOT LIKE 'BORR-%' AND i.invoice_number NOT LIKE 'BGAS-%'
)
UPDATE public.invoices i
   SET invoice_number = b.nuevo_prefijo || '-' || b.anio || '-' || LPAD(b.seq::text, 4, '0')
  FROM borradores b WHERE i.id = b.id;

-- 2) IRPF por defecto del cliente, junto al IVA que ya existía.
ALTER TABLE public.business_clients
  ADD COLUMN IF NOT EXISTS default_irpf_percentage numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.business_clients.default_irpf_percentage IS
  'Retención de IRPF aplicada por defecto al facturar a este cliente (0 = sin retención).';
