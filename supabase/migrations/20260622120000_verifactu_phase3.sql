-- ============================================================
-- VERI*FACTU — Fase 3: persistencia, configuración e inmutabilidad
-- Modalidad: Veri*Factu (remisión en tiempo real a la AEAT).
-- ============================================================

-- 1. Columnas VERI*FACTU en invoices ------------------------------------
-- Estados: NONE | PREPARED | SENT | ERROR
--   NONE      = aún no procesada para VERI*FACTU
--   PREPARED  = XML + huella generados, pendiente de envío (p.ej. sin certificado)
--   SENT      = registrada en la AEAT (devuelve CSV)
--   ERROR     = la AEAT rechazó el registro
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS verifactu_status text NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS verifactu_huella text,
  ADD COLUMN IF NOT EXISTS verifactu_huella_anterior text,
  ADD COLUMN IF NOT EXISTS verifactu_csv text,
  ADD COLUMN IF NOT EXISTS verifactu_registered_at timestamptz,
  ADD COLUMN IF NOT EXISTS verifactu_qr_url text,
  ADD COLUMN IF NOT EXISTS verifactu_xml text;

COMMENT ON COLUMN public.invoices.verifactu_status IS 'Estado VERI*FACTU: NONE|PREPARED|SENT|ERROR';
COMMENT ON COLUMN public.invoices.verifactu_huella IS 'Huella SHA-256 (hex mayúsculas) del registro de alta';
COMMENT ON COLUMN public.invoices.verifactu_huella_anterior IS 'Huella del registro inmediatamente anterior (encadenamiento)';
COMMENT ON COLUMN public.invoices.verifactu_csv IS 'Código Seguro de Verificación devuelto por la AEAT';

-- 2. Configuración VERI*FACTU en account_settings -----------------------
ALTER TABLE public.account_settings
  ADD COLUMN IF NOT EXISTS verifactu_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verifactu_env text NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS verifactu_nif text;

COMMENT ON COLUMN public.account_settings.verifactu_env IS 'Entorno AEAT: sandbox | prod';

-- 3. Log de eventos VERI*FACTU ------------------------------------------
CREATE TABLE IF NOT EXISTS public.verifactu_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  action text NOT NULL DEFAULT 'ALTA',          -- ALTA | ANULACION
  status text NOT NULL,                          -- PREPARED | SENT | ERROR
  env text NOT NULL DEFAULT 'sandbox',
  huella text,
  csv text,
  request_xml text,
  response_xml text,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.verifactu_events ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier usuario de la cuenta. Escritura: sólo edge functions
-- (service role, que omite RLS). No se otorga INSERT/UPDATE/DELETE a authenticated.
DROP POLICY IF EXISTS "Account users can view verifactu events" ON public.verifactu_events;
CREATE POLICY "Account users can view verifactu events"
ON public.verifactu_events FOR SELECT TO authenticated
USING (account_id = get_user_account_id(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_verifactu_events_invoice ON public.verifactu_events(invoice_id);
CREATE INDEX IF NOT EXISTS idx_verifactu_events_account ON public.verifactu_events(account_id);

-- 4. Inmutabilidad de facturas registradas ------------------------------
-- Una vez verifactu_status = 'SENT' no se permite modificar los datos
-- fiscales ni borrar la factura (requisito legal VERI*FACTU). Los pagos
-- (status, paid_at) y los propios campos verifactu_* siguen siendo editables.
CREATE OR REPLACE FUNCTION public.verifactu_enforce_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.verifactu_status = 'SENT' THEN
      RAISE EXCEPTION 'No se puede eliminar una factura ya registrada en VERI*FACTU (%).', OLD.invoice_number
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF OLD.verifactu_status = 'SENT' THEN
    IF NEW.invoice_number   IS DISTINCT FROM OLD.invoice_number
       OR NEW.client_id      IS DISTINCT FROM OLD.client_id
       OR NEW.issue_date     IS DISTINCT FROM OLD.issue_date
       OR NEW.amount_net     IS DISTINCT FROM OLD.amount_net
       OR NEW.amount_vat     IS DISTINCT FROM OLD.amount_vat
       OR NEW.amount_total   IS DISTINCT FROM OLD.amount_total
       OR NEW.vat_percentage IS DISTINCT FROM OLD.vat_percentage
       OR NEW.irpf_percentage IS DISTINCT FROM OLD.irpf_percentage
       OR NEW.irpf_amount    IS DISTINCT FROM OLD.irpf_amount
       OR NEW.concept        IS DISTINCT FROM OLD.concept
       OR NEW.type           IS DISTINCT FROM OLD.type THEN
      RAISE EXCEPTION 'No se pueden modificar los datos fiscales de una factura ya registrada en VERI*FACTU (%).', OLD.invoice_number
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.verifactu_enforce_immutability() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_verifactu_immutability ON public.invoices;
CREATE TRIGGER trg_verifactu_immutability
  BEFORE UPDATE OR DELETE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.verifactu_enforce_immutability();

-- Protección equivalente de las líneas de una factura ya registrada.
CREATE OR REPLACE FUNCTION public.verifactu_protect_lines()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
  v_invoice uuid;
BEGIN
  v_invoice := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT verifactu_status INTO v_status FROM public.invoices WHERE id = v_invoice;
  IF v_status = 'SENT' THEN
    RAISE EXCEPTION 'No se pueden modificar las líneas de una factura ya registrada en VERI*FACTU.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.verifactu_protect_lines() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_verifactu_protect_lines ON public.invoice_lines;
CREATE TRIGGER trg_verifactu_protect_lines
  BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.verifactu_protect_lines();
