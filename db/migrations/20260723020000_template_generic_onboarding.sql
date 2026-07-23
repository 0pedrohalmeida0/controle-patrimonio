-- ============ TEMPLATE-GENERIC ONBOARDING ============
-- Substitui o `handle_new_user()` da migration 20260711020046 (que restringia
-- cadastro ao domínio `mor.com.br`) por uma versão genérica, adequada ao
-- template MIT.
--
-- Comportamento:
--   - Aceita qualquer email (sem domain check)
--   - Cria a row em `public.profiles` a partir de `raw_user_meta_data->>'full_name'`
--     ou cai pro email se o user não preencheu o nome no sign-up
--   - Bootstrap seguro: o primeiro user que se cadastrar vira `administrador`;
--     os demais viram `leitor` por default. O admin pode promover depois via
--     `INSERT INTO user_roles ...`.
--
-- Idempotente: `CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS` +
-- `CREATE TRIGGER` cobrem re-aplicações.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_exists boolean;
BEGIN
  -- 1. Profile mirror (nome vem de raw_user_meta_data, fallback pro email)
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;  -- idempotente: sign-up repetido não quebra

  -- 2. Default role: bootstrap seguro
  --    Primeiro user do projeto vira administrador (pra você não ficar
  --    trancado fora). Os demais viram `leitor` por default; admin promove
  --    via UI ou SQL.
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'administrador')
    INTO admin_exists;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE WHEN admin_exists THEN 'leitor'::app_role ELSE 'administrador'::app_role END
  )
  ON CONFLICT (user_id, role) DO NOTHING;  -- idempotente

  RETURN NEW;
END;
$$;

-- Re-cria o trigger pra garantir que ele está usando a nova versão da função
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
