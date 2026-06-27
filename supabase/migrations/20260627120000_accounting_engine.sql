-- ============================================================================
-- Motor contable automatizado y personalizable (PGC PYMES)
--  - Criterio de devengo (por defecto) o caja, configurable por empresa
--  - Asientos correctos por evento: emisión (devengo) + cobro/pago
--  - IRPF contabilizado (asientos cuadrados) y cuentas por categoría
-- ============================================================================

-- 1. Plan contable: cuentas adicionales necesarias para retenciones e IVA -----
INSERT INTO public.chart_of_accounts (account_id, code, name, type, is_active)
SELECT a.id, c.code, c.name, c.type, true
FROM public.accounts a
CROSS JOIN (VALUES
  ('623', 'Servicios de profesionales independientes', 'EXPENSE'),
  ('473', 'H.P. retenciones y pagos a cuenta',         'ASSET'),
  ('4751','H.P. acreedora por retenciones practicadas', 'LIABILITY'),
  ('4750','H.P. acreedora por IVA',                     'LIABILITY'),
  ('4700','H.P. deudora por IVA',                       'ASSET')
) AS c(code, name, type)
WHERE NOT EXISTS (
  SELECT 1 FROM public.chart_of_accounts x
  WHERE x.account_id = a.id AND x.code = c.code
);

-- 2. Configuración contable por empresa (account_settings) --------------------
ALTER TABLE public.account_settings
  ADD COLUMN IF NOT EXISTS accounting_method      text    NOT NULL DEFAULT 'ACCRUAL',
  ADD COLUMN IF NOT EXISTS accounting_auto_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS acc_customers          text    NOT NULL DEFAULT '430',
  ADD COLUMN IF NOT EXISTS acc_suppliers          text    NOT NULL DEFAULT '400',
  ADD COLUMN IF NOT EXISTS acc_treasury           text    NOT NULL DEFAULT '572',
  ADD COLUMN IF NOT EXISTS acc_vat_output         text    NOT NULL DEFAULT '477',
  ADD COLUMN IF NOT EXISTS acc_vat_input          text    NOT NULL DEFAULT '472',
  ADD COLUMN IF NOT EXISTS acc_irpf_receivable    text    NOT NULL DEFAULT '473',
  ADD COLUMN IF NOT EXISTS acc_irpf_payable       text    NOT NULL DEFAULT '4751',
  ADD COLUMN IF NOT EXISTS acc_sales_default      text    NOT NULL DEFAULT '705',
  ADD COLUMN IF NOT EXISTS acc_expense_default    text    NOT NULL DEFAULT '629';

ALTER TABLE public.account_settings
  DROP CONSTRAINT IF EXISTS account_settings_accounting_method_chk;
ALTER TABLE public.account_settings
  ADD CONSTRAINT account_settings_accounting_method_chk
  CHECK (accounting_method IN ('ACCRUAL','CASH'));

-- 3. Categorías contables (mapeo categoría -> cuenta) -------------------------
CREATE TABLE IF NOT EXISTS public.accounting_categories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('INCOME','EXPENSE')),
  name         text NOT NULL,
  account_code text NOT NULL,
  is_default   boolean NOT NULL DEFAULT false,
  sort_order   int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounting_categories_account
  ON public.accounting_categories(account_id, kind);

ALTER TABLE public.accounting_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own account categories" ON public.accounting_categories;
CREATE POLICY "Users can view own account categories"
  ON public.accounting_categories FOR SELECT
  USING (account_id = public.get_user_account_id(auth.uid()));

DROP POLICY IF EXISTS "Master admins can view all categories" ON public.accounting_categories;
CREATE POLICY "Master admins can view all categories"
  ON public.accounting_categories FOR SELECT
  USING (public.has_role(auth.uid(), 'MASTER_ADMIN'));

