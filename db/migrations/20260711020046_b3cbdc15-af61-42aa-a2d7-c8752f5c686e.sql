-- ============ ROLES & PROFILES ============
CREATE TYPE public.app_role AS ENUM ('administrador', 'editor', 'leitor');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER HELPERS ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.can_edit(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('administrador','editor'))
$$;

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ NEW USER HANDLER: domain restriction + profile + default role ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE admin_exists boolean;
BEGIN
  -- domain restriction (defense in depth; UI also validates)
  IF lower(split_part(NEW.email, '@', 2)) <> 'mor.com.br' THEN
    RAISE EXCEPTION 'O cadastro é permitido apenas para colaboradores da Metalúrgica MOR.';
  END IF;

  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);

  -- first ever user becomes administrator (secure bootstrap, no hardcoded password)
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'administrador') INTO admin_exists;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN admin_exists THEN 'leitor'::app_role ELSE 'administrador'::app_role END);

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ PROFILES RLS ============
CREATE POLICY "Read own or admin reads all" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'administrador'));
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Admin updates any profile" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'administrador')) WITH CHECK (public.has_role(auth.uid(), 'administrador'));

-- ============ USER_ROLES RLS ============
CREATE POLICY "Read own roles or admin reads all" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'));
CREATE POLICY "Admin manages roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador')) WITH CHECK (public.has_role(auth.uid(), 'administrador'));

-- ============ REPLACE PUBLIC POLICIES ON EXISTING TABLES ============
-- asset_types
DROP POLICY IF EXISTS "Public read asset_types" ON public.asset_types;
DROP POLICY IF EXISTS "Public write asset_types" ON public.asset_types;
REVOKE ALL ON public.asset_types FROM anon;
CREATE POLICY "Authenticated read asset_types" ON public.asset_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors insert asset_types" ON public.asset_types FOR INSERT TO authenticated WITH CHECK (public.can_edit(auth.uid()));
CREATE POLICY "Editors update asset_types" ON public.asset_types FOR UPDATE TO authenticated USING (public.can_edit(auth.uid())) WITH CHECK (public.can_edit(auth.uid()));
CREATE POLICY "Admin delete asset_types" ON public.asset_types FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'administrador'));

-- assets
DROP POLICY IF EXISTS "Public read assets" ON public.assets;
DROP POLICY IF EXISTS "Public write assets" ON public.assets;
REVOKE ALL ON public.assets FROM anon;
CREATE POLICY "Authenticated read assets" ON public.assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors insert assets" ON public.assets FOR INSERT TO authenticated WITH CHECK (public.can_edit(auth.uid()));
CREATE POLICY "Editors update assets" ON public.assets FOR UPDATE TO authenticated USING (public.can_edit(auth.uid())) WITH CHECK (public.can_edit(auth.uid()));
CREATE POLICY "Admin delete assets" ON public.assets FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'administrador'));

-- movements
DROP POLICY IF EXISTS "Public read movements" ON public.movements;
DROP POLICY IF EXISTS "Public write movements" ON public.movements;
REVOKE ALL ON public.movements FROM anon;
CREATE POLICY "Authenticated read movements" ON public.movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors insert movements" ON public.movements FOR INSERT TO authenticated WITH CHECK (public.can_edit(auth.uid()));
CREATE POLICY "Admin delete movements" ON public.movements FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'administrador'));

-- problems
DROP POLICY IF EXISTS "Public read problems" ON public.problems;
DROP POLICY IF EXISTS "Public write problems" ON public.problems;
REVOKE ALL ON public.problems FROM anon;
CREATE POLICY "Authenticated read problems" ON public.problems FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors insert problems" ON public.problems FOR INSERT TO authenticated WITH CHECK (public.can_edit(auth.uid()));
CREATE POLICY "Editors update problems" ON public.problems FOR UPDATE TO authenticated USING (public.can_edit(auth.uid())) WITH CHECK (public.can_edit(auth.uid()));
CREATE POLICY "Admin delete problems" ON public.problems FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'administrador'));