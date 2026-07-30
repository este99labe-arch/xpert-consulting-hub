-- ============================================================================
-- FASE 0 — Múltiples líneas de negocio (verticales) por cliente
-- ============================================================================
-- Añade capas NUEVAS sin modificar el modelo existente. Tras esta migración la
-- aplicación se comporta exactamente igual: las tablas nacen vacías y nada las
-- consulta todavía.
--
-- Modelo:
--   verticals  →  services  →  client_services (contrataciones)
--   accounts.client_id  →  business_clients   (1 cliente : N cuentas ERP)
--
-- Decisiones:
--  * Ámbito por cuenta (account_id): cada cuenta gestiona sus propias verticales
--    y servicios desde la UI, siguiendo el patrón multi-tenant del resto del ERP.
--  * account_modules/service_modules NO se tocan: son módulos DEL SOFTWARE y
--    siguen siendo los que controlan accesos. Los servicios son la relación
--    COMERCIAL. Mantenerlos independientes evita que dar de baja un servicio
--    deje a un usuario sin acceso.
--  * client_plans se conserva intacta (está vacía); se valorará retirarla al final.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

-- ---------------------------------------------------------------- VERTICALES
CREATE TABLE IF NOT EXISTS public.verticals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  color       text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT verticals_name_unique_per_account UNIQUE (account_id, name)
);

-- ---------------------------------------------------------------- SERVICIOS
CREATE TABLE IF NOT EXISTS public.services (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  vertical_id    uuid NOT NULL REFERENCES public.verticals(id) ON DELETE RESTRICT,
  name           text NOT NULL,
  description    text,
  price          numeric(12,2) NOT NULL DEFAULT 0,
  billing_period text NOT NULL DEFAULT 'MONTHLY'
                 CHECK (billing_period IN ('MONTHLY','QUARTERLY','YEARLY','ONE_OFF')),
  sort_order     integer NOT NULL DEFAULT 0,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT services_name_unique_per_vertical UNIQUE (account_id, vertical_id, name)
);

