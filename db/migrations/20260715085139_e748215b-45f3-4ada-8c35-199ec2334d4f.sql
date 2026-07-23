CREATE OR REPLACE FUNCTION public.kiosk_register_movement(_asset_id uuid, _collaborator_id uuid, _type movement_type, _holder text)
 RETURNS uuid
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
  -- Authorization is performed by the caller (server function running as
  -- service_role). This RPC is only granted to service_role, so it cannot
  -- be invoked directly by browser clients.

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