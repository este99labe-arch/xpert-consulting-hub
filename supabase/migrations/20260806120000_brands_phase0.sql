-- ============================================================
-- Marcas — Fase 0: esquema y migración de datos
--
-- Una cuenta pasa a poder tener varias MARCAS comerciales. Todas facturan
-- bajo el mismo NIF y la misma serie de numeración —el emisor fiscal sigue
-- siendo la cuenta—; lo que aporta la marca es identidad comercial (nombre,
-- logotipo, plantilla) y una frontera de visibilidad entre equipos.
--
-- Esta fase NO cambia ningún comportamiento: añade tablas, añade brand_id
-- como NULLABLE y rellena lo existente con la marca por defecto. Las RLS se
-- tocan en la Fase 5; hasta entonces `can_access_brand()` existe pero no la
-- usa nadie, y un brand_id nulo es visible para todos a propósito, para que
-- nada se rompa mientras la interfaz aún no lo asigna.
-- ============================================================

-- ─── 1. Marcas ──────────────────────────────────────────────
CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,                     -- nombre comercial, el que ve el cliente
  logo_url text,
  color text,                             -- para distinguirla de un vistazo en la UI
  invoice_template text NOT NULL DEFAULT 'classic',
  invoice_template_options jsonb NOT NULL DEFAULT '{}'::jsonb,
  legal_footer text,                      -- texto opcional al pie de sus facturas
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  -- La marca de la matriz. No se borra y recoge lo que no tenga marca propia.
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX brands_one_default_per_account
  ON public.brands (account_id) WHERE is_default;
CREATE INDEX idx_brands_account ON public.brands (account_id);

-- ─── 2. Quién ve qué marca ──────────────────────────────────
-- Asignación directa por usuario.
CREATE TABLE public.user_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, brand_id)
);
CREATE INDEX idx_user_brands_user ON public.user_brands (user_id);

-- Asignación por departamento: al entrar alguien en el departamento hereda
-- sus marcas, sin tener que acordarse de asignárselas una a una.
CREATE TABLE public.department_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, brand_id)
);
CREATE INDEX idx_department_brands_dept ON public.department_brands (department_id);

-- ─── 3. Módulos por marca ───────────────────────────────────
-- Calcado de account_modules. Una marca SIN filas aquí es solo identidad de
-- facturación: no aparece en el conmutador porque no tiene nada que enseñar.
CREATE TABLE public.brand_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.service_modules(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT true,
  UNIQUE (brand_id, module_id)
);
CREATE INDEX idx_brand_modules_brand ON public.brand_modules (brand_id);

-- ─── 4. Marca activa en sesión ──────────────────────────────
-- Mismo patrón que user_active_account. NULL = vista de la cuenta completa.
CREATE TABLE public.user_active_brand (
  user_id uuid PRIMARY KEY,
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── 5. brand_id en las entidades raíz ──────────────────────
-- Solo en las raíces: las filas hijas (líneas de factura, mensajes de chat,
-- movimientos de stock...) heredan la marca de su padre. Duplicar la columna
-- en las hijas invitaría a que se desincronizaran.
ALTER TABLE public.business_clients    ADD COLUMN brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;
ALTER TABLE public.invoices            ADD COLUMN brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;
ALTER TABLE public.recurring_invoices  ADD COLUMN brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;
ALTER TABLE public.chat_conversations  ADD COLUMN brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;
ALTER TABLE public.reminders           ADD COLUMN brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;
ALTER TABLE public.task_boards         ADD COLUMN brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;
ALTER TABLE public.products            ADD COLUMN brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_orders     ADD COLUMN brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;
ALTER TABLE public.xred_profiles       ADD COLUMN brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;
ALTER TABLE public.document_folders    ADD COLUMN brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;

-- Contabilidad: el libro es ÚNICO y no se aísla por marca. brand_id aquí es
-- una dimensión analítica, para poder sacar la cuenta de resultados por marca
-- sin partir la contabilidad.
ALTER TABLE public.journal_entries     ADD COLUMN brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;

CREATE INDEX idx_business_clients_brand   ON public.business_clients (brand_id);
CREATE INDEX idx_invoices_brand           ON public.invoices (brand_id);
CREATE INDEX idx_recurring_invoices_brand ON public.recurring_invoices (brand_id);
CREATE INDEX idx_chat_conversations_brand ON public.chat_conversations (brand_id);
CREATE INDEX idx_reminders_brand          ON public.reminders (brand_id);
CREATE INDEX idx_task_boards_brand        ON public.task_boards (brand_id);
CREATE INDEX idx_products_brand           ON public.products (brand_id);
CREATE INDEX idx_purchase_orders_brand    ON public.purchase_orders (brand_id);
CREATE INDEX idx_xred_profiles_brand      ON public.xred_profiles (brand_id);
CREATE INDEX idx_document_folders_brand   ON public.document_folders (brand_id);
CREATE INDEX idx_journal_entries_brand    ON public.journal_entries (brand_id);

-- ─── 6. Marca por defecto y relleno de lo existente ─────────
-- Cada cuenta recibe su marca principal, que hereda la plantilla que ya tenía
-- configurada para no cambiar el aspecto de ninguna factura.
INSERT INTO public.brands (account_id, name, invoice_template, invoice_template_options, is_default, sort_order)
SELECT a.id,
       a.name,
       COALESCE(s.invoice_template, 'classic'),
       COALESCE(s.invoice_template_options, '{}'::jsonb),
       true,
       0
FROM public.accounts a
LEFT JOIN public.account_settings s ON s.account_id = a.id;

-- Todo lo que existe pasa a la marca principal de su cuenta.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'business_clients','invoices','recurring_invoices','chat_conversations',
    'reminders','task_boards','products','purchase_orders','xred_profiles',
    'document_folders','journal_entries'
  ] LOOP
    EXECUTE format($f$
      UPDATE public.%I x
         SET brand_id = b.id
        FROM public.brands b
       WHERE b.account_id = x.account_id
         AND b.is_default
         AND x.brand_id IS NULL
    $f$, t);
  END LOOP;
