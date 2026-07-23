-- Registry of collaborators (employees) who are allowed to take equipment.
--
-- Phase 1 (this migration): stand-alone registry. Operators can register
-- a collaborator's name + badge number. The current withdrawal flow still
-- uses free-text `holder` on `movements`.
--
-- Phase 2 (later): will scan the collaborator's QR badge to look up by
-- `badge_number`, then link the withdrawal to this row via a nullable
-- `collaborator_id` FK on `movements`.

-- Idempotent: safe to re-run if a previous apply was partial.
CREATE TABLE IF NOT EXISTS public.collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  badge_number text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Hot path for the QR scan in phase 2: lookup by badge number.
CREATE UNIQUE INDEX IF NOT EXISTS collaborators_badge_unique
  ON public.collaborators(badge_number);
CREATE INDEX IF NOT EXISTS idx_collaborators_active
  ON public.collaborators(active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collaborators TO authenticated;
GRANT ALL ON public.collaborators TO service_role;
ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (for pickers/dropdowns).
DROP POLICY IF EXISTS "Authenticated read collaborators" ON public.collaborators;
CREATE POLICY "Authenticated read collaborators"
  ON public.collaborators FOR SELECT TO authenticated
  USING (true);

-- Editors and admins register / update.
DROP POLICY IF EXISTS "Editors insert collaborators" ON public.collaborators;
CREATE POLICY "Editors insert collaborators"
  ON public.collaborators FOR INSERT TO authenticated
  WITH CHECK (public.can_edit(auth.uid()));
DROP POLICY IF EXISTS "Editors update collaborators" ON public.collaborators;
CREATE POLICY "Editors update collaborators"
  ON public.collaborators FOR UPDATE TO authenticated
  USING (public.can_edit(auth.uid()))
  WITH CHECK (public.can_edit(auth.uid()));

-- Only admins can hard-delete. Prefer toggling active=false for audit.
DROP POLICY IF EXISTS "Admin delete collaborators" ON public.collaborators;
CREATE POLICY "Admin delete collaborators"
  ON public.collaborators FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));

-- updated_at trigger (reuses the existing public.update_updated_at_column()
-- created in migration 20260711020046).
DROP TRIGGER IF EXISTS update_collaborators_updated_at ON public.collaborators;
CREATE TRIGGER update_collaborators_updated_at
  BEFORE UPDATE ON public.collaborators
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
