-- Phase 2: link withdrawals to a registered collaborator.
--
-- Adds a nullable FK on `movements` pointing to `collaborators(id)`. Existing
-- rows keep their free-text `holder` and `collaborator_id = NULL`, so the
-- change is fully backward compatible. New scanner-driven withdrawals
-- populate both `collaborator_id` (for joins) and `holder` (display).
--
-- Idempotent: safe to re-run if a previous apply was partial.

ALTER TABLE public.movements
  ADD COLUMN IF NOT EXISTS collaborator_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'movements_collaborator_id_fkey'
  ) THEN
    ALTER TABLE public.movements
      ADD CONSTRAINT movements_collaborator_id_fkey
      FOREIGN KEY (collaborator_id) REFERENCES public.collaborators(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_movements_collaborator
  ON public.movements(collaborator_id);

-- RLS: read stays the same (authenticated can SELECT). The scanner path
-- runs through the existing "Editors insert movements" policy, so no new
-- policies are needed. The FK constraint is what enforces referential
-- integrity; the policy still gates who can write.
