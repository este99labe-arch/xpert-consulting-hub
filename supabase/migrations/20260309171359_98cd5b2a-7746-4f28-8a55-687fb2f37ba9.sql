
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  prefix text;
  year_str text;
  next_seq int;
  new_number text;
BEGIN
  IF NEW.type = 'INVOICE' THEN
    prefix := 'FAC';
  ELSIF NEW.type = 'QUOTE' THEN
    prefix := 'PRE';
  ELSE
    prefix := 'GAS';
  END IF;

  year_str := to_char(NEW.issue_date, 'YYYY');

  SELECT COALESCE(MAX(
    CAST(
      NULLIF(split_part(invoice_number, '-', 3), '') AS int
    )
  ), 0) + 1
  INTO next_seq
  FROM public.invoices
  WHERE account_id = NEW.account_id
    AND type = NEW.type
    AND invoice_number LIKE prefix || '-' || year_str || '-%';

  new_number := prefix || '-' || year_str || '-' || LPAD(next_seq::text, 4, '0');
  NEW.invoice_number := new_number;

  RETURN NEW;
END;
$function$;
