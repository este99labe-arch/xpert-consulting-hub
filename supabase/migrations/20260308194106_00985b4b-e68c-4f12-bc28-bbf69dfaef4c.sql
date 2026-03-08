
-- 1. chart_of_accounts
CREATE TABLE public.chart_of_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL, -- ASSET, LIABILITY, EQUITY, INCOME, EXPENSE
  parent_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, code)
);

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account chart" ON public.chart_of_accounts
  FOR SELECT USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Master admins can view all chart" ON public.chart_of_accounts
  FOR SELECT USING (has_role(auth.uid(), 'MASTER_ADMIN'));

CREATE POLICY "Managers can manage own account chart" ON public.chart_of_accounts
  FOR ALL USING (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
  );

-- 2. journal_entries
CREATE TABLE public.journal_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  entry_number text,
  date date NOT NULL,
  description text NOT NULL DEFAULT '',
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'DRAFT', -- DRAFT, POSTED
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account entries" ON public.journal_entries
  FOR SELECT USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Master admins can view all entries" ON public.journal_entries
  FOR SELECT USING (has_role(auth.uid(), 'MASTER_ADMIN'));

CREATE POLICY "Managers can manage own account entries" ON public.journal_entries
  FOR ALL USING (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
  );

-- 3. journal_entry_lines
CREATE TABLE public.journal_entry_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  chart_account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id),
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT ''
);

ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

-- RLS for lines: join through journal_entries
CREATE POLICY "Users can view own account entry lines" ON public.journal_entry_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.id = entry_id AND je.account_id = get_user_account_id(auth.uid())
    )
  );

CREATE POLICY "Master admins can view all entry lines" ON public.journal_entry_lines
  FOR SELECT USING (has_role(auth.uid(), 'MASTER_ADMIN'));

CREATE POLICY "Managers can manage own account entry lines" ON public.journal_entry_lines
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.id = entry_id
        AND je.account_id = get_user_account_id(auth.uid())
        AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
    )
  );

-- 4. Auto-generate entry_number trigger
CREATE OR REPLACE FUNCTION public.generate_entry_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  year_str text;
  next_seq int;
BEGIN
  year_str := to_char(NEW.date, 'YYYY');
  SELECT COALESCE(MAX(
    CAST(NULLIF(split_part(entry_number, '-', 2), '') AS int)
  ), 0) + 1
  INTO next_seq
  FROM public.journal_entries
  WHERE account_id = NEW.account_id
    AND entry_number LIKE 'AST-' || '%' || '-' || year_str;

  -- Simpler: AST-0001-2026
  SELECT COALESCE(MAX(
    CAST(NULLIF(split_part(entry_number, '-', 2), '') AS int)
  ), 0) + 1
  INTO next_seq
  FROM public.journal_entries
  WHERE account_id = NEW.account_id
    AND entry_number LIKE '%-' || year_str;

  NEW.entry_number := 'AST-' || LPAD(next_seq::text, 4, '0') || '-' || year_str;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_entry_number
  BEFORE INSERT ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_entry_number();

-- 5. Auto-create journal entry from invoice
CREATE OR REPLACE FUNCTION public.auto_journal_entry_from_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_entry_id uuid;
  v_client_account_id uuid; -- chart_of_accounts id for 430/400
  v_revenue_account_id uuid; -- 700 or 600
  v_vat_account_id uuid; -- 477 or 472
BEGIN
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

  -- If chart accounts not seeded yet, skip
  IF v_client_account_id IS NULL OR v_revenue_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Create journal entry
  INSERT INTO public.journal_entries (account_id, date, description, invoice_id, status, created_by)
  VALUES (NEW.account_id, NEW.issue_date, COALESCE(NEW.invoice_number, '') || ' - ' || NEW.concept, NEW.id, 'POSTED', COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'))
  RETURNING id INTO v_entry_id;

  -- Create lines based on type
  IF NEW.type = 'INVOICE' THEN
    -- Debit: 430 Clientes (total)
    INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
    VALUES (v_entry_id, v_client_account_id, NEW.amount_total, 0, 'Clientes');
    -- Credit: 700 Ventas (net)
    INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
    VALUES (v_entry_id, v_revenue_account_id, 0, NEW.amount_net, 'Ventas');
    -- Credit: 477 IVA Repercutido (vat)
    IF v_vat_account_id IS NOT NULL AND NEW.amount_vat > 0 THEN
      INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
      VALUES (v_entry_id, v_vat_account_id, 0, NEW.amount_vat, 'IVA Repercutido');
    END IF;
  ELSE
    -- Debit: 600 Compras (net)
    INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
    VALUES (v_entry_id, v_revenue_account_id, NEW.amount_net, 0, 'Compras');
    -- Debit: 472 IVA Soportado (vat)
    IF v_vat_account_id IS NOT NULL AND NEW.amount_vat > 0 THEN
      INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
      VALUES (v_entry_id, v_vat_account_id, NEW.amount_vat, 0, 'IVA Soportado');
    END IF;
    -- Credit: 400 Proveedores (total)
    INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
    VALUES (v_entry_id, v_client_account_id, 0, NEW.amount_total, 'Proveedores');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_journal_entry
  AFTER INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_journal_entry_from_invoice();

-- 6. Insert ACCOUNTING module if not exists
INSERT INTO public.service_modules (code, name, description)
VALUES ('ACCOUNTING', 'Contabilidad', 'Módulo de contabilidad con plan de cuentas, asientos, libro mayor e informes fiscales')
ON CONFLICT DO NOTHING;
