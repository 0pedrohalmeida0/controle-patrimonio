/**
 * AuthProvider — gerencia sessão, role e perfil do usuário.
 *
 * Decisões:
 *   - `session` / `user` ficam no state do React (memória) e também no
 *     localStorage via Supabase (que persiste por padrão). Para
 *     24/7-kiosk isso é aceitável; troque por httpOnly cookies em prod.
 *   - NÃO restringimos domínio de e-mail aqui (versão genérica do template).
 *   - `role` é resolvido via `/api/v1/me`, que por sua vez lê
 *     `public.user_roles` com service_role.
 *   - `signUp` NÃO cria profile via RPC: a tabela `profiles` deve ter
 *     trigger de insert-on-auth-user, OU o admin cria manualmente
 *     (documentado no README principal). Mantemos o signup simples.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "./supabase";
import { api, setApiTokenProvider } from "./api";
import type { AppRole, MeResponse } from "./types";

export interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  fullName: string | null;
  isAdmin: boolean;
  isKiosk: boolean;
  canEdit: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isKiosk, setIsKiosk] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  // Expõe o token atual para o wrapper `api`.
  useEffect(() => {
    setApiTokenProvider(() => session?.access_token ?? null);
  }, [session]);

  const refreshProfile = useCallback(async () => {
    if (!session?.access_token) {
      setRole(null);
      setFullName(null);
      setIsAdmin(false);
      setIsKiosk(false);
      setCanEdit(false);
      return;
    }
    try {
      const me = await api.get<MeResponse>("/api/v1/me");
      if (me.active === false) {
        await supabase.auth.signOut();
        return;
      }
      setRole(me.role);
      setFullName(me.full_name);
      setIsAdmin(me.is_admin);
      setIsKiosk(me.is_kiosk);
      setCanEdit(me.can_edit);
    } catch {
      // Falha ao carregar perfil: deixa como está (provavelmente sem permissão).
      setRole(null);
      setFullName(null);
      setIsAdmin(false);
      setIsKiosk(false);
      setCanEdit(false);
    }
  }, [session]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Quando a sessão muda (login, logout, refresh), recarrega o perfil.
  useEffect(() => {
    if (loading) return;
    void refreshProfile();
  }, [loading, refreshProfile, session?.access_token]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      if (/invalid/i.test(error.message)) {
        throw new Error("E-mail ou senha incorretos.");
      }
      if (/network/i.test(error.message)) {
        throw new Error("Falha de rede. Verifique sua conexão.");
      }
      throw new Error(error.message);
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, fullNameValue: string) => {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullNameValue.trim() },
        },
      });
      if (error) {
        if (/already/i.test(error.message)) {
          throw new Error("Já existe um usuário com este e-mail.");
        }
        if (/weak|password/i.test(error.message)) {
          throw new Error("Senha muito fraca (mínimo 6 caracteres).");
        }
        throw new Error(error.message);
      }
      // O trigger de `handle_new_user` (se existir) cria o profile.
      // Caso contrário, o admin cria via SQL — ver README principal.
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole(null);
    setFullName(null);
    setIsAdmin(false);
    setIsKiosk(false);
    setCanEdit(false);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      user,
      role,
      fullName,
      isAdmin,
      isKiosk,
      canEdit,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [
      loading,
      session,
      user,
      role,
      fullName,
      isAdmin,
      isKiosk,
      canEdit,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de <AuthProvider>.");
  }
  return ctx;
}

/** Hook auxiliar que dispara `refreshProfile` na primeira montagem. */
export function useProfile(): void {
  const { loading, session, refreshProfile } = useAuth();
  useEffect(() => {
    if (loading || !session) return;
    void refreshProfile();
  }, [loading, session, refreshProfile]);
}