-- ----------------------------------------------------------- CONTRATACIONES
CREATE TABLE IF NOT EXISTS public.client_services (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES public.business_clients(id) ON DELETE CASCADE,
  service_id  uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  vertical_id uuid NOT NULL REFERENCES public.verticals(id) ON DELETE RESTRICT,
  status      text NOT NULL DEFAULT 'ACTIVE'
              CHECK (status IN ('ACTIVE','PAUSED','CANCELLED')),
  start_date  date NOT NULL DEFAULT CURRENT_DATE,
  end_date    date,
  price       numeric(12,2),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_services_dates_ok CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Deriva la vertical del servicio y valida que servicio y cliente son de la
-- misma cuenta (evita contrataciones cruzadas entre inquilinos).
CREATE OR REPLACE FUNCTION public.client_services_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_svc RECORD; v_client_account uuid;
BEGIN
  SELECT s.vertical_id, s.account_id INTO v_svc
    FROM public.services s WHERE s.id = NEW.service_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'El servicio no existe'; END IF;

  SELECT bc.account_id INTO v_client_account
    FROM public.business_clients bc WHERE bc.id = NEW.client_id;

  IF v_svc.account_id IS DISTINCT FROM v_client_account THEN
    RAISE EXCEPTION 'El servicio y el cliente pertenecen a cuentas distintas';
  END IF;

  NEW.vertical_id := v_svc.vertical_id;
  NEW.account_id  := v_client_account;
  NEW.updated_at  := now();
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.client_services_validate() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_client_services_validate ON public.client_services;
CREATE TRIGGER trg_client_services_validate
  BEFORE INSERT OR UPDATE ON public.client_services
  FOR EACH ROW EXECUTE FUNCTION public.client_services_validate();

DROP TRIGGER IF EXISTS trg_verticals_updated ON public.verticals;
CREATE TRIGGER trg_verticals_updated BEFORE UPDATE ON public.verticals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_services_updated ON public.services;
CREATE TRIGGER trg_services_updated BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_verticals_account ON public.verticals(account_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_services_account ON public.services(account_id, vertical_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_client_services_client ON public.client_services(client_id, status);
CREATE INDEX IF NOT EXISTS idx_client_services_service ON public.client_services(service_id);

-- ---------------------------------------------------------------------- RLS
ALTER TABLE public.verticals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own account verticals" ON public.verticals;
CREATE POLICY "Users can view own account verticals" ON public.verticals FOR SELECT
  USING (account_id = public.get_user_account_id((SELECT auth.uid())));

DROP POLICY IF EXISTS "Master admins can view all verticals" ON public.verticals;
CREATE POLICY "Master admins can view all verticals" ON public.verticals FOR SELECT
  USING (public.has_role((SELECT auth.uid()), 'MASTER_ADMIN'));

DROP POLICY IF EXISTS "Managers can manage own account verticals" ON public.verticals;
CREATE POLICY "Managers can manage own account verticals" ON public.verticals FOR ALL
  USING (account_id = public.get_user_account_id((SELECT auth.uid()))
         AND (public.has_role((SELECT auth.uid()), 'MANAGER') OR public.has_role((SELECT auth.uid()), 'MASTER_ADMIN')))
  WITH CHECK (account_id = public.get_user_account_id((SELECT auth.uid()))
         AND (public.has_role((SELECT auth.uid()), 'MANAGER') OR public.has_role((SELECT auth.uid()), 'MASTER_ADMIN')));

DROP POLICY IF EXISTS "Users can view own account services" ON public.services;
CREATE POLICY "Users can view own account services" ON public.services FOR SELECT
  USING (account_id = public.get_user_account_id((SELECT auth.uid())));

DROP POLICY IF EXISTS "Master admins can view all services" ON public.services;
CREATE POLICY "Master admins can view all services" ON public.services FOR SELECT
  USING (public.has_role((SELECT auth.uid()), 'MASTER_ADMIN'));

DROP POLICY IF EXISTS "Managers can manage own account services" ON public.services;
CREATE POLICY "Managers can manage own account services" ON public.services FOR ALL
  USING (account_id = public.get_user_account_id((SELECT auth.uid()))
         AND (public.has_role((SELECT auth.uid()), 'MANAGER') OR public.has_role((SELECT auth.uid()), 'MASTER_ADMIN')))
  WITH CHECK (account_id = public.get_user_account_id((SELECT auth.uid()))
         AND (public.has_role((SELECT auth.uid()), 'MANAGER') OR public.has_role((SELECT auth.uid()), 'MASTER_ADMIN')));

DROP POLICY IF EXISTS "Users can view own account client_services" ON public.client_services;
CREATE POLICY "Users can view own account client_services" ON public.client_services FOR SELECT
  USING (account_id = public.get_user_account_id((SELECT auth.uid())));

DROP POLICY IF EXISTS "Master admins can view all client_services" ON public.client_services;
CREATE POLICY "Master admins can view all client_services" ON public.client_services FOR SELECT
  USING (public.has_role((SELECT auth.uid()), 'MASTER_ADMIN'));

DROP POLICY IF EXISTS "Managers can manage own account client_services" ON public.client_services;
CREATE POLICY "Managers can manage own account client_services" ON public.client_services FOR ALL
  USING (account_id = public.get_user_account_id((SELECT auth.uid()))
         AND (public.has_role((SELECT auth.uid()), 'MANAGER') OR public.has_role((SELECT auth.uid()), 'MASTER_ADMIN')))
  WITH CHECK (account_id = public.get_user_account_id((SELECT auth.uid()))
         AND (public.has_role((SELECT auth.uid()), 'MANAGER') OR public.has_role((SELECT auth.uid()), 'MASTER_ADMIN')));

-- ------------------------------------------------- ENLACE CUENTA ERP ↔ CLIENTE
-- Hasta ahora el enlace era implícito y POR NOMBRE (trigger de sync y
-- create_client_account), lo que impedía que un cliente tuviera varias cuentas.
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.business_clients(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.accounts.client_id IS
  'Cliente (business_clients) al que pertenece esta cuenta ERP. Un cliente puede tener varias cuentas.';

CREATE INDEX IF NOT EXISTS idx_accounts_client ON public.accounts(client_id);

-- Backfill con el mismo criterio que usa hoy el código (nombre).
UPDATE public.accounts a
   SET client_id = bc.id
  FROM public.business_clients bc
  JOIN public.accounts m ON m.id = bc.account_id AND m.type = 'MASTER'
 WHERE a.type = 'CLIENT'
   AND a.client_id IS NULL
   AND bc.name = a.name;
