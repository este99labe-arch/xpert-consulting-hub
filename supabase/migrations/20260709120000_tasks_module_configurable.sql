-- TASKS deja de ser módulo "core" (siempre visible) y pasa a ser configurable
-- por empleado en Permisos de módulos. Para no romper el acceso actual, se
-- habilita explícitamente a todos los empleados activos existentes.
INSERT INTO public.user_modules (user_id, account_id, module_id, is_enabled)
SELECT ua.user_id, ua.account_id, sm.id, true
FROM public.user_accounts ua
JOIN public.roles r ON r.id = ua.role_id
JOIN public.service_modules sm ON sm.code = 'TASKS'
WHERE ua.is_active = true AND r.code = 'EMPLOYEE'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_modules um
    WHERE um.user_id = ua.user_id AND um.module_id = sm.id
  );
