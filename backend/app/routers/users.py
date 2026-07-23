"""Rotas admin: listagem e gestão de usuários (papel + soft-delete)."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import UserContext, require_admin
from app.models import OkResponse, RoleUpdate, UserOut
from app.routers._helpers import not_found, raise_on_supabase_error
from app.supabase import SupabaseClients, get_clients

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])


# Mesma hierarquia usada em ``app/permissions`` — usada para escolher
# qual role representar quando o usuário tem múltiplas (e.g. foi admin
# mas estamos migrando para editor).
_ROLE_PRIORITY = {
    "administrador": 4,
    "editor": 3,
    "kiosk": 2,
    "leitor": 1,
}


def _pick_role(roles: List[str]) -> Optional[str]:
    if not roles:
        return None
    return sorted(roles, key=lambda r: _ROLE_PRIORITY.get(r, 0), reverse=True)[0]


@router.get(
    "",
    response_model=List[UserOut],
    summary="Lista todos os usuários (admin)",
)
def list_users(
    _admin: UserContext = Depends(require_admin),
) -> List[UserOut]:
    """Combina ``profiles`` + ``user_roles`` + ``auth.admin.listUsers``.

    Lógica portada do ``users.functions.ts`` original.
    """
    clients: SupabaseClients = get_clients()

    # Perfis + roles em paralelo.
    try:
        profiles_resp = (
            clients.admin.table("profiles")
            .select("id, full_name, email, active, created_at")
            .execute()
        )
        roles_resp = (
            clients.admin.table("user_roles")
            .select("user_id, role")
            .execute()
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Falha ao ler usuários: {exc}",
        )

    # Mapa user_id -> [roles]
    roles_by_user: Dict[str, List[str]] = {}
    for row in roles_resp.data or []:
        roles_by_user.setdefault(row["user_id"], []).append(row["role"])

    # Auth metadata (email_confirmed, last_sign_in_at) via admin API.
    auth_by_user: Dict[str, Dict[str, Any]] = {}
    try:
        auth_list = clients.admin.auth.admin.list_users(page=1, per_page=1000)
        for u in getattr(auth_list, "users", []) or []:
            auth_by_user[u.id] = {
                "email_confirmed": bool(getattr(u, "email_confirmed_at", None)),
                "last_sign_in_at": getattr(u, "last_sign_in_at", None),
            }
    except Exception as exc:  # noqa: BLE001
        # Não bloqueia a listagem; só perde o enrichment de auth.
        logger.warning("Falha ao listar auth.users: %s", exc)

    out: List[UserOut] = []
    for p in profiles_resp.data or []:
        meta = auth_by_user.get(p["id"], {})
        out.append(
            UserOut(
                id=p["id"],
                full_name=p.get("full_name"),
                email=p.get("email"),
                role=_pick_role(roles_by_user.get(p["id"], [])),
                active=bool(p.get("active", True)),
                email_confirmed=meta.get("email_confirmed", False),
                created_at=p["created_at"],
                last_sign_in_at=meta.get("last_sign_in_at"),
            )
        )
    out.sort(key=lambda u: (u.full_name or "").lower())
    return out


@router.post(
    "/{user_id}/role",
    response_model=OkResponse,
    summary="Define o papel de um usuário (admin)",
)
def set_user_role(
    user_id: str,
    payload: RoleUpdate,
    admin: UserContext = Depends(require_admin),
) -> OkResponse:
    """Chama a RPC ``set_user_role`` (transação atômica, service_role)."""
    if user_id == admin.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você não pode alterar o seu próprio perfil",
        )

    clients: SupabaseClients = get_clients()
    try:
        clients.admin.rpc(
            "set_user_role",
            {"_user_id": user_id, "_role": payload.role},
        ).execute()
    except Exception as exc:  # noqa: BLE001
        raise_on_supabase_error(exc, "Falha ao atualizar papel")

    logger.info("Papel %s aplicado ao user %s por %s", payload.role, user_id, admin.user_id)
    return OkResponse(ok=True)


@router.post(
    "/{user_id}/deactivate",
    response_model=OkResponse,
    summary="Desativa (soft-delete) um usuário (admin)",
)
def deactivate_user(
    user_id: str,
    admin: UserContext = Depends(require_admin),
) -> OkResponse:
    """Soft-delete: ``profiles.active = false``. Não mexe em auth.users."""
    if user_id == admin.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você não pode desativar a si mesmo",
        )

    clients: SupabaseClients = get_clients()
    try:
        response = (
            clients.admin.table("profiles")
            .update({"active": False})
            .eq("id", user_id)
            .execute()
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Falha ao desativar usuário: {exc}",
        )
    if not response.data:
        raise not_found("Usuário", user_id)

    logger.info("User %s desativado por %s", user_id, admin.user_id)
    return OkResponse(ok=True)
