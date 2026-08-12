-- Fase 5, grupo 1: aislamiento por marca en facturación y clientes.
--
-- Las políticas conservan EXACTAMENTE sus condiciones anteriores y solo se
-- les añade la de marca. Un MANAGER sigue viéndolo todo porque
-- can_access_brand() ya le devuelve cierto: el cambio no le quita nada.
--
-- client_plans queda fuera: es el CATÁLOGO de planes de la cuenta, no el plan
-- de un cliente, y no tiene a qué marca pertenecer.

CREATE OR REPLACE FUNCTION public.can_access_invoice(_invoice uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.invoices i
                  WHERE i.id = _invoice AND public.can_access_brand(i.brand_id));
$function$;

CREATE OR REPLACE FUNCTION public.can_access_client(_client uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT _client IS NULL OR EXISTS (SELECT 1 FROM public.business_clients c
                  WHERE c.id = _client AND public.can_access_brand(c.brand_id));
$function$;

REVOKE EXECUTE ON FUNCTION public.can_access_invoice(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_client(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_client(uuid) TO authenticated;

DROP POLICY "Users can view own account clients" ON public.business_clients;
CREATE POLICY "Users can view own account clients" ON public.business_clients
  FOR SELECT USING (account_id = public.get_user_account_id(auth.uid())
                    AND public.can_access_brand(brand_id));

DROP POLICY "Managers can manage own account clients" ON public.business_clients;
CREATE POLICY "Managers can manage own account clients" ON public.business_clients
  FOR ALL USING (account_id = public.get_user_account_id(auth.uid())
                 AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
                 AND public.can_access_brand(brand_id));

DROP POLICY "Users can view own account invoices" ON public.invoices;
CREATE POLICY "Users can view own account invoices" ON public.invoices
  FOR SELECT USING (account_id = public.get_user_account_id(auth.uid())
                    AND public.can_access_brand(brand_id));

DROP POLICY "Managers can manage own account invoices" ON public.invoices;
CREATE POLICY "Managers can manage own account invoices" ON public.invoices
  FOR ALL USING (account_id = public.get_user_account_id(auth.uid())
                 AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
                 AND public.can_access_brand(brand_id));

DROP POLICY "Managers can delete own account invoices" ON public.invoices;
CREATE POLICY "Managers can delete own account invoices" ON public.invoices
  FOR DELETE USING (account_id = public.get_user_account_id(auth.uid())
                    AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
                    AND public.can_access_brand(brand_id));

DROP POLICY "Users can view account invoice lines" ON public.invoice_lines;
CREATE POLICY "Users can view account invoice lines" ON public.invoice_lines
  FOR SELECT USING (account_id = public.get_user_account_id(auth.uid())
                    AND public.can_access_invoice(invoice_id));

DROP POLICY "Users can insert account invoice lines" ON public.invoice_lines;
CREATE POLICY "Users can insert account invoice lines" ON public.invoice_lines
  FOR INSERT WITH CHECK (account_id = public.get_user_account_id(auth.uid())
                         AND public.can_access_invoice(invoice_id));

DROP POLICY "Managers can manage account invoice lines" ON public.invoice_lines;
CREATE POLICY "Managers can manage account invoice lines" ON public.invoice_lines
  FOR ALL USING (account_id = public.get_user_account_id(auth.uid())
                 AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
                 AND public.can_access_invoice(invoice_id));

DROP POLICY "Users can view account invoice payments" ON public.invoice_payments;
CREATE POLICY "Users can view account invoice payments" ON public.invoice_payments
  FOR SELECT USING (account_id = public.get_user_account_id(auth.uid())
                    AND public.can_access_invoice(invoice_id));

DROP POLICY "Users can insert account invoice payments" ON public.invoice_payments;
CREATE POLICY "Users can insert account invoice payments" ON public.invoice_payments
  FOR INSERT WITH CHECK (account_id = public.get_user_account_id(auth.uid())
                         AND public.can_access_invoice(invoice_id));

DROP POLICY "Managers can manage account invoice payments" ON public.invoice_payments;
CREATE POLICY "Managers can manage account invoice payments" ON public.invoice_payments
  FOR ALL USING (account_id = public.get_user_account_id(auth.uid())
                 AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
                 AND public.can_access_invoice(invoice_id));

DROP POLICY "Users can view account client contacts" ON public.client_contacts;
CREATE POLICY "Users can view account client contacts" ON public.client_contacts
  FOR SELECT USING (account_id = public.get_user_account_id(auth.uid())
                    AND public.can_access_client(client_id));

DROP POLICY "Managers can manage account client contacts" ON public.client_contacts;
CREATE POLICY "Managers can manage account client contacts" ON public.client_contacts
  FOR ALL USING (account_id = public.get_user_account_id(auth.uid())
                 AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
                 AND public.can_access_client(client_id));

-- La política de MASTER_ADMIN que cruza cuentas se deja intacta: alimenta el
-- panel maestro y no mira marcas.
DROP POLICY "Users can view own account client_services" ON public.client_services;
CREATE POLICY "Users can view own account client_services" ON public.client_services
  FOR SELECT USING (account_id = public.get_user_account_id(auth.uid())
                    AND public.can_access_client(client_id));

DROP POLICY "Managers can manage own account client_services" ON public.client_services;
CREATE POLICY "Managers can manage own account client_services" ON public.client_services
  FOR ALL USING (account_id = public.get_user_account_id(auth.uid())
                 AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
                 AND public.can_access_client(client_id));
