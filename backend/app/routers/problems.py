"""Problemas de equipamentos."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import UserContext, require_editor
from app.models import ProblemIn, ProblemOut, ProblemPatch, PaginatedResponse
from app.routers._helpers import not_found, raise_on_supabase_error, range_for_page
from app.supabase import SupabaseClients, get_clients

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/problems", tags=["problems"])


_SELECT = "*, assets(id, number, type_id, asset_types(code, name))"


@router.get(
    "",
    response_model=PaginatedResponse[ProblemOut],
    summary="Lista problemas (paginado, com filtros)",
)
def list_problems(
    status_filter: Optional[str] = Query(
        default=None,
        alias="status",
        description="open | resolved",
    ),
    asset_id: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=200),
    _: UserContext = Depends(require_editor),
) -> PaginatedResponse[ProblemOut]:
    clients: SupabaseClients = get_clients()
    query = (
        clients.admin.table("problems")
        .select(_SELECT, count="exact")
        .order("created_at", desc=True)
    )
    if status_filter:
        query = query.eq("status", status_filter)
    if asset_id:
        query = query.eq("asset_id", asset_id)

    start, end = range_for_page(page, size)
    response = query.range(start, end).execute()
    return PaginatedResponse[ProblemOut](
        items=[ProblemOut.model_validate(r) for r in (response.data or [])],
        total=response.count or 0,
        page=page,
        size=size,
    )


@router.post(
    "",
    response_model=ProblemOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registra um problema (editor+)",
)
def create_problem(
    payload: ProblemIn,
    user: UserContext = Depends(require_editor),
) -> ProblemOut:
    """Delega para a RPC ``register_problem`` (atômica, service_role)."""
    clients: SupabaseClients = get_clients()
    try:
        rpc_resp = clients.admin.rpc(
            "register_problem",
            {
                "_asset_id": payload.asset_id,
                "_description": payload.description,
                "_reported_by": payload.reported_by,
            },
        ).execute()
    except Exception as exc:  # noqa: BLE001
        raise_on_supabase_error(exc, "Falha ao registrar problema")

    problem_id = (rpc_resp.data or [None])[0] if isinstance(rpc_resp.data, list) else rpc_resp.data
    if not problem_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A RPC não retornou o ID do problema",
        )

    logger.info(
        "Problema registrado user=%s asset=%s id=%s",
        user.user_id,
        payload.asset_id,
        problem_id,
    )
    response = (
        clients.admin.table("problems")
        .select(_SELECT)
        .eq("id", problem_id)
        .maybe_single()
        .execute()
    )
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Problema registrado mas não encontrado",
        )
    return ProblemOut.model_validate(response.data)


@router.patch(
    "/{problem_id}",
    response_model=ProblemOut,
    summary="Atualiza um problema (resolver é o caso comum)",
)
def update_problem(
    problem_id: str,
    payload: ProblemPatch,
    user: UserContext = Depends(require_editor),
) -> ProblemOut:
    """Por design, o único PATCH relevante é ``status=resolved``.

    Não existe RPC para isso — usamos UPDATE direto, setando
    ``resolved_at`` automaticamente quando o status passa a ``resolved``.
    """
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum campo para atualizar",
        )

    if data.get("status") == "resolved":
        data["resolved_at"] = datetime.now(timezone.utc).isoformat()
    elif data.get("status") == "open":
        data["resolved_at"] = None

    clients: SupabaseClients = get_clients()
    response = (
        clients.admin.table("problems")
        .update(data)
        .eq("id", problem_id)
        .execute()
    )
    rows = response.data or []
    if not rows:
        raise not_found("Problema", problem_id)

    # Re-fetch com embedded.
    fetch = (
        clients.admin.table("problems")
        .select(_SELECT)
        .eq("id", problem_id)
        .maybe_single()
        .execute()
    )
    if not fetch.data:
        raise not_found("Problema", problem_id)
    return ProblemOut.model_validate(fetch.data)
