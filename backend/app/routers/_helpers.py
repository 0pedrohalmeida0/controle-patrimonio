"""Helpers compartilhados entre routers."""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from fastapi import HTTPException, status


def not_found(resource: str, identifier: Any) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"{resource} '{identifier}' não encontrado",
    )


def bad_request(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=message,
    )


def parse_pagination(page: int, size: int) -> Tuple[int, int]:
    """Garante limites razoáveis. Retorna ``(offset, limit)``."""
    if page < 1:
        raise bad_request("'page' deve ser >= 1")
    if size < 1 or size > 200:
        raise bad_request("'size' deve estar entre 1 e 200")
    return (page - 1) * size, size


def raise_on_supabase_error(error: Optional[Exception], default_msg: str = "Erro no banco") -> None:
    """Lança 400 com a mensagem do Supabase (que vem em PT-BR das RPCs)."""
    if error is None:
        return
    message = str(error)
    # Erros vindos das RPCs SECURITY DEFINER chegam como 'message'.
    # Mantemos o texto original (já em PT-BR).
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=message or default_msg,
    )


def range_for_page(page: int, size: int) -> Tuple[int, int]:
    """Shorthand para o range do PostgREST: ``from`` e ``to`` inclusivo."""
    offset, limit = parse_pagination(page, size)
    return offset, offset + limit - 1
