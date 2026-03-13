
-- Add new columns to business_clients
ALTER TABLE public.business_clients
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'España',
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS billing_city text,
  ADD COLUMN IF NOT EXISTS billing_postal_code text,
  ADD COLUMN IF NOT EXISTS billing_country text,
  ADD COLUMN IF NOT EXISTS default_vat_percentage numeric DEFAULT 21,
  ADD COLUMN IF NOT EXISTS auto_journal_entry boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS plan_id uuid;

-- Client contacts table
CREATE TABLE IF NOT EXISTS public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.business_clients(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  position text,
  is_primary boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can manage account client contacts"
  ON public.client_contacts FOR ALL
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
  );

CREATE POLICY "Users can view account client contacts"
  ON public.client_contacts FOR SELECT
  TO authenticated
  USING (account_id = get_user_account_id(auth.uid()));

-- Client plans table
CREATE TABLE IF NOT EXISTS public.client_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  description text,
  features text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can manage account client plans"
  ON public.client_plans FOR ALL
  TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
  );

CREATE POLICY "Users can view account client plans"
  ON public.client_plans FOR SELECT
  TO authenticated
  USING (account_id = get_user_account_id(auth.uid()));

-- Add FK for plan_id
ALTER TABLE public.business_clients
  ADD CONSTRAINT business_clients_plan_id_fkey
  FOREIGN KEY (plan_id) REFERENCES public.client_plans(id) ON DELETE SET NULL;

-- Update the auto journal entry trigger to respect per-client config
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
    -- If updating away from PAID, delete existing auto-entry
    IF TG_OP = 'UPDATE' AND OLD.status = 'PAID' THEN
      DELETE FROM public.journal_entries WHERE invoice_id = NEW.id;
    END IF;
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