END $$;

-- El MANAGER de cada cuenta queda asignado a su marca principal. El resto de
-- usuarios se asignan desde la interfaz en la Fase 2.
INSERT INTO public.user_brands (account_id, user_id, brand_id)
SELECT ua.account_id, ua.user_id, b.id
FROM public.user_accounts ua
JOIN public.roles r ON r.id = ua.role_id
JOIN public.brands b ON b.account_id = ua.account_id AND b.is_default
WHERE ua.is_active AND r.code IN ('MANAGER', 'MASTER_ADMIN')
ON CONFLICT (user_id, brand_id) DO NOTHING;

-- La marca principal hereda los módulos ya contratados por la cuenta.
INSERT INTO public.brand_modules (account_id, brand_id, module_id, is_enabled)
SELECT am.account_id, b.id, am.module_id, am.is_enabled
FROM public.account_modules am
JOIN public.brands b ON b.account_id = am.account_id AND b.is_default
ON CONFLICT (brand_id, module_id) DO NOTHING;

-- ─── 7. ¿Puede este usuario ver esta marca? ─────────────────
-- La regla vive AQUÍ y en ningún otro sitio: en la Fase 5 las ~80 políticas
-- afectadas llamarán a esta función, así que un cambio de criterio se hace en
-- un lugar y no en ochenta.
CREATE OR REPLACE FUNCTION public.can_access_brand(_brand uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    -- Dato aún sin marca: visible. Es lo que mantiene la Fase 0 inocua.
    _brand IS NULL
    -- Un MANAGER ve todas las marcas de su cuenta sin asignación explícita:
    -- si no, el administrador se quedaría fuera de sus propios datos.
    OR EXISTS (
      SELECT 1 FROM public.user_accounts ua
      JOIN public.roles r ON r.id = ua.role_id
      JOIN public.brands b ON b.id = _brand AND b.account_id = ua.account_id
      WHERE ua.user_id = auth.uid() AND ua.is_active
        AND r.code IN ('MANAGER', 'MASTER_ADMIN')
    )
    OR EXISTS (
      SELECT 1 FROM public.user_brands ub
      WHERE ub.user_id = auth.uid() AND ub.brand_id = _brand
    )
    OR EXISTS (
      SELECT 1 FROM public.department_brands db
      JOIN public.employee_profiles ep ON ep.department_id = db.department_id
      WHERE ep.user_id = auth.uid() AND db.brand_id = _brand
    );
$function$;

REVOKE EXECUTE ON FUNCTION public.can_access_brand(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_brand(uuid) TO authenticated;

-- Marcas visibles para el usuario, para el conmutador y los formularios.
CREATE OR REPLACE FUNCTION public.my_brands()
RETURNS TABLE (id uuid, name text, color text, logo_url text, module_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT b.id, b.name, b.color, b.logo_url,
         (SELECT count(*) FROM public.brand_modules bm
           WHERE bm.brand_id = b.id AND bm.is_enabled) AS module_count
  FROM public.brands b
  WHERE b.account_id = public.get_user_account_id(auth.uid())
    AND b.is_active
    AND public.can_access_brand(b.id)
  ORDER BY b.is_default DESC, b.sort_order, b.name;
$function$;

REVOKE EXECUTE ON FUNCTION public.my_brands() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_brands() TO authenticated;

-- ─── 8. RLS de las tablas nuevas ────────────────────────────
ALTER TABLE public.brands            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_brands       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_modules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_active_brand ENABLE ROW LEVEL SECURITY;

-- Leer: cualquiera de la cuenta ve el catálogo de marcas (necesita el nombre
-- para pintar una factura). El aislamiento va sobre los DATOS, no sobre la
-- existencia de la marca.
CREATE POLICY brands_select ON public.brands
  FOR SELECT TO authenticated
  USING (account_id = public.get_user_account_id(auth.uid()));

-- Escribir: solo administración.
CREATE POLICY brands_write ON public.brands
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN')))
  WITH CHECK (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN')));

CREATE POLICY user_brands_select ON public.user_brands
  FOR SELECT TO authenticated
  USING (account_id = public.get_user_account_id(auth.uid()));
CREATE POLICY user_brands_write ON public.user_brands
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN')))
  WITH CHECK (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN')));

CREATE POLICY department_brands_select ON public.department_brands
  FOR SELECT TO authenticated
  USING (account_id = public.get_user_account_id(auth.uid()));
CREATE POLICY department_brands_write ON public.department_brands
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN')))
  WITH CHECK (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN')));

CREATE POLICY brand_modules_select ON public.brand_modules
  FOR SELECT TO authenticated
  USING (account_id = public.get_user_account_id(auth.uid()));
CREATE POLICY brand_modules_write ON public.brand_modules
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN')))
  WITH CHECK (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN')));

-- La marca activa es cosa de cada uno.
CREATE POLICY user_active_brand_own ON public.user_active_brand
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
