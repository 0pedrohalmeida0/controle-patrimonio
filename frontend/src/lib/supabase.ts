import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Singleton Supabase client.
 *
 * Uses the publishable / anon key. The JWT from `supabase.auth` is injected
 * automatically by the JS client into Realtime and Auth calls. For
 * authorization on the backend, the same JWT is forwarded as
 * `Authorization: Bearer <jwt>` by `lib/api.ts`.
 *
 * The Supabase JS client persists the session in localStorage by default.
 * For this template that's acceptable (kiosk 24/7 machines still want a
 * session across reloads). For higher-security deployments, swap to the
 * server-side cookie flow (`@supabase/ssr`) or httpOnly cookies.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // We don't throw at import time (would break the bundle) — the Auth
  // provider surfaces a friendly message instead.
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não definidos. " +
      "Defina-os no .env antes de usar o app.",
  );
}

export const supabase: SupabaseClient = createClient(url ?? "", anonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 5,
    },
  },
});
