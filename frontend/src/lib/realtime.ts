/**
 * Helper de subscription ao Supabase Realtime.
 *
 * A UI monta um canal por tabela, e em cada evento (INSERT/UPDATE/DELETE)
 * dispara `onChange(payload)`. O caller geralmente invalida as queries
 * correspondentes do `@tanstack/react-query`.
 *
 * O token de acesso é injetado automaticamente pelo client Supabase a
 * partir da sessão atual — não precisa passar manualmente.
 */

import { useEffect } from "react";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import { supabase } from "./supabase";

type ChangePayload<T extends Record<string, unknown>> =
  RealtimePostgresChangesPayload<T>;

export function useRealtimeChannel<T extends Record<string, unknown>>(
  table: string,
  onChange: (payload: ChangePayload<T>) => void,
  filter?: string,
): void {
  useEffect(() => {
    let channel: RealtimeChannel;
    try {
      channel = supabase
        .channel(`public:${table}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            ...(filter ? { filter } : {}),
          },
          (payload) => onChange(payload as ChangePayload<T>),
        )
        .subscribe();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[realtime] falha ao subscrever ${table}:`, err);
      return;
    }
    return () => {
      try {
        void supabase.removeChannel(channel);
      } catch {
        // noop
      }
    };
    // onChange é responsabilidade do caller manter estável (useCallback) ou
    // re-subscrever intencionalmente.
  }, [table, filter, onChange]);
}
