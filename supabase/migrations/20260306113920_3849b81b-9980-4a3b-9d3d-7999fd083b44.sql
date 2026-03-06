-- Sync existing CLIENT accounts into business_clients for XpertConsulting master account
INSERT INTO public.business_clients (account_id, name, tax_id, status)
SELECT '46918a36-8673-4e26-a90e-7e7e823fcf97', a.name, 'PENDIENTE', 'ACTIVE'
FROM public.accounts a
WHERE a.type = 'CLIENT' AND a.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM public.business_clients bc 
  WHERE bc.account_id = '46918a36-8673-4e26-a90e-7e7e823fcf97' 
  AND bc.name = a.name
);

-- Create trigger function to auto-register new CLIENT accounts as business_clients for the master account
CREATE OR REPLACE FUNCTION public.sync_client_account_to_business_clients()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  master_account_id uuid;
BEGIN
  IF NEW.type = 'CLIENT' THEN
    SELECT id INTO master_account_id FROM public.accounts WHERE type = 'MASTER' LIMIT 1;
    IF master_account_id IS NOT NULL THEN
      INSERT INTO public.business_clients (account_id, name, tax_id, status)
      VALUES (master_account_id, NEW.name, 'PENDIENTE', 'ACTIVE')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_client_to_business_clients
  AFTER INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_client_account_to_business_clients();