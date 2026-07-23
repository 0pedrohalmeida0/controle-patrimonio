/**
 * Tipos compartilhados com o backend (ver `docs/DESIGN.md` §7).
 * Mantemos estes tipos em sincronia manual — não geramos do OpenAPI
 * automaticamente para manter o template simples.
 */

export type AssetStatus = "available" | "in_use" | "problem";
export type MovementType = "withdraw" | "return";
export type ProblemStatus = "open" | "resolved";
export type AppRole = "administrador" | "editor" | "leitor" | "kiosk";

export interface AssetType {
  id: string;
  code: string;
  name: string;
  multi_use_per_day: boolean;
  created_at: string;
}

export interface Asset {
  id: string;
  type_id: string;
  code: string;
  number: string;
  status: AssetStatus;
  current_holder: string | null;
  created_at: string;
  asset_types?: Pick<AssetType, "id" | "code" | "name" | "multi_use_per_day">;
}

export interface Movement {
  id: string;
  asset_id: string;
  collaborator_id: string | null;
  type: MovementType;
  holder: string;
  note: string | null;
  shift: number | null;
  created_at: string;
  assets?: Pick<Asset, "id" | "code" | "number" | "type_id"> & {
    asset_types?: Pick<AssetType, "id" | "code" | "name">;
  };
  collaborators?: Pick<Collaborator, "id" | "full_name" | "badge_number"> | null;
}

export interface Problem {
  id: string;
  asset_id: string;
  description: string;
  status: ProblemStatus;
  reported_by: string | null;
  created_at: string;
  resolved_at: string | null;
  assets?: Pick<Asset, "id" | "code" | "number" | "type_id"> & {
    asset_types?: Pick<AssetType, "id" | "code" | "name">;
  };
}

export interface Collaborator {
  id: string;
  full_name: string;
  badge_number: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  active: boolean;
  created_at: string;
}

export interface ManagedUser {
  id: string;
  email: string;
  full_name: string | null;
  active: boolean;
  role: AppRole | null;
  created_at: string;
}

export interface MeResponse {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole | null;
  is_admin: boolean;
  is_kiosk: boolean;
  can_edit: boolean;
  active: boolean;
}

/** Helper de rótulo humano para equipamento (`ATV-01`). */
export function formatAssetCode(
  asset: Pick<Asset, "number" | "code"> & {
    asset_types?: Pick<AssetType, "code">;
  },
): string {
  if (asset.asset_types?.code) {
    return `${asset.asset_types.code}-${asset.number}`;
  }
  return asset.code;
}

/** Mensagens de erro comuns já traduzidas. */
export const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "E-mail ou senha incorretos.",
  user_already_exists: "Já existe um usuário com este e-mail.",
  weak_password: "Senha muito fraca (mínimo 6 caracteres).",
  email_not_confirmed:
    "E-mail ainda não confirmado. Verifique sua caixa de entrada.",
  network_error: "Erro de rede. Verifique sua conexão.",
  unknown: "Algo deu errado. Tente novamente.",
  forbidden: "Você não tem permissão para esta ação.",
  not_found: "Recurso não encontrado.",
  conflict: "Conflito com o estado atual.",
};
