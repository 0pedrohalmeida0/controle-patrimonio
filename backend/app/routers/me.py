"""``GET /me`` — identidade e role do usuário autenticado."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import UserContext, get_current_user
from app.models import MeOut
from app.supabase import SupabaseClients, get_clients

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/me", tags=["me"])


@router.get(
    "",
    response_model=MeOut,
    summary="Identidade e role do usuário atual",
)
def get_me(
    user: UserContext = Depends(get_current_user),
) -> MeOut:
    """Retorna o usuário autenticado com role resolvido.

    Lê ``profiles`` (best-effort) para devolver ``full_name``; se não
    existir perfil, devolve o que tiver do JWT.
    """
    clients: SupabaseClients = get_clients()
    full_name: str | None = None

    try:
        resp = (
            clients.admin.table("profiles")
            .select("full_name")
            .eq("id", user.user_id)
            .maybe_single()
            .execute()
        )
        if resp.data:
            full_name = resp.data.get("full_name")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Falha ao ler profile do user %s: %s", user.user_id, exc)

    return MeOut(
        id=user.user_id,
        email=user.email,
        full_name=full_name,
        role=user.role,
        is_admin=user.is_admin,
        is_kiosk=user.is_kiosk,
        can_edit=user.can_edit,
    )
