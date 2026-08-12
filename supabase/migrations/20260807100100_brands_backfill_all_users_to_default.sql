-- En la Fase 0 solo se asignó la marca principal a MANAGER y MASTER_ADMIN.
-- Mientras nada la aplicaba daba igual, pero al entrar en vigor el
-- aislamiento del grupo 1 los EMPLEADOS se quedaron sin acceso a todo lo que
-- veían el día anterior: sus datos viven en la marca principal y ellos no
-- estaban asignados a ella. Lo detectó la prueba de aislamiento.
--
-- Nadie debe perder acceso por una migración. Todos los usuarios activos
-- pasan a tener la marca principal de su cuenta; a partir de ahí, quitar
-- accesos es una decisión consciente que se toma desde la interfaz.
INSERT INTO public.user_brands (account_id, user_id, brand_id)
SELECT ua.account_id, ua.user_id, b.id
FROM public.user_accounts ua
JOIN public.brands b ON b.account_id = ua.account_id AND b.is_default
WHERE ua.is_active
ON CONFLICT (user_id, brand_id) DO NOTHING;
