"""CRUD de ``asset_types`` (tipos de equipamento)."""

from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import UserContext, require_admin, require_editor
from app.models import AssetTypeIn, AssetTypeOut, AssetTypePatch, PaginatedResponse
from app.routers._helpers import not_found, range_for_page
from app.supabase import SupabaseClients, get_clients

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/asset-types", tags=["asset-types"])


@router.get(
    "",
    response_model=List[AssetTypeOut] | PaginatedResponse[AssetTypeOut],
    summary="Lista tipos de equipamento",
)
def list_asset_types(
    page: Optional[int] = Query(default=None, ge=1, description="Se setado, devolve paginado"),
    size: int = Query(default=50, ge=1, le=200),
    _: UserContext = Depends(require_editor),
) -> object:
    """Sem ``page``: devolve a lista completa. Com ``page``: envelope paginado."""
    clients: SupabaseClients = get_clients()
    query = clients.admin.table("asset_types").select("*", count="exact").order("name")

    if page is None:
        response = query.execute()
        return [AssetTypeOut.model_validate(row) for row in (response.data or [])]

    start, end = range_for_page(page, size)
    response = query.range(start, end).execute()
    total = response.count or 0
    return PaginatedResponse[AssetTypeOut](
        items=[AssetTypeOut.model_validate(r) for r in (response.data or [])],
        total=total,
        page=page,
        size=size,
    )


@router.post(
    "",
    response_model=AssetTypeOut,
    status_code=status.HTTP_201_CREATED,
    summary="Cria um tipo de equipamento",
)
def create_asset_type(
    payload: AssetTypeIn,
    _: UserContext = Depends(require_editor),
) -> AssetTypeOut:
    clients: SupabaseClients = get_clients()
    response = clients.admin.table("asset_types").insert(payload.model_dump()).execute()
    rows = response.data or []
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível criar o tipo de equipamento",
        )
    return AssetTypeOut.model_validate(rows[0])


@router.patch(
    "/{type_id}",
    response_model=AssetTypeOut,
    summary="Atualiza parcialmente um tipo de equipamento",
)
def update_asset_type(
    type_id: str,
    payload: AssetTypePatch,
    _: UserContext = Depends(require_editor),
) -> AssetTypeOut:
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum campo para atualizar",
        )
    clients: SupabaseClients = get_clients()
    response = (
        clients.admin.table("asset_types")
        .update(data)
        .eq("id", type_id)
        .execute()
    )
    rows = response.data or []
    if not rows:
        raise not_found("Tipo de equipamento", type_id)
    return AssetTypeOut.model_validate(rows[0])


@router.delete(
    "/{type_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove um tipo de equipamento",
)
def delete_asset_type(
    type_id: str,
    _: UserContext = Depends(require_admin),
) -> None:
    clients: SupabaseClients = get_clients()
    response = (
        clients.admin.table("asset_types")
        .delete()
        .eq("id", type_id)
        .execute()
    )
    if not response.data:
        raise not_found("Tipo de equipamento", type_id)
