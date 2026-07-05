-- ============================================================
-- F2: modelo de datos profesional (aplicada 2026-07-05)
-- ============================================================

-- 1) CUENTAS: ficha completa de empresa cliente ---------------
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS legal_name    text,
  ADD COLUMN IF NOT EXISTS country       text NOT NULL DEFAULT 'ES',
  ADD COLUMN IF NOT EXISTS province      text,
  ADD COLUMN IF NOT EXISTS timezone      text NOT NULL DEFAULT 'Europe/Madrid',
  ADD COLUMN IF NOT EXISTS language      text NOT NULL DEFAULT 'es',
  ADD COLUMN IF NOT EXISTS plan_code     text NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN IF NOT EXISTS website       text,
  ADD COLUMN IF NOT EXISTS logo_url      text,
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS contact_name  text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS suspended_at  timestamptz;

UPDATE public.accounts SET legal_name = name WHERE legal_name IS NULL;

-- 2) NUEVAS ENTIDADES: departamentos y centros de trabajo -----
CREATE TABLE IF NOT EXISTS public.departments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, name)
);
CREATE TABLE IF NOT EXISTS public.work_centers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name       text NOT NULL,
  address    text,
  city       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, name)
);
CREATE INDEX IF NOT EXISTS idx_fk_departments_account ON public.departments(account_id);
CREATE INDEX IF NOT EXISTS idx_fk_work_centers_account ON public.work_centers(account_id);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dept_select" ON public.departments FOR SELECT
  USING (account_id = public.get_user_account_id((select auth.uid())));
CREATE POLICY "dept_manage" ON public.departments FOR ALL
  USING (account_id = public.get_user_account_id((select auth.uid()))
         AND (public.has_role((select auth.uid()),'MANAGER') OR public.has_role((select auth.uid()),'MASTER_ADMIN')))
  WITH CHECK (account_id = public.get_user_account_id((select auth.uid()))
         AND (public.has_role((select auth.uid()),'MANAGER') OR public.has_role((select auth.uid()),'MASTER_ADMIN')));
CREATE POLICY "wc_select" ON public.work_centers FOR SELECT
  USING (account_id = public.get_user_account_id((select auth.uid())));
CREATE POLICY "wc_manage" ON public.work_centers FOR ALL
  USING (account_id = public.get_user_account_id((select auth.uid()))
         AND (public.has_role((select auth.uid()),'MANAGER') OR public.has_role((select auth.uid()),'MASTER_ADMIN')))
  WITH CHECK (account_id = public.get_user_account_id((select auth.uid()))
         AND (public.has_role((select auth.uid()),'MANAGER') OR public.has_role((select auth.uid()),'MASTER_ADMIN')));

-- 3) EMPLEADOS: ficha laboral completa ------------------------
ALTER TABLE public.employee_profiles
  ADD COLUMN IF NOT EXISTS end_date        date,
  ADD COLUMN IF NOT EXISTS status          text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ON_LEAVE','TERMINATED')),
  ADD COLUMN IF NOT EXISTS contract_type   text CHECK (contract_type IN ('INDEFINIDO','TEMPORAL','PRACTICAS','BECA','AUTONOMO','OTRO')),
  ADD COLUMN IF NOT EXISTS weekly_hours    numeric(5,2),
  ADD COLUMN IF NOT EXISTS manager_user_id uuid,
  ADD COLUMN IF NOT EXISTS department_id   uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS work_center_id  uuid REFERENCES public.work_centers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS corporate_email text,
  ADD COLUMN IF NOT EXISTS iban            text,
  ADD COLUMN IF NOT EXISTS salary          numeric(12,2),
  ADD COLUMN IF NOT EXISTS vacation_days_override int,
  ADD COLUMN IF NOT EXISTS notes           text;

CREATE INDEX IF NOT EXISTS idx_fk_employee_profiles_department ON public.employee_profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_fk_employee_profiles_work_center ON public.employee_profiles(work_center_id);

-- Normalización automática: el texto libre "department" crea/enlaza la entidad
CREATE OR REPLACE FUNCTION public.sync_employee_department()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_dept uuid;
BEGIN
  IF NEW.department IS NOT NULL AND trim(NEW.department) <> '' THEN
    SELECT id INTO v_dept FROM public.departments
     WHERE account_id = NEW.account_id AND lower(name) = lower(trim(NEW.department)) LIMIT 1;
    IF v_dept IS NULL THEN
      INSERT INTO public.departments (account_id, name) VALUES (NEW.account_id, trim(NEW.department))
      RETURNING id INTO v_dept;
    END IF;
    NEW.department_id := v_dept;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.sync_employee_department() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_employee_department ON public.employee_profiles;
CREATE TRIGGER trg_sync_employee_department
  BEFORE INSERT OR UPDATE OF department ON public.employee_profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_employee_department();

-- Backfill: departamentos existentes (texto) -> entidad
INSERT INTO public.departments (account_id, name)
SELECT DISTINCT account_id, trim(department)
FROM public.employee_profiles
WHERE department IS NOT NULL AND trim(department) <> ''
ON CONFLICT (account_id, name) DO NOTHING;

UPDATE public.employee_profiles ep
SET department_id = d.id
FROM public.departments d
WHERE d.account_id = ep.account_id
  AND lower(d.name) = lower(trim(ep.department))
  AND ep.department_id IS NULL;

-- 4) FACTURAS: vencimiento real, forma de pago y rectificativas
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS due_date            date,
  ADD COLUMN IF NOT EXISTS payment_method      text CHECK (payment_method IN ('TRANSFER','DIRECT_DEBIT','CARD','CASH','OTHER')),
  ADD COLUMN IF NOT EXISTS rectifies_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(account_id, due_date);
CREATE INDEX IF NOT EXISTS idx_fk_invoices_rectifies ON public.invoices(rectifies_invoice_id);

UPDATE public.invoices SET due_date = issue_date + 30
WHERE due_date IS NULL AND type = 'INVOICE';

-- 5) WHATSAPP: secreto por cuenta + tokens ilegibles desde el cliente
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS app_secret text;

REVOKE SELECT ON public.whatsapp_config FROM anon, authenticated;
GRANT SELECT (id, account_id, phone_number_id, verify_token, is_enabled,
              created_at, updated_at, waba_id, display_phone, bot_enabled,
              welcome_message, fallback_message, task_ack_message,
              task_completed_template, default_assignee)
  ON public.whatsapp_config TO authenticated;
