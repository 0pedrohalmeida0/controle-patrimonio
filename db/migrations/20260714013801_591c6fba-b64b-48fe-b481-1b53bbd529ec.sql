-- 1. Dynamic equipment types: active flag
ALTER TABLE public.asset_types
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- 2. Automatic shift detection on movements
ALTER TABLE public.movements
  ADD COLUMN IF NOT EXISTS shift smallint;

-- Function: derive operational shift (1,2,3) from a timestamp, using São Paulo local time.
-- 1st shift: 06:00-12:00 and 14:00-16:00
-- 2nd shift: 12:00-14:00 and 16:00-22:00
-- 3rd shift: 22:00-06:00
CREATE OR REPLACE FUNCTION public.movement_shift(ts timestamptz)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN local_t >= TIME '06:00' AND local_t < TIME '12:00' THEN 1
    WHEN local_t >= TIME '12:00' AND local_t < TIME '14:00' THEN 2
    WHEN local_t >= TIME '14:00' AND local_t < TIME '16:00' THEN 1
    WHEN local_t >= TIME '16:00' AND local_t < TIME '22:00' THEN 2
    ELSE 3
  END::smallint
  FROM (SELECT (ts AT TIME ZONE 'America/Sao_Paulo')::time AS local_t) s;
$$;

CREATE OR REPLACE FUNCTION public.set_movement_shift()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.shift = public.movement_shift(NEW.created_at);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_movement_shift() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS trg_set_movement_shift ON public.movements;
CREATE TRIGGER trg_set_movement_shift
  BEFORE INSERT OR UPDATE OF created_at ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.set_movement_shift();

-- Backfill existing movements
UPDATE public.movements SET shift = public.movement_shift(created_at) WHERE shift IS NULL;