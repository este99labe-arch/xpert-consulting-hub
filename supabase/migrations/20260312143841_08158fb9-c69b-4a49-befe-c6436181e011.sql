
-- Add description column to invoices for quotes (and general use)
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS description text DEFAULT '';

-- Update auto_journal_entry_from_invoice to skip QUOTE type
CREATE OR REPLACE FUNCTION public.auto_journal_entry_from_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_entry_id uuid;
  v_client_account_id uuid;
  v_revenue_account_id uuid;
  v_vat_account_id uuid;
BEGIN
  -- Skip quotes - they don't generate journal entries
  IF NEW.type = 'QUOTE' THEN
    RETURN NEW;
  END IF;

  -- Delete existing auto-entry for this invoice (for updates)
  DELETE FROM public.journal_entries WHERE invoice_id = NEW.id;

  -- Find chart accounts for this tenant
  IF NEW.type = 'INVOICE' THEN
    SELECT id INTO v_client_account_id FROM public.chart_of_accounts WHERE account_id = NEW.account_id AND code = '430' LIMIT 1;
    SELECT id INTO v_revenue_account_id FROM public.chart_of_accounts WHERE account_id = NEW.account_id AND code = '700' LIMIT 1;
    SELECT id INTO v_vat_account_id FROM public.chart_of_accounts WHERE account_id = NEW.account_id AND code = '477' LIMIT 1;
  ELSE
    SELECT id INTO v_client_account_id FROM public.chart_of_accounts WHERE account_id = NEW.account_id AND code = '400' LIMIT 1;
    SELECT id INTO v_revenue_account_id FROM public.chart_of_accounts WHERE account_id = NEW.account_id AND code = '600' LIMIT 1;
    SELECT id INTO v_vat_account_id FROM public.chart_of_accounts WHERE account_id = NEW.account_id AND code = '472' LIMIT 1;
  END IF;

  IF v_client_account_id IS NULL OR v_revenue_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.journal_entries (account_id, date, description, invoice_id, status, created_by)
  VALUES (NEW.account_id, NEW.issue_date, COALESCE(NEW.invoice_number, '') || ' - ' || NEW.concept, NEW.id, 'POSTED', COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'))
  RETURNING id INTO v_entry_id;

  IF NEW.type = 'INVOICE' THEN
    INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
    VALUES (v_entry_id, v_client_account_id, NEW.amount_total, 0, 'Clientes');
    INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
    VALUES (v_entry_id, v_revenue_account_id, 0, NEW.amount_net, 'Ventas');
    IF v_vat_account_id IS NOT NULL AND NEW.amount_vat > 0 THEN
      INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
      VALUES (v_entry_id, v_vat_account_id, 0, NEW.amount_vat, 'IVA Repercutido');
    END IF;
  ELSE
    INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
    VALUES (v_entry_id, v_revenue_account_id, NEW.amount_net, 0, 'Compras');
    IF v_vat_account_id IS NOT NULL AND NEW.amount_vat > 0 THEN
      INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
      VALUES (v_entry_id, v_vat_account_id, NEW.amount_vat, 0, 'IVA Soportado');
    END IF;
    INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
    VALUES (v_entry_id, v_client_account_id, 0, NEW.amount_total, 'Proveedores');
  END IF;

  RETURN NEW;
END;
$function$;
