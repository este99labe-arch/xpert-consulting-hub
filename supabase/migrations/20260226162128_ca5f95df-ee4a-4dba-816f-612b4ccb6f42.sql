
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- TABLE: accounts
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('MASTER', 'CLIENT')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX idx_accounts_type ON public.accounts(type);
CREATE INDEX idx_accounts_is_active ON public.accounts(is_active);

-- TABLE: service_modules
CREATE TABLE public.service_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT
);

INSERT INTO public.service_modules (code, name, description) VALUES
  ('DASHBOARD', 'Dashboard', 'Panel de control principal'),
  ('CLIENTS', 'Clientes', 'Gestión de clientes internos'),
  ('INVOICES', 'Facturas', 'Facturación y gastos'),
  ('ACCOUNTING', 'Contabilidad', 'Contabilidad básica'),
  ('HR', 'Recursos Humanos', 'Gestión de empleados'),
  ('ATTENDANCE', 'Asistencia', 'Control horario y ausencias'),
  ('SETTINGS', 'Configuración', 'Configuración del sistema');

-- TABLE: account_modules
CREATE TABLE public.account_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.service_modules(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(account_id, module_id)
);
CREATE INDEX idx_account_modules_account_id ON public.account_modules(account_id);

-- TABLE: roles
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL
);

INSERT INTO public.roles (code) VALUES ('MASTER_ADMIN'), ('MANAGER'), ('EMPLOYEE');

-- TABLE: user_accounts
CREATE TABLE public.user_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, account_id)
);
CREATE INDEX idx_user_accounts_account_id ON public.user_accounts(account_id);
CREATE INDEX idx_user_accounts_user_id ON public.user_accounts(user_id);

-- TABLE: business_clients
CREATE TABLE public.business_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tax_id TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_business_clients_account_id ON public.business_clients(account_id);

-- TABLE: invoices
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.business_clients(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('INVOICE', 'EXPENSE')),
  amount_net NUMERIC(12,2) NOT NULL,
  vat_percentage NUMERIC(5,2) NOT NULL,
  amount_vat NUMERIC(12,2) NOT NULL,
  amount_total NUMERIC(12,2) NOT NULL,
  issue_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_account_id ON public.invoices(account_id);
CREATE INDEX idx_invoices_issue_date ON public.invoices(issue_date);
CREATE INDEX idx_invoices_status ON public.invoices(status);

-- TABLE: attendance_records
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  work_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, work_date)
);
CREATE INDEX idx_attendance_records_account_id ON public.attendance_records(account_id);

-- TABLE: leave_requests
CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('VACATION', 'SICK', 'OTHER')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leave_requests_account_id ON public.leave_requests(account_id);

-- SECURITY DEFINER: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_accounts ua
    JOIN public.roles r ON r.id = ua.role_id
    WHERE ua.user_id = _user_id
      AND r.code = _role
      AND ua.is_active = true
  )
$$;

-- SECURITY DEFINER: get_user_account_id
CREATE OR REPLACE FUNCTION public.get_user_account_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ua.account_id
  FROM public.user_accounts ua
  WHERE ua.user_id = _user_id
    AND ua.is_active = true
  LIMIT 1
$$;

-- RLS: accounts
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master admins can view all accounts"
  ON public.accounts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'MASTER_ADMIN'));

CREATE POLICY "Users can view their own account"
  ON public.accounts FOR SELECT TO authenticated
  USING (id = public.get_user_account_id(auth.uid()));

CREATE POLICY "Master admins can insert accounts"
  ON public.accounts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'MASTER_ADMIN'));

CREATE POLICY "Master admins can update accounts"
  ON public.accounts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'MASTER_ADMIN'));

-- RLS: service_modules
ALTER TABLE public.service_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view modules"
  ON public.service_modules FOR SELECT TO authenticated
  USING (true);

-- RLS: account_modules
ALTER TABLE public.account_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master admins can manage account_modules"
  ON public.account_modules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'MASTER_ADMIN'));

CREATE POLICY "Users can view own account modules"
  ON public.account_modules FOR SELECT TO authenticated
  USING (account_id = public.get_user_account_id(auth.uid()));

-- RLS: roles
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view roles"
  ON public.roles FOR SELECT TO authenticated
  USING (true);

-- RLS: user_accounts
ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master admins can manage user_accounts"
  ON public.user_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'MASTER_ADMIN'));

CREATE POLICY "Users can view own user_account"
  ON public.user_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- RLS: business_clients
ALTER TABLE public.business_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account clients"
  ON public.business_clients FOR SELECT TO authenticated
  USING (account_id = public.get_user_account_id(auth.uid()));

CREATE POLICY "Managers can manage own account clients"
  ON public.business_clients FOR ALL TO authenticated
  USING (
    account_id = public.get_user_account_id(auth.uid())
    AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
  );

-- RLS: invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (account_id = public.get_user_account_id(auth.uid()));

CREATE POLICY "Managers can manage own account invoices"
  ON public.invoices FOR ALL TO authenticated
  USING (
    account_id = public.get_user_account_id(auth.uid())
    AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
  );

-- RLS: attendance_records
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attendance"
  ON public.attendance_records FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own attendance"
  ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND account_id = public.get_user_account_id(auth.uid()));

CREATE POLICY "Users can update own attendance"
  ON public.attendance_records FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Managers can view account attendance"
  ON public.attendance_records FOR SELECT TO authenticated
  USING (
    account_id = public.get_user_account_id(auth.uid())
    AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
  );

-- RLS: leave_requests
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own leave requests"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own leave requests"
  ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND account_id = public.get_user_account_id(auth.uid()));

CREATE POLICY "Managers can manage account leave requests"
  ON public.leave_requests FOR ALL TO authenticated
  USING (
    account_id = public.get_user_account_id(auth.uid())
    AND (public.has_role(auth.uid(), 'MANAGER') OR public.has_role(auth.uid(), 'MASTER_ADMIN'))
  );
