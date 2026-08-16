-- Cada marca tiene sus líneas de negocio y sus servicios.
--
-- Estaban sueltas: se podían crear marcas y verticales sin que se conocieran
-- entre sí, así que dentro de XpertSecurity aparecían las líneas de negocio
-- de toda la cuenta. La línea de negocio cuelga de la marca; el servicio
-- hereda la marca de su línea, que es donde vive de verdad.

ALTER TABLE public.verticals       ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;
ALTER TABLE public.services        ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;
ALTER TABLE public.client_services ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_verticals_brand       ON public.verticals(brand_id);
CREATE INDEX IF NOT EXISTS idx_services_brand        ON public.services(brand_id);
CREATE INDEX IF NOT EXISTS idx_client_services_brand ON public.client_services(brand_id);

-- Lo que ya existía es de la cuenta, o sea de la marca principal.
UPDATE public.verticals v SET brand_id = b.id
  FROM public.brands b WHERE b.account_id = v.account_id AND b.is_default AND v.brand_id IS NULL;
UPDATE public.services s SET brand_id = b.id
  FROM public.brands b WHERE b.account_id = s.account_id AND b.is_default AND s.brand_id IS NULL;
-- La contratación sigue al cliente, que es quien tiene la marca de verdad.
UPDATE public.client_services cs SET brand_id = bc.brand_id
  FROM public.business_clients bc WHERE bc.id = cs.client_id AND cs.brand_id IS NULL;
UPDATE public.client_services cs SET brand_id = b.id
  FROM public.brands b WHERE b.account_id = cs.account_id AND b.is_default AND cs.brand_id IS NULL;

-- El servicio no elige marca: la hereda de su línea de negocio. Si pudiera
-- elegirla se podría dejar un servicio en una marca y su vertical en otra.
CREATE OR REPLACE FUNCTION public._services_brand_from_vertical()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.vertical_id IS NOT NULL THEN
    SELECT v.brand_id INTO NEW.brand_id FROM public.verticals v WHERE v.id = NEW.vertical_id;
  END IF;
  IF NEW.brand_id IS NULL THEN
    NEW.brand_id := COALESCE(
      public.active_brand_id(),
      (SELECT b.id FROM public.brands b WHERE b.account_id = NEW.account_id AND b.is_default));
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_services_brand_from_vertical ON public.services;
CREATE TRIGGER trg_services_brand_from_vertical
  BEFORE INSERT OR UPDATE OF vertical_id ON public.services
  FOR EACH ROW EXECUTE FUNCTION public._services_brand_from_vertical();

-- La contratación hereda del cliente por el mismo motivo.
CREATE OR REPLACE FUNCTION public._client_services_brand_from_client()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    SELECT bc.brand_id INTO NEW.brand_id FROM public.business_clients bc WHERE bc.id = NEW.client_id;
  END IF;
  IF NEW.brand_id IS NULL THEN
    NEW.brand_id := COALESCE(
      public.active_brand_id(),
      (SELECT b.id FROM public.brands b WHERE b.account_id = NEW.account_id AND b.is_default));
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_client_services_brand_from_client ON public.client_services;
CREATE TRIGGER trg_client_services_brand_from_client
  BEFORE INSERT OR UPDATE OF client_id ON public.client_services
  FOR EACH ROW EXECUTE FUNCTION public._client_services_brand_from_client();

-- Las verticales sí se sellan con la marca activa, como el resto.
DROP TRIGGER IF EXISTS trg_set_brand_from_context ON public.verticals;
CREATE TRIGGER trg_set_brand_from_context BEFORE INSERT ON public.verticals
  FOR EACH ROW EXECUTE FUNCTION public._set_brand_from_context();

-- ── Políticas ─────────────────────────────────────────────────────────────
ALTER POLICY "Users can view own account verticals" ON public.verticals
  USING (account_id = public.get_user_account_id(auth.uid()) AND public.brand_in_scope(brand_id));
ALTER POLICY "Managers can manage own account verticals" ON public.verticals
  USING (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
         AND public.brand_in_scope(brand_id))
  WITH CHECK (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
         AND public.brand_in_scope(brand_id));
ALTER POLICY "Master admins can view all verticals" ON public.verticals
  USING (public.has_role(auth.uid(),'MASTER_ADMIN') AND public.brand_in_scope(brand_id));

ALTER POLICY "Users can view own account services" ON public.services
  USING (account_id = public.get_user_account_id(auth.uid()) AND public.brand_in_scope(brand_id));
ALTER POLICY "Managers can manage own account services" ON public.services
  USING (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
         AND public.brand_in_scope(brand_id))
  WITH CHECK (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
         AND public.brand_in_scope(brand_id));
ALTER POLICY "Master admins can view all services" ON public.services
  USING (public.has_role(auth.uid(),'MASTER_ADMIN') AND public.brand_in_scope(brand_id));

ALTER POLICY "Users can view own account client_services" ON public.client_services
  USING (account_id = public.get_user_account_id(auth.uid())
         AND public.can_access_client(client_id) AND public.brand_in_scope(brand_id));
ALTER POLICY "Managers can manage own account client_services" ON public.client_services
  USING (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
         AND public.can_access_client(client_id) AND public.brand_in_scope(brand_id));
ALTER POLICY "Master admins can view all client_services" ON public.client_services
  USING (public.has_role(auth.uid(),'MASTER_ADMIN') AND public.brand_in_scope(brand_id));
