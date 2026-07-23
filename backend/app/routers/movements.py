"""Movimentações (kiosk) + devoluções com problema."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import (
    UserContext,
    require_editor,
    require_kiosk_or_above,
)
from app.models import (
    MovementIn,
    MovementOut,
    PaginatedResponse,
    ReturnWithProblemIn,
)
from app.routers._helpers import raise_on_supabase_error, range_for_page
from app.supabase import SupabaseClients, get_clients

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/movements", tags=["movements"])


_SELECT = (
    "*, assets(id, number, type_id, asset_types(code, name)),"
    " collaborators(id, full_name, badge_number)"
)


@router.get(
    "",
    response_model=PaginatedResponse[MovementOut],
    summary="Histórico de movimentações (paginado, com filtros)",
)
def list_movements(
    asset_id: Optional[str] = Query(default=None),
    collaborator_id: Optional[str] = Query(default=None),
    range_from: Optional[str] = Query(default=None, alias="from", description="ISO 8601"),
    range_to: Optional[str] = Query(default=None, alias="to", description="ISO 8601"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=200),
    _: UserContext = Depends(require_kiosk_or_above),
) -> PaginatedResponse[MovementOut]:
    clients: SupabaseClients = get_clients()
    query = (
        clients.admin.table("movements")
        .select(_SELECT, count="exact")
        .order("created_at", desc=True)
    )
    if asset_id:
        query = query.eq("asset_id", asset_id)
    if collaborator_id:
        query = query.eq("collaborator_id", collaborator_id)
    if range_from:
        query = query.gte("created_at", range_from)
    if range_to:
        query = query.lte("created_at", range_to)

    start, end = range_for_page(page, size)
    response = query.range(start, end).execute()
    return PaginatedResponse[MovementOut](
        items=[MovementOut.model_validate(r) for r in (response.data or [])],
        total=response.count or 0,
        page=page,
        size=size,
    )


@router.post(
    "",
    response_model=MovementOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registra movimentação (kiosk/editor/admin)",
)
def create_movement(
    payload: MovementIn,
    user: UserContext = Depends(require_kiosk_or_above),
) -> MovementOut:
    """Delega para a RPC ``kiosk_register_movement`` (service_role)."""
    clients: SupabaseClients = get_clients()
    try:
        rpc_resp = clients.admin.rpc(
            "kiosk_register_movement",
            {
                "_asset_id": payload.asset_id,
                "_collaborator_id": payload.collaborator_id,
                "_type": payload.type,
                "_holder": payload.holder,
            },
        ).execute()
    except Exception as exc:  # noqa: BLE001
        raise_on_supabase_error(exc, "Falha ao registrar movimentação")

    movement_id = (rpc_resp.data or [None])[0] if isinstance(rpc_resp.data, list) else rpc_resp.data
    if not movement_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A RPC não retornou o ID da movimentação",
        )

    logger.info(
        "Movimentação registrada user=%s asset=%s type=%s id=%s",
        user.user_id,
        payload.asset_id,
        payload.type,
        movement_id,
    )
    response = (
        clients.admin.table("movements")
        .select(_SELECT)
        .eq("id", movement_id)
        .maybe_single()
        .execute()
    )
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Movimentação registrada mas não encontrada",
        )
    return MovementOut.model_validate(response.data)


@router.post(
    "/return-with-problem",
    response_model=MovementOut,
    status_code=status.HTTP_201_CREATED,
    summary="Devolução com problema (editor+)",
)
def return_with_problem(
    payload: ReturnWithProblemIn,
    user: UserContext = Depends(require_editor),
) -> MovementOut:
    """Delega para a RPC ``return_with_problem`` (atômica, service_role)."""
    clients: SupabaseClients = get_clients()
    try:
        rpc_resp = clients.admin.rpc(
            "return_with_problem",
            {
                "_asset_id": payload.asset_id,
                "_holder": payload.holder,
                "_description": payload.description,
                "_reported_by": payload.reported_by,
                "_note": payload.note,
            },
        ).execute()
    except Exception as exc:  # noqa: BLE001
        raise_on_supabase_error(exc, "Falha ao registrar devolução com problema")

    movement_id = (rpc_resp.data or [None])[0] if isinstance(rpc_resp.data, list) else rpc_resp.data
    if not movement_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A RPC não retornou o ID da movimentação",
        )

    logger.info(
        "Devolução com problema registrada user=%s asset=%s id=%s",
        user.user_id,
        payload.asset_id,
        movement_id,
    )
    response = (
        clients.admin.table("movements")
        .select(_SELECT)
        .eq("id", movement_id)
        .maybe_single()
        .execute()
    )
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Movimentação registrada mas não encontrada",
        )
    return MovementOut.model_validate(response.data)
