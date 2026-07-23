-- Enable Realtime (Postgres CDC → WebSocket) on operational tables so the
-- frontend can react to changes from other users without polling.
--
-- Triggered by useRealtimeSync() in src/hooks/use-realtime-sync.ts.
-- Lovable does not expose a UI toggle for this, so it must be done via SQL.

-- The default 'supabase_realtime' publication is created automatically by
-- Supabase; we just add our tables to it. Idempotent so re-runs are safe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'assets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assets;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'movements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.movements;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'problems'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.problems;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'asset_types'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.asset_types;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'collaborators'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.collaborators;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_roles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
  END IF;
END $$;

-- Realtime only ships full row data for UPDATE/INSERT/DELETE on tables where
-- the authenticated role has SELECT permission. RLS still applies on the
-- client side, so subscribers only see rows they're allowed to read.