DROP POLICY IF EXISTS "Managers can manage own account categories" ON public.accounting_categories;
CREATE POLICY "Managers can manage own account categories"
  ON public.accounting_categories FOR ALL
  USING (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN')))
  WITH CHECK (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN')));

-- Seed default categories for every existing account --------------------------
INSERT INTO public.accounting_categories (account_id, kind, name, account_code, is_default, sort_order)
SELECT a.id, c.kind, c.name, c.account_code, c.is_default, c.sort_order
FROM public.accounts a
CROSS JOIN (VALUES
  ('INCOME',  'Prestación de servicios', '705', true,  1),
  ('INCOME',  'Venta de productos',      '700', false, 2),
  ('INCOME',  'Otros ingresos',          '759', false, 3),
  ('EXPENSE', 'Servicios profesionales', '623', true,  1),
  ('EXPENSE', 'Compras de mercaderías',  '600', false, 2),
  ('EXPENSE', 'Arrendamientos',          '621', false, 3),
  ('EXPENSE', 'Suministros',             '628', false, 4),
  ('EXPENSE', 'Seguros',                 '625', false, 5),
  ('EXPENSE', 'Otros servicios',         '629', false, 6)
) AS c(kind, name, account_code, is_default, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories x WHERE x.account_id = a.id
);

-- 4. Factura: categoría contable ---------------------------------------------
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.accounting_categories(id) ON DELETE SET NULL;

-- 5. Asientos: metadatos de origen y enlace a cobro/pago ---------------------
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS source     text NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS entry_kind text,
  ADD COLUMN IF NOT EXISTS payment_id uuid;

-- ============================================================================
-- Helpers
-- ============================================================================
CREATE OR REPLACE FUNCTION public._acc_chart_id(p_account uuid, p_code text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id FROM public.chart_of_accounts
  WHERE account_id = p_account AND code = p_code
  ORDER BY is_active DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public._acc_next_entry_number(p_account uuid, p_date date)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT to_char(p_date,'YYYY') || '/' || lpad((
    1 + COALESCE((SELECT count(*) FROM public.journal_entries je
                  WHERE je.account_id = p_account
                    AND date_part('year', je.date) = date_part('year', p_date)), 0)
  )::text, 5, '0');
$$;

CREATE OR REPLACE FUNCTION public._acc_resolver(p_account uuid)
RETURNS TABLE(method text, cust text, supp text, treas text, vatout text, vatin text,
              irpfr text, irpfp text, salesd text, expd text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(s.accounting_method,'ACCRUAL'),
         COALESCE(s.acc_customers,'430'),       COALESCE(s.acc_suppliers,'400'),
         COALESCE(s.acc_treasury,'572'),        COALESCE(s.acc_vat_output,'477'),
         COALESCE(s.acc_vat_input,'472'),       COALESCE(s.acc_irpf_receivable,'473'),
         COALESCE(s.acc_irpf_payable,'4751'),   COALESCE(s.acc_sales_default,'705'),
         COALESCE(s.acc_expense_default,'629')
  FROM (SELECT p_account AS aid) b
  LEFT JOIN public.account_settings s ON s.account_id = b.aid;
$$;

CREATE OR REPLACE FUNCTION public._acc_creator(p_account uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(
    auth.uid(),
    (SELECT ua.user_id FROM public.user_accounts ua
      WHERE ua.account_id = p_account AND ua.is_active = true LIMIT 1),
    '00000000-0000-0000-0000-000000000000'::uuid);
$$;

-- ============================================================================
-- Asiento de devengo (emisión de factura / registro de gasto)
-- ============================================================================
CREATE OR REPLACE FUNCTION public._acc_post_accrual(p_invoice uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  inv public.invoices%ROWTYPE;
  r record;
  v_entry uuid; v_by uuid;
  v_main_code text; v_main uuid;
  v_cust uuid; v_supp uuid; v_vatout uuid; v_vatin uuid; v_irpfr uuid; v_irpfp uuid;
BEGIN
  SELECT * INTO inv FROM public.invoices WHERE id = p_invoice;
  IF NOT FOUND THEN RETURN; END IF;

  DELETE FROM public.journal_entries
   WHERE invoice_id = p_invoice AND source='AUTO' AND entry_kind='ACCRUAL';

  SELECT * INTO r FROM public._acc_resolver(inv.account_id);

  -- cuenta de ingreso/gasto: por categoría si existe, si no el valor por defecto
  IF inv.category_id IS NOT NULL THEN
    SELECT account_code INTO v_main_code FROM public.accounting_categories WHERE id = inv.category_id;
  END IF;
  IF inv.type = 'INVOICE' THEN
    v_main_code := COALESCE(v_main_code, r.salesd);
  ELSE
    v_main_code := COALESCE(v_main_code, r.expd);
  END IF;

  v_main   := public._acc_chart_id(inv.account_id, v_main_code);
  v_cust   := public._acc_chart_id(inv.account_id, r.cust);
  v_supp   := public._acc_chart_id(inv.account_id, r.supp);
  v_vatout := public._acc_chart_id(inv.account_id, r.vatout);
  v_vatin  := public._acc_chart_id(inv.account_id, r.vatin);
  v_irpfr  := public._acc_chart_id(inv.account_id, r.irpfr);
  v_irpfp  := public._acc_chart_id(inv.account_id, r.irpfp);

  IF v_main IS NULL OR (inv.type='INVOICE' AND v_cust IS NULL) OR (inv.type<>'INVOICE' AND v_supp IS NULL) THEN
    RETURN; -- faltan cuentas, no se contabiliza
  END IF;

  v_by := public._acc_creator(inv.account_id);

  INSERT INTO public.journal_entries
    (account_id, entry_number, date, description, invoice_id, status, created_by, source, entry_kind)
  VALUES
    (inv.account_id, public._acc_next_entry_number(inv.account_id, inv.issue_date),
     inv.issue_date, COALESCE(inv.invoice_number,'') || ' · ' || COALESCE(inv.concept,''),
     inv.id, 'POSTED', v_by, 'AUTO', 'ACCRUAL')
  RETURNING id INTO v_entry;

  IF inv.type = 'INVOICE' THEN
    INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
    VALUES (v_entry, v_cust, inv.amount_total, 0, 'Clientes');
    IF COALESCE(inv.irpf_amount,0) > 0 AND v_irpfr IS NOT NULL THEN
      INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
      VALUES (v_entry, v_irpfr, inv.irpf_amount, 0, 'H.P. retenciones soportadas');
    END IF;
    INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
    VALUES (v_entry, v_main, 0, inv.amount_net, 'Ingresos por ventas/servicios');
    IF COALESCE(inv.amount_vat,0) > 0 AND v_vatout IS NOT NULL THEN
      INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
      VALUES (v_entry, v_vatout, 0, inv.amount_vat, 'IVA repercutido');
    END IF;
  ELSE
    INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
    VALUES (v_entry, v_main, inv.amount_net, 0, 'Gasto / compra');
    IF COALESCE(inv.amount_vat,0) > 0 AND v_vatin IS NOT NULL THEN
      INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
      VALUES (v_entry, v_vatin, inv.amount_vat, 0, 'IVA soportado');
    END IF;
    INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
    VALUES (v_entry, v_supp, 0, inv.amount_total, 'Proveedores / acreedores');
    IF COALESCE(inv.irpf_amount,0) > 0 AND v_irpfp IS NOT NULL THEN
      INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
      VALUES (v_entry, v_irpfp, 0, inv.irpf_amount, 'H.P. retenciones practicadas');
    END IF;
  END IF;
END;
$$;

-- ============================================================================
-- Asiento de cobro / pago (devengo) o de reconocimiento (caja)
-- ============================================================================
CREATE OR REPLACE FUNCTION public._acc_post_collection(
  p_invoice uuid, p_amount numeric, p_date date, p_payment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  inv public.invoices%ROWTYPE;
  r record;
  v_entry uuid; v_by uuid; v_frac numeric;
  v_main_code text; v_main uuid;
  v_cust uuid; v_supp uuid; v_treas uuid; v_vatout uuid; v_vatin uuid; v_irpfr uuid; v_irpfp uuid;
  v_net numeric; v_vat numeric; v_irpf numeric;
BEGIN
  SELECT * INTO inv FROM public.invoices WHERE id = p_invoice;
  IF NOT FOUND OR COALESCE(p_amount,0) = 0 THEN RETURN; END IF;

  DELETE FROM public.journal_entries
   WHERE invoice_id = p_invoice AND source='AUTO' AND entry_kind='SETTLEMENT'
     AND payment_id IS NOT DISTINCT FROM p_payment_id;

  SELECT * INTO r FROM public._acc_resolver(inv.account_id);
  v_treas := public._acc_chart_id(inv.account_id, r.treas);
  v_cust  := public._acc_chart_id(inv.account_id, r.cust);
  v_supp  := public._acc_chart_id(inv.account_id, r.supp);
  IF v_treas IS NULL THEN RETURN; END IF;

  v_by := public._acc_creator(inv.account_id);

  INSERT INTO public.journal_entries
    (account_id, entry_number, date, description, invoice_id, status, created_by, source, entry_kind, payment_id)
  VALUES
    (inv.account_id, public._acc_next_entry_number(inv.account_id, p_date), p_date,
     CASE WHEN inv.type='INVOICE' THEN 'Cobro ' ELSE 'Pago ' END || COALESCE(inv.invoice_number, inv.concept, ''),
     inv.id, 'POSTED', v_by, 'AUTO', 'SETTLEMENT', p_payment_id)
  RETURNING id INTO v_entry;

  IF r.method = 'ACCRUAL' THEN
    -- Cobro/pago: mueve tesorería contra cliente/proveedor
    IF inv.type = 'INVOICE' THEN
      INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
      VALUES (v_entry, v_treas, p_amount, 0, 'Cobro cliente'),
             (v_entry, v_cust, 0, p_amount, 'Clientes');
    ELSE
      INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
      VALUES (v_entry, v_supp, p_amount, 0, 'Proveedores'),
             (v_entry, v_treas, 0, p_amount, 'Pago proveedor');
    END IF;
  ELSE
    -- Criterio de caja: reconoce ingreso/gasto + IVA proporcional al cobro
    v_frac := CASE WHEN inv.amount_total <> 0 THEN p_amount / inv.amount_total ELSE 1 END;
    v_net  := round(COALESCE(inv.amount_net,0)  * v_frac, 2);
    v_vat  := round(COALESCE(inv.amount_vat,0)  * v_frac, 2);
    v_irpf := round(COALESCE(inv.irpf_amount,0) * v_frac, 2);

    IF inv.category_id IS NOT NULL THEN
      SELECT account_code INTO v_main_code FROM public.accounting_categories WHERE id = inv.category_id;
    END IF;
    v_main_code := COALESCE(v_main_code, CASE WHEN inv.type='INVOICE' THEN r.salesd ELSE r.expd END);
    v_main   := public._acc_chart_id(inv.account_id, v_main_code);
    v_vatout := public._acc_chart_id(inv.account_id, r.vatout);
    v_vatin  := public._acc_chart_id(inv.account_id, r.vatin);
    v_irpfr  := public._acc_chart_id(inv.account_id, r.irpfr);
    v_irpfp  := public._acc_chart_id(inv.account_id, r.irpfp);

    IF inv.type = 'INVOICE' THEN
      INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
      VALUES (v_entry, v_treas, p_amount, 0, 'Cobro cliente');
      IF v_irpf > 0 AND v_irpfr IS NOT NULL THEN
        INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
        VALUES (v_entry, v_irpfr, v_irpf, 0, 'H.P. retenciones soportadas');
      END IF;
      INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
      VALUES (v_entry, v_main, 0, v_net, 'Ingresos por ventas/servicios');
      IF v_vat > 0 AND v_vatout IS NOT NULL THEN
        INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
        VALUES (v_entry, v_vatout, 0, v_vat, 'IVA repercutido');
      END IF;
    ELSE
      INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
      VALUES (v_entry, v_main, v_net, 0, 'Gasto / compra');
      IF v_vat > 0 AND v_vatin IS NOT NULL THEN
        INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
        VALUES (v_entry, v_vatin, v_vat, 0, 'IVA soportado');
      END IF;
      INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
      VALUES (v_entry, v_treas, 0, p_amount, 'Pago proveedor');
      IF v_irpf > 0 AND v_irpfp IS NOT NULL THEN
        INSERT INTO public.journal_entry_lines (entry_id, chart_account_id, debit, credit, description)
        VALUES (v_entry, v_irpfp, 0, v_irpf, 'H.P. retenciones practicadas');
      END IF;
    END IF;
  END IF;
END;
$$;

-- ============================================================================
-- Trigger principal sobre facturas
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auto_journal_entry_from_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_auto_client boolean;
  v_auto_global boolean;
  v_method text;
  v_has_payments boolean;
  v_post_accrual boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.journal_entries WHERE invoice_id = OLD.id AND source = 'AUTO';
    RETURN OLD;
  END IF;

  IF NEW.type = 'QUOTE' THEN RETURN NEW; END IF;

  SELECT COALESCE(bc.auto_journal_entry, true) INTO v_auto_client
  FROM public.business_clients bc WHERE bc.id = NEW.client_id;
  v_auto_client := COALESCE(v_auto_client, true);

  SELECT COALESCE(accounting_auto_enabled, true), COALESCE(accounting_method,'ACCRUAL')
  INTO v_auto_global, v_method
  FROM public.account_settings WHERE account_id = NEW.account_id;
  v_auto_global := COALESCE(v_auto_global, true);
  v_method := COALESCE(v_method, 'ACCRUAL');

  IF v_auto_client = false OR v_auto_global = false THEN
    DELETE FROM public.journal_entries WHERE invoice_id = NEW.id AND source = 'AUTO';
    RETURN NEW;
  END IF;

  -- ¿Procede asiento de devengo?
  v_post_accrual := (v_method = 'ACCRUAL') AND (
      (NEW.type = 'INVOICE' AND NEW.status NOT IN ('DRAFT','CANCELLED'))
   OR (NEW.type = 'EXPENSE' AND NEW.status <> 'CANCELLED'));

  IF v_post_accrual THEN
    PERFORM public._acc_post_accrual(NEW.id);
  ELSE
    DELETE FROM public.journal_entries
     WHERE invoice_id = NEW.id AND source='AUTO' AND entry_kind='ACCRUAL';
  END IF;

  -- Cobro/pago de respaldo cuando se marca PAID sin registrar pagos parciales
  SELECT EXISTS(SELECT 1 FROM public.invoice_payments WHERE invoice_id = NEW.id) INTO v_has_payments;

  IF NEW.status = 'PAID' AND v_has_payments = false THEN
    PERFORM public._acc_post_collection(
      NEW.id, NEW.amount_total, COALESCE(NEW.paid_at::date, NEW.issue_date), NULL);
  ELSE
    DELETE FROM public.journal_entries
     WHERE invoice_id = NEW.id AND source='AUTO' AND entry_kind='SETTLEMENT' AND payment_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_journal_entry ON public.invoices;
CREATE TRIGGER trg_auto_journal_entry
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.auto_journal_entry_from_invoice();

-- ============================================================================
-- Trigger sobre cobros/pagos (invoice_payments)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auto_journal_entry_from_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_invoice uuid;
  v_account uuid;
  v_auto_global boolean;
BEGIN
  v_invoice := CASE WHEN TG_OP='DELETE' THEN OLD.invoice_id ELSE NEW.invoice_id END;
  v_account := CASE WHEN TG_OP='DELETE' THEN OLD.account_id ELSE NEW.account_id END;

  SELECT COALESCE(accounting_auto_enabled, true) INTO v_auto_global
  FROM public.account_settings WHERE account_id = v_account;
  v_auto_global := COALESCE(v_auto_global, true);

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.journal_entries
     WHERE invoice_id = OLD.invoice_id AND source='AUTO' AND entry_kind='SETTLEMENT'
       AND payment_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Existen pagos explícitos: elimina el cobro de respaldo (payment_id NULL)
  DELETE FROM public.journal_entries
   WHERE invoice_id = NEW.invoice_id AND source='AUTO' AND entry_kind='SETTLEMENT'
     AND payment_id IS NULL;

  IF v_auto_global = false THEN
    DELETE FROM public.journal_entries
     WHERE invoice_id = NEW.invoice_id AND source='AUTO' AND entry_kind='SETTLEMENT' AND payment_id = NEW.id;
    RETURN NEW;
  END IF;

  PERFORM public._acc_post_collection(NEW.invoice_id, NEW.amount, NEW.payment_date, NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_journal_payment ON public.invoice_payments;
CREATE TRIGGER trg_auto_journal_payment
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.auto_journal_entry_from_payment();
