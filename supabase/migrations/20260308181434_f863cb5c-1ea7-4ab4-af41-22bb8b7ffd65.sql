
CREATE TABLE public.employee_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  dni text,
  phone text,
  date_of_birth date,
  address text,
  postal_code text,
  city text,
  department text,
  position text,
  start_date date,
  social_security_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, account_id)
);

ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.employee_profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Managers can manage account profiles"
  ON public.employee_profiles FOR ALL
  USING (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'MANAGER') OR has_role(auth.uid(), 'MASTER_ADMIN'))
  );

CREATE POLICY "Master admins can manage all profiles"
  ON public.employee_profiles FOR ALL
  USING (has_role(auth.uid(), 'MASTER_ADMIN'));
