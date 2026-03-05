
-- 1. Products table
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'General',
  unit text NOT NULL DEFAULT 'uds',
  min_stock numeric NOT NULL DEFAULT 0,
  current_stock numeric NOT NULL DEFAULT 0,
  cost_price numeric NOT NULL DEFAULT 0,
  sale_price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, sku)
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account products" ON public.products
  FOR SELECT TO authenticated
  USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Managers can manage own account products" ON public.products
  FOR ALL TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
  );

CREATE POLICY "Master admins can view all products" ON public.products
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'MASTER_ADMIN'));

-- 2. Stock movements table
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('IN', 'OUT', 'ADJUSTMENT')),
  quantity numeric NOT NULL,
  reason text NOT NULL DEFAULT 'manual',
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account movements" ON public.stock_movements
  FOR SELECT TO authenticated
  USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Managers can manage own account movements" ON public.stock_movements
  FOR ALL TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
  );

CREATE POLICY "Master admins can view all movements" ON public.stock_movements
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'MASTER_ADMIN'));

-- 3. Purchase orders table
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity numeric NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING', 'ORDERED', 'RECEIVED')),
  estimated_date date,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account orders" ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Managers can manage own account orders" ON public.purchase_orders
  FOR ALL TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
  );

CREATE POLICY "Master admins can view all orders" ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'MASTER_ADMIN'));

-- 4. Trigger to auto-update current_stock on stock_movements
CREATE OR REPLACE FUNCTION public.update_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'IN' THEN
    UPDATE public.products SET current_stock = current_stock + NEW.quantity, updated_at = now() WHERE id = NEW.product_id;
  ELSIF NEW.type = 'OUT' THEN
    UPDATE public.products SET current_stock = current_stock - NEW.quantity, updated_at = now() WHERE id = NEW.product_id;
  ELSIF NEW.type = 'ADJUSTMENT' THEN
    UPDATE public.products SET current_stock = NEW.quantity, updated_at = now() WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_product_stock
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_product_stock();
