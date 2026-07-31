-- ============================================================================
-- FASE 3 — El alta de una cuenta ERP enlaza con el cliente por CLAVE
-- ============================================================================
-- Antes, la relación cuenta ERP ↔ cliente era implícita y se resolvía POR
-- NOMBRE (este trigger creaba el cliente y create_client_account lo volvía a
-- buscar con `.eq("name", company_name)`). Era frágil con clientes homónimos e
-- impedía que un cliente tuviera varias cuentas ERP.
--
-- Ahora el trigger deja hecho el enlace en accounts.client_id.
--
-- Compatibilidad: si el cliente ya existía, se localiza por nombre igual que
-- antes, así que el flujo actual sigue funcionando sin cambios.
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

  -- La cuenta ya viene enlazada a un cliente existente: se está dando de alta
  -- una segunda cuenta ERP para ese cliente, así que no se crea otro.
  IF NEW.client_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO master_account_id FROM public.accounts WHERE type = 'MASTER' LIMIT 1;
  IF master_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.business_clients (account_id, name, tax_id, status)
  VALUES (master_account_id, NEW.name, 'PENDIENTE', 'ACTIVE')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_client_id;

  -- Si el INSERT no creó fila (el cliente ya existía), se reutiliza el que
  -- coincide por nombre: es el comportamiento anterior, como red de seguridad.
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

  RETURN NEW;
END;
$function$;
