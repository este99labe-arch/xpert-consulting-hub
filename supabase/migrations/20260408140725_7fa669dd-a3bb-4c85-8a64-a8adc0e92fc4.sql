
-- Fix: use a real user_id from the account instead of auth.uid() fallback to zero UUID
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
  v_auto_journal boolean;
  v_created_by uuid;
BEGIN
  -- Skip quotes
  IF NEW.type = 'QUOTE' THEN
    RETURN NEW;
  END IF;

  -- Check per-client auto_journal_entry setting
  SELECT COALESCE(bc.auto_journal_entry, true)
  INTO v_auto_journal
  FROM public.business_clients bc
  WHERE bc.id = NEW.client_id;

  -- Only generate journal entries when status is PAID and client allows it
  IF NEW.status <> 'PAID' OR v_auto_journal = false THEN
    IF TG_OP = 'UPDATE' AND OLD.status = 'PAID' THEN
      DELETE FROM public.journal_entries WHERE invoice_id = NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  -- Resolve created_by: prefer auth.uid(), fallback to an active user of the account
  v_created_by := auth.uid();
  IF v_created_by IS NULL THEN
    SELECT ua.user_id INTO v_created_by
    FROM public.user_accounts ua
    WHERE ua.account_id = NEW.account_id AND ua.is_active = true
    LIMIT 1;
  END IF;
  -- Ultimate fallback (should never happen if account has users)
  IF v_created_by IS NULL THEN
    v_created_by := '00000000-0000-0000-0000-000000000000'::uuid;
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
  VALUES (NEW.account_id, NEW.issue_date, COALESCE(NEW.invoice_number, '') || ' - ' || NEW.concept, NEW.id, 'POSTED', v_created_by)
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
