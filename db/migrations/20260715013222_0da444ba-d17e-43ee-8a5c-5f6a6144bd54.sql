-- Add permanent asset code (ATV-000001) auto-generated on insert
CREATE SEQUENCE IF NOT EXISTS public.asset_code_seq START 1;

ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS code text;

CREATE OR REPLACE FUNCTION public.set_asset_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'ATV-' || lpad(nextval('public.asset_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assets_set_code ON public.assets;
CREATE TRIGGER assets_set_code
  BEFORE INSERT ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.set_asset_code();

-- Backfill existing rows deterministically by created_at
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.assets WHERE code IS NULL ORDER BY created_at, id LOOP
    UPDATE public.assets
      SET code = 'ATV-' || lpad(nextval('public.asset_code_seq')::text, 6, '0')
      WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.assets ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS assets_code_unique ON public.assets(code);
