-- Fase 5, grupo 2: resto de facturación (recurrentes, solicitudes de borrado,
-- eventos VERI*FACTU) e inventario.
--
-- Las políticas de MASTER_ADMIN que cruzan cuentas se dejan intactas: son las
-- que alimentan el panel maestro y no miran marcas.

DROP POLICY "Users can view account recurring invoices" ON public.recurring_invoices;
CREATE POLICY "Users can view account recurring invoices" ON public.recurring_invoices
  FOR SELECT USING (account_id = public.get_user_account_id(auth.uid())
                    AND public.can_access_brand(brand_id));

DROP POLICY "Managers can manage account recurring invoices" ON public.recurring_invoices;
CREATE POLICY "Managers can manage account recurring invoices" ON public.recurring_invoices
  FOR ALL USING (account_id = public.get_user_account_id(auth.uid())
                 AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
                 AND public.can_access_brand(brand_id));

CREATE OR REPLACE FUNCTION public.can_access_recurring(_rec uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.recurring_invoices r
                  WHERE r.id = _rec AND public.can_access_brand(r.brand_id));
$function$;
REVOKE EXECUTE ON FUNCTION public.can_access_recurring(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_recurring(uuid) TO authenticated;

DROP POLICY "Users can view own account recurring lines" ON public.recurring_invoice_lines;
CREATE POLICY "Users can view own account recurring lines" ON public.recurring_invoice_lines
  FOR SELECT USING (account_id = public.get_user_account_id(auth.uid())
                    AND public.can_access_recurring(recurring_id));

DROP POLICY "Managers manage own account recurring lines" ON public.recurring_invoice_lines;
CREATE POLICY "Managers manage own account recurring lines" ON public.recurring_invoice_lines
  FOR ALL USING (account_id = public.get_user_account_id(auth.uid())
                 AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
                 AND public.can_access_recurring(recurring_id));

-- "Users can view own delete requests" se deja: mira quién la pidió, y quien
-- la pidió ya tenía acceso a la factura cuando la creó.
DROP POLICY "Managers can view account delete requests" ON public.invoice_delete_requests;
CREATE POLICY "Managers can view account delete requests" ON public.invoice_delete_requests
  FOR SELECT USING (account_id = public.get_user_account_id(auth.uid())
                    AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
                    AND public.can_access_invoice(invoice_id));

DROP POLICY "Managers can update account delete requests" ON public.invoice_delete_requests;
CREATE POLICY "Managers can update account delete requests" ON public.invoice_delete_requests
  FOR UPDATE USING (account_id = public.get_user_account_id(auth.uid())
                    AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
                    AND public.can_access_invoice(invoice_id));

DROP POLICY "Users can insert own delete requests" ON public.invoice_delete_requests;
CREATE POLICY "Users can insert own delete requests" ON public.invoice_delete_requests
  FOR INSERT WITH CHECK (requested_by = auth.uid()
                         AND account_id = public.get_user_account_id(auth.uid())
                         AND public.can_access_invoice(invoice_id));

DROP POLICY "Account users can view verifactu events" ON public.verifactu_events;
CREATE POLICY "Account users can view verifactu events" ON public.verifactu_events
  FOR SELECT USING (account_id = public.get_user_account_id(auth.uid())
                    AND public.can_access_invoice(invoice_id));

DROP POLICY "Users can view own account products" ON public.products;
CREATE POLICY "Users can view own account products" ON public.products
  FOR SELECT USING (account_id = public.get_user_account_id(auth.uid())
                    AND public.can_access_brand(brand_id));

DROP POLICY "Managers can manage own account products" ON public.products;
CREATE POLICY "Managers can manage own account products" ON public.products
  FOR ALL USING (account_id = public.get_user_account_id(auth.uid())
                 AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
                 AND public.can_access_brand(brand_id));

CREATE OR REPLACE FUNCTION public.can_access_product(_product uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT _product IS NULL OR EXISTS (SELECT 1 FROM public.products p
                  WHERE p.id = _product AND public.can_access_brand(p.brand_id));
$function$;
REVOKE EXECUTE ON FUNCTION public.can_access_product(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_product(uuid) TO authenticated;

DROP POLICY "Users can view own account movements" ON public.stock_movements;
CREATE POLICY "Users can view own account movements" ON public.stock_movements
  FOR SELECT USING (account_id = public.get_user_account_id(auth.uid())
                    AND public.can_access_product(product_id));

DROP POLICY "Managers can manage own account movements" ON public.stock_movements;
CREATE POLICY "Managers can manage own account movements" ON public.stock_movements
  FOR ALL USING (account_id = public.get_user_account_id(auth.uid())
                 AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
                 AND public.can_access_product(product_id));

DROP POLICY "Users can view own account orders" ON public.purchase_orders;
CREATE POLICY "Users can view own account orders" ON public.purchase_orders
  FOR SELECT USING (account_id = public.get_user_account_id(auth.uid())
                    AND public.can_access_brand(brand_id));

DROP POLICY "Managers can manage own account orders" ON public.purchase_orders;
CREATE POLICY "Managers can manage own account orders" ON public.purchase_orders
  FOR ALL USING (account_id = public.get_user_account_id(auth.uid())
                 AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
                 AND public.can_access_brand(brand_id));
