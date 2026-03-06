-- Enable all modules for the XpertConsulting master account
INSERT INTO public.account_modules (account_id, module_id, is_enabled)
SELECT '46918a36-8673-4e26-a90e-7e7e823fcf97', id, true
FROM public.service_modules
ON CONFLICT DO NOTHING;