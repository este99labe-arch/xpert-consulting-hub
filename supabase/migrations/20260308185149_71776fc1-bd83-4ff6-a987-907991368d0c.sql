
-- Add invoice_number column
ALTER TABLE public.invoices ADD COLUMN invoice_number text;

-- Create function to auto-generate sequential invoice numbers per account
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  prefix text;
  year_str text;
  next_seq int;
  new_number text;
BEGIN
  -- Determine prefix based on type
  IF NEW.type = 'INVOICE' THEN
    prefix := 'FAC';
  ELSE
    prefix := 'GAS';
  END IF;

  year_str := to_char(NEW.issue_date, 'YYYY');

  -- Get next sequence number for this account/type/year
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
$$;

-- Create trigger
CREATE TRIGGER trg_generate_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL)
  EXECUTE FUNCTION public.generate_invoice_number();

-- Backfill existing invoices that don't have a number
DO $$
DECLARE
  rec RECORD;
  prefix text;
  year_str text;
  seq int;
BEGIN
  FOR rec IN
    SELECT id, account_id, type, issue_date
    FROM public.invoices
    WHERE invoice_number IS NULL
    ORDER BY issue_date ASC, created_at ASC
  LOOP
    IF rec.type = 'INVOICE' THEN prefix := 'FAC'; ELSE prefix := 'GAS'; END IF;
    year_str := to_char(rec.issue_date, 'YYYY');

    SELECT COALESCE(MAX(
      CAST(NULLIF(split_part(invoice_number, '-', 3), '') AS int)
    ), 0) + 1
    INTO seq
    FROM public.invoices
    WHERE account_id = rec.account_id
      AND type = rec.type
      AND invoice_number LIKE prefix || '-' || year_str || '-%';

    UPDATE public.invoices
    SET invoice_number = prefix || '-' || year_str || '-' || LPAD(seq::text, 4, '0')
    WHERE id = rec.id;
  END LOOP;
END $$;
