
-- Restore EXECUTE on movement_shift for authenticated users: it is called
-- indirectly by the set_movement_shift BEFORE INSERT trigger on movements,
-- which runs as the caller. Function is IMMUTABLE and side-effect free.
GRANT EXECUTE ON FUNCTION public.movement_shift(timestamp with time zone) TO authenticated;

-- Harden the trigger function so it no longer depends on the caller's
-- EXECUTE privilege on movement_shift (defense in depth).
CREATE OR REPLACE FUNCTION public.set_movement_shift()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.shift = public.movement_shift(NEW.created_at);
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_movement_shift() FROM PUBLIC, anon, authenticated;
