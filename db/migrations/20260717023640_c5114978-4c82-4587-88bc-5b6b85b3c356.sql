CREATE OR REPLACE FUNCTION public.can_kiosk(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('administrador', 'editor', 'kiosk')
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_kiosk(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_kiosk(uuid) TO authenticated;