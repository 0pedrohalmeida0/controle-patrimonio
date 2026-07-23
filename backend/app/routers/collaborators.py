"""CRUD de ``collaborators`` (colaboradores / usuários de equipamento)."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import UserContext, require_admin, require_editor
from app.models import (
    CollaboratorIn,
    CollaboratorOut,
    CollaboratorPatch,
    PaginatedResponse,
)
from app.routers._helpers import not_found, range_for_page
from app.supabase import SupabaseClients, get_clients

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/collaborators", tags=["collaborators"])


@router.get(
    "",
    response_model=PaginatedResponse[CollaboratorOut],
    summary="Lista colaboradores (paginado, busca e filtro active)",
)
def list_collaborators(
    q: Optional[str] = Query(default=None, description="Busca por nome ou badge"),
    active: Optional[bool] = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=200),
    _: UserContext = Depends(require_editor),
) -> PaginatedResponse[CollaboratorOut]:
    clients: SupabaseClients = get_clients()
    query = (
        clients.admin.table("collaborators")
        .select("*", count="exact")
        .order("full_name")
    )
    if active is not None:
        query = query.eq("active", active)
    if q:
        like = f"%{q}%"
        query = query.or_(f"full_name.ilike.{like},badge_number.ilike.{like}")

    start, end = range_for_page(page, size)
    response = query.range(start, end).execute()
    return PaginatedResponse[CollaboratorOut](
        items=[CollaboratorOut.model_validate(r) for r in (response.data or [])],
        total=response.count or 0,
        page=page,
        size=size,
    )


@router.post(
    "",
    response_model=CollaboratorOut,
    status_code=status.HTTP_201_CREATED,
    summary="Cria um colaborador",
)
def create_collaborator(
    payload: CollaboratorIn,
    _: UserContext = Depends(require_editor),
) -> CollaboratorOut:
    clients: SupabaseClients = get_clients()
    try:
        response = clients.admin.table("collaborators").insert(payload.model_dump()).execute()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Falha ao criar colaborador: {exc}",
        )
    rows = response.data or []
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível criar o colaborador",
        )
    return CollaboratorOut.model_validate(rows[0])


@router.patch(
    "/{collaborator_id}",
    response_model=CollaboratorOut,
    summary="Atualiza parcialmente um colaborador",
)
def update_collaborator(
    collaborator_id: str,
    payload: CollaboratorPatch,
    _: UserContext = Depends(require_editor),
) -> CollaboratorOut:
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum campo para atualizar",
        )
    clients: SupabaseClients = get_clients()
    try:
        response = (
            clients.admin.table("collaborators")
            .update(data)
            .eq("id", collaborator_id)
            .execute()
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Falha ao atualizar colaborador: {exc}",
        )
    rows = response.data or []
    if not rows:
        raise not_found("Colaborador", collaborator_id)
    return CollaboratorOut.model_validate(rows[0])


@router.delete(
    "/{collaborator_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove um colaborador",
)
def delete_collaborator(
    collaborator_id: str,
    _: UserContext = Depends(require_admin),
) -> None:
    clients: SupabaseClients = get_clients()
    response = (
        clients.admin.table("collaborators")
        .delete()
        .eq("id", collaborator_id)
        .execute()
    )
    if not response.data:
        raise not_found("Colaborador", collaborator_id)
