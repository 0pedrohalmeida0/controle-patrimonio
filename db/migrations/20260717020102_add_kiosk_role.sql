-- ============ ROLE 'kiosk' PARA O QUIOSQUE ============
-- O quiosque roda num tablet dedicado e é operado pelos próprios
-- colaboradores. Criamos uma role dedicada para que o user do quiosque
-- tenha acesso APENAS ao quiosque:
--
--   - Pode registrar movimentações (via RPC SECURITY DEFINER, que roda
--     como service_role e bypassa RLS)
--   - NÃO pode criar/editar problems, ativos, tipos, colaboradores
--   - NÃO pode acessar páginas restritas (UI bloqueia via role check)
--
-- RLS existente já garante que kiosk (que não está em can_edit) não
-- consegue fazer mutations. O kioskRegisterMovement no servidor valida
-- can_kiosk() e roda o commit como service_role, então RLS não bloqueia.

-- Idempotente: ADD VALUE IF NOT EXISTS existe a partir do PG 9.6, mas
-- só é permitido fora de transação. Wrap num DO block defensivo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'kiosk'
      AND enumtypid = 'public.app_role'::regtype
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'kiosk';
  END IF;
END $$;

-- Helper que retorna true para kiosk, editor e administrador.
-- Leitor NÃO passa (não é operador de quiosque).
CREATE OR REPLACE FUNCTION public.can_kiosk(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('administrador', 'editor', 'kiosk')
  )
$$;

GRANT EXECUTE ON FUNCTION public.can_kiosk(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_kiosk(uuid) FROM anon, public;

-- O user kiosk pode ser criado como qualquer outro user pelo admin
-- (Supabase Dashboard → Authentication → Users). Após criar, promova
-- com: `INSERT INTO user_roles (user_id, role) VALUES ('<uuid>', 'kiosk');`
-- O handle_new_user() genérico (definido na migration
-- 20260723020000_template_generic_onboarding.sql) aceita qualquer email
-- e cria a row em `profiles` automaticamente.
