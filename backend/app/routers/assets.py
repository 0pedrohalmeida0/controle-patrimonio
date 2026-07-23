"""CRUD de ``assets`` (ativos) + filtros por type_id, status e busca textual."""

from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import UserContext, require_admin, require_editor
from app.models import AssetIn, AssetOut, AssetPatch, AssetTypeEmbedded, PaginatedResponse
from app.routers._helpers import not_found, range_for_page
from app.supabase import SupabaseClients, get_clients

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/assets", tags=["assets"])


_SELECT = "*, asset_types(*)"


def _embed(row: dict) -> dict:
    """Garante o formato do embedded (snake_case) e remove duplicatas."""
    if "asset_types" in row and row["asset_types"]:
        row["asset_types"] = {
            k: v
            for k, v in row["asset_types"].items()
            if k in {"id", "code", "name", "multi_use_per_day"}
        }
    return row


@router.get(
    "",
    response_model=PaginatedResponse[AssetOut],
    summary="Lista ativos (paginado, com filtros)",
)
def list_assets(
    type_id: Optional[str] = Query(default=None, description="Filtra por tipo"),
    status_filter: Optional[str] = Query(
        default=None,
        alias="status",
        description="available | in_use | problem",
    ),
    q: Optional[str] = Query(default=None, description="Busca textual (number/code)"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=200),
    _: UserContext = Depends(require_editor),
) -> PaginatedResponse[AssetOut]:
    clients: SupabaseClients = get_clients()
    query = clients.admin.table("assets").select(_SELECT, count="exact").order("created_at", desc=True)

    if type_id:
        query = query.eq("type_id", type_id)
    if status_filter:
        query = query.eq("status", status_filter)
    if q:
        # Busca em ``number`` e em ``code`` (case-insensitive via ilike).
        like = f"%{q}%"
        query = query.or_(f"number.ilike.{like},code.ilike.{like}")

    start, end = range_for_page(page, size)
    response = query.range(start, end).execute()
    items = [AssetOut.model_validate(_embed(r)) for r in (response.data or [])]
    return PaginatedResponse[AssetOut](
        items=items,
        total=response.count or 0,
        page=page,
        size=size,
    )


@router.get(
    "/{asset_id}",
    response_model=AssetOut,
    summary="Detalhe de um ativo",
)
def get_asset(
    asset_id: str,
    _: UserContext = Depends(require_editor),
) -> AssetOut:
    clients: SupabaseClients = get_clients()
    response = (
        clients.admin.table("assets")
        .select(_SELECT)
        .eq("id", asset_id)
        .maybe_single()
        .execute()
    )
    if not response.data:
        raise not_found("Ativo", asset_id)
    return AssetOut.model_validate(_embed(response.data))


@router.post(
    "",
    response_model=AssetOut,
    status_code=status.HTTP_201_CREATED,
    summary="Cria um ativo",
)
def create_asset(
    payload: AssetIn,
    _: UserContext = Depends(require_editor),
) -> AssetOut:
    clients: SupabaseClients = get_clients()
    response = clients.admin.table("assets").insert(payload.model_dump()).execute()
    rows = response.data or []
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível criar o ativo",
        )
    # Refaz o fetch com embedded para devolver o asset_types.
    return get_asset(rows[0]["id"], _=_)  # type: ignore[arg-type]


@router.patch(
    "/{asset_id}",
    response_model=AssetOut,
    summary="Atualiza parcialmente um ativo",
)
def update_asset(
    asset_id: str,
    payload: AssetPatch,
    _: UserContext = Depends(require_editor),
) -> AssetOut:
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum campo para atualizar",
        )
    clients: SupabaseClients = get_clients()
    response = clients.admin.table("assets").update(data).eq("id", asset_id).execute()
    if not response.data:
        raise not_found("Ativo", asset_id)
    return get_asset(asset_id, _=_)  # type: ignore[arg-type]


@router.delete(
    "/{asset_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove um ativo",
)
def delete_asset(
    asset_id: str,
    _: UserContext = Depends(require_admin),
) -> None:
    clients: SupabaseClients = get_clients()
    response = clients.admin.table("assets").delete().eq("id", asset_id).execute()
    if not response.data:
        raise not_found("Ativo", asset_id)
