-- El conmutador necesita distinguir la marca principal del resto: va primera
-- y sin sangrar, porque es la cuenta y no una marca más.
DROP FUNCTION IF EXISTS public.my_brands();

CREATE FUNCTION public.my_brands()
RETURNS TABLE(id uuid, name text, color text, logo_url text, is_default boolean, module_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT b.id, b.name, b.color, b.logo_url, b.is_default,
         (SELECT count(*) FROM public.brand_modules bm WHERE bm.brand_id = b.id AND bm.is_enabled)
  FROM public.brands b
  WHERE b.account_id = public.get_user_account_id(auth.uid())
    AND b.is_active
    AND public.can_access_brand(b.id)
  ORDER BY b.is_default DESC, b.sort_order, b.name;
$function$;
