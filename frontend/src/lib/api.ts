/**
 * Wrapper `api<T>(path, init?)` com:
 *   - Injeção de `Authorization: Bearer <jwt>` (do AuthContext)
 *   - `Content-Type: application/json`
 *   - Refresh automático em 401 (uma vez)
 *   - Mensagens de erro em PT-BR
 *
 * Mutações passam por aqui. Leituras em tempo real vão pelo Supabase
 * Realtime direto (ver `lib/realtime.ts`).
 */

import { supabase } from "./supabase";

let getToken: () => string | null = () => null;

export function setApiTokenProvider(fn: () => string | null): void {
  getToken = fn;
}

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

if (!baseUrl) {
  // eslint-disable-next-line no-console
  console.warn(
    "[api] VITE_API_BASE_URL não definido. Configure o .env antes de usar.",
  );
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function translateError(status: number, body: unknown): string {
  if (status === 401) return "Sessão expirada. Faça login novamente.";
  if (status === 403) return "Você não tem permissão para esta ação.";
  if (status === 404) return "Recurso não encontrado.";
  if (status === 409) return "Conflito com o estado atual.";
  if (status >= 500) return "Erro no servidor. Tente novamente em instantes.";

  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.detail === "string") return b.detail;
    if (typeof b.message === "string") return b.message;
    if (Array.isArray(b.detail)) {
      // FastAPI validation error
      const first = b.detail[0] as Record<string, unknown> | undefined;
      if (first && typeof first.msg === "string") return first.msg;
    }
  }
  return "Algo deu errado. Tente novamente.";
}

async function call<T>(
  path: string,
  init: RequestInit | undefined,
  retried: boolean,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(baseUrl + path, { ...init, headers });
  } catch {
    throw new ApiError("Falha de rede. Verifique sua conexão.", 0, null);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (response.status === 401 && !retried) {
    // tenta refresh uma vez
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) {
      return call<T>(path, init, true);
    }
    throw new ApiError(translateError(401, body), 401, body);
  }

  if (!response.ok) {
    throw new ApiError(translateError(response.status, body), response.status, body);
  }
  return body as T;
}

export async function api<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  return call<T>(path, init, false);
}

api.get = <T = unknown>(path: string, init?: RequestInit) =>
  api<T>(path, { ...init, method: "GET" });

api.post = <T = unknown>(path: string, body?: unknown, init?: RequestInit) =>
  api<T>(path, {
    ...init,
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

api.patch = <T = unknown>(path: string, body?: unknown, init?: RequestInit) =>
  api<T>(path, {
    ...init,
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

api.put = <T = unknown>(path: string, body?: unknown, init?: RequestInit) =>
  api<T>(path, {
    ...init,
    method: "PUT",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

api.delete = <T = unknown>(path: string, init?: RequestInit) =>
  api<T>(path, { ...init, method: "DELETE" });

export default api;
