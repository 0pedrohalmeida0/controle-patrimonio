CREATE TABLE public.collaborators (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name text NOT NULL,
  badge_number text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collaborators TO authenticated;
GRANT ALL ON public.collaborators TO service_role;

ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view collaborators"
  ON public.collaborators FOR SELECT TO authenticated USING (true);

CREATE POLICY "Editors can insert collaborators"
  ON public.collaborators FOR INSERT TO authenticated
  WITH CHECK (public.can_edit(auth.uid()));

CREATE POLICY "Editors can update collaborators"
  ON public.collaborators FOR UPDATE TO authenticated
  USING (public.can_edit(auth.uid())) WITH CHECK (public.can_edit(auth.uid()));

CREATE POLICY "Admins can delete collaborators"
  ON public.collaborators FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));

CREATE TRIGGER update_collaborators_updated_at
  BEFORE UPDATE ON public.collaborators
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.collaborators;