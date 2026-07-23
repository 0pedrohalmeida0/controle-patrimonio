
CREATE OR REPLACE FUNCTION public.set_asset_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'ATV-' || lpad(nextval('public.asset_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_asset_code() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.kiosk_register_movement(
  _asset_id uuid,
  _collaborator_id uuid,
  _type public.movement_type,
  _holder text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _mov_id uuid;
  _expected public.asset_status;
  _new public.asset_status;
  _updated int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF _type = 'withdraw' THEN
    _expected := 'available';
    _new := 'in_use';
  ELSE
    _expected := 'in_use';
    _new := 'available';
  END IF;

  UPDATE public.assets
     SET status = _new,
         current_holder = CASE WHEN _type = 'withdraw' THEN _holder ELSE NULL END
   WHERE id = _asset_id AND status = _expected;

  GET DIAGNOSTICS _updated = ROW_COUNT;
  IF _updated = 0 THEN
    IF _type = 'withdraw' THEN
      RAISE EXCEPTION 'O equipamento não está mais disponível';
    ELSE
      RAISE EXCEPTION 'O equipamento não está mais em uso';
    END IF;
  END IF;

  INSERT INTO public.movements (asset_id, collaborator_id, type, holder)
  VALUES (_asset_id, _collaborator_id, _type, _holder)
  RETURNING id INTO _mov_id;

  RETURN _mov_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.kiosk_register_movement(uuid, uuid, public.movement_type, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kiosk_register_movement(uuid, uuid, public.movement_type, text) TO authenticated;
