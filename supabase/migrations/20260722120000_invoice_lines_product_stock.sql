-- Vincular líneas de factura a productos del catálogo + trazar el movimiento
-- de stock y descontarlo automáticamente al emitir la factura de venta.
ALTER TABLE public.invoice_lines
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_lines_product ON public.invoice_lines(product_id);

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_invoice ON public.stock_movements(invoice_id);

-- Descuento automático de stock al emitir (idempotente: una salida por
-- (factura, producto); no descuenta en borrador ni al anular).
CREATE OR REPLACE FUNCTION public.sync_invoice_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user uuid := auth.uid();
  ln record;
BEGIN
  IF NEW.type <> 'INVOICE' OR NEW.status IN ('DRAFT', 'CANCELLED') THEN
    RETURN NEW;
  END IF;
  IF v_user IS NULL THEN
    SELECT user_id INTO v_user FROM public.user_accounts
      WHERE account_id = NEW.account_id AND is_active LIMIT 1;
  END IF;
  FOR ln IN
    SELECT il.product_id, il.quantity FROM public.invoice_lines il
    WHERE il.invoice_id = NEW.id AND il.product_id IS NOT NULL
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.stock_movements sm
      WHERE sm.invoice_id = NEW.id AND sm.product_id = ln.product_id
    ) THEN
      INSERT INTO public.stock_movements (account_id, product_id, type, quantity, reason, notes, created_by, invoice_id)
      VALUES (NEW.account_id, ln.product_id, 'OUT', ln.quantity, 'venta',
              'Venta automática — factura ' || COALESCE(NEW.invoice_number, left(NEW.id::text, 8)),
              v_user, NEW.id);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sync_invoice_stock() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_invoice_stock ON public.invoices;
CREATE TRIGGER trg_sync_invoice_stock
  AFTER INSERT OR UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_stock();
