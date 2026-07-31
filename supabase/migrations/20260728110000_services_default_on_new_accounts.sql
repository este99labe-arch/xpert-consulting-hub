-- Servicios que se contratan solos al dar de alta una cuenta ERP nueva.
--
-- Se marca desde la UI en vez de codificar los nombres ("Instalación ERP",
-- "Mantenimiento ERP"…): así se puede cambiar qué entra por defecto sin tocar
-- código, en línea con el resto del modelo de verticales.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS is_default_for_new_accounts boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.services.is_default_for_new_accounts IS
  'Si es true, al crear una cuenta ERP se contrata automáticamente para su cliente.';

CREATE OR REPLACE FUNCTION public.sync_client_account_to_business_clients()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  master_account_id uuid;
  v_client_id uuid;
BEGIN
  IF NEW.type <> 'CLIENT' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO master_account_id FROM public.accounts WHERE type = 'MASTER' LIMIT 1;
  IF master_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Si la cuenta ya viene enlazada (segunda cuenta ERP de un cliente existente)
  -- se reutiliza ese cliente; si no, se crea uno.
  IF NEW.client_id IS NOT NULL THEN
    v_client_id := NEW.client_id;
  ELSE
    INSERT INTO public.business_clients (account_id, name, tax_id, status)
    VALUES (master_account_id, NEW.name, 'PENDIENTE', 'ACTIVE')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_client_id;

    -- Fallback: si no creó fila (ya existía), se localiza por nombre.
    IF v_client_id IS NULL THEN
      SELECT id INTO v_client_id
        FROM public.business_clients
       WHERE account_id = master_account_id AND name = NEW.name
       ORDER BY created_at DESC
       LIMIT 1;
    END IF;

    IF v_client_id IS NOT NULL THEN
      UPDATE public.accounts SET client_id = v_client_id WHERE id = NEW.id;
    END IF;
  END IF;

  -- Alta automática de los servicios marcados como "por defecto".
  -- No se duplica si el cliente ya los tiene vigentes.
  IF v_client_id IS NOT NULL THEN
    INSERT INTO public.client_services
      (account_id, client_id, service_id, vertical_id, status, start_date, notes)
    SELECT s.account_id, v_client_id, s.id, s.vertical_id, 'ACTIVE', CURRENT_DATE,
           'Alta automática con la cuenta ERP'
      FROM public.services s
     WHERE s.account_id = master_account_id
       AND s.is_active = true
       AND s.is_default_for_new_accounts = true
       AND NOT EXISTS (
             SELECT 1 FROM public.client_services cs
              WHERE cs.client_id = v_client_id
                AND cs.service_id = s.id
                AND cs.status <> 'CANCELLED'
           );
  END IF;

  RETURN NEW;
END;
$function$;
