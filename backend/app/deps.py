"""Dependências compartilhadas pelas rotas: verificação de JWT e RBAC.

Fluxo:

1. Cliente envia ``Authorization: Bearer <jwt>``.
2. ``get_current_user`` valida o JWT contra o JWKS do Supabase (cache
   em memória) — assinatura, ``exp`` e ``aud=authenticated``.
3. Carrega ``role`` do usuário em ``user_roles`` via ``supabase_admin``
   (cache por request). Como o cache vive no ``request.state``, a
   chamada ao banco é feita **uma vez** mesmo se múltiplas rotas
   dependem de ``current_user`` na mesma request.
4. ``require_role`` / ``require_admin`` / ``require_editor`` /
   ``require_kiosk_or_above`` / ``require_kiosk_or_editor_or_admin``
   são factories que retornam dependências do FastAPI já com a
   checagem de papel aplicada.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Callable, FrozenSet, List, Optional, Sequence

import httpx
from fastapi import Depends, Header, HTTPException, Request, status
from jose import jwt
from jose.exceptions import ExpiredSignatureError, JWTError

from app.config import Settings, get_settings
from app.permissions import (
    ADMIN_ROLES,
    EDITOR_ROLES,
    KIOSK_ROLES,
    is_valid_role,
)
from app.supabase import SupabaseClients, get_clients

logger = logging.getLogger(__name__)


# ----- UserContext -----------------------------------------------------------


@dataclass
class UserContext:
    """Identidade do usuário autenticado, com role já resolvido."""

    user_id: str
    email: Optional[str]
    role: Optional[str]

    @property
    def is_admin(self) -> bool:
        return self.role in ADMIN_ROLES

    @property
    def is_editor(self) -> bool:
        return self.role in EDITOR_ROLES

    @property
    def is_kiosk(self) -> bool:
        return self.role in KIOSK_ROLES

    @property
    def can_edit(self) -> bool:
        return self.role in EDITOR_ROLES

    @property
    def can_kiosk_action(self) -> bool:
        return self.role in KIOSK_ROLES


# ----- JWKS cache -------------------------------------------------------------


class _JWKSCache:
    """Cache simples do JWKS com TTL. Supabase raramente rotaciona chaves."""

    def __init__(self, ttl_seconds: int = 3600) -> None:
        self._ttl = ttl_seconds
        self._keys: Optional[dict] = None
        self._fetched_at: float = 0.0

    def get(self, jwks_url: str) -> dict:
        now = time.time()
        if self._keys is not None and (now - self._fetched_at) < self._ttl:
            return self._keys

        try:
            response = httpx.get(jwks_url, timeout=10.0)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.error("Falha ao buscar JWKS em %s: %s", jwks_url, exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Não foi possível validar a assinatura do token",
            ) from exc

        self._keys = response.json()
        self._fetched_at = now
        logger.info("JWKS atualizado de %s", jwks_url)
        return self._keys


_jwks_cache = _JWKSCache()


# ----- Helpers internos -------------------------------------------------------


def _extract_bearer(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cabeçalho Authorization ausente",
            headers={"WWW-Authenticate": "Bearer"},
        )
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cabeçalho Authorization deve ser 'Bearer <token>'",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return parts[1].strip()


def _decode_jwt(token: str, jwks_url: str) -> dict:
    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token malformado",
        ) from exc

    kid = unverified_header.get("kid")
    if not kid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cabeçalho do token sem 'kid'",
        )

    jwks = _jwks_cache.get(jwks_url)
    key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
    if key is None:
        # JWKS pode estar desatualizado — força refresh uma vez.
        _jwks_cache._keys = None
        jwks = _jwks_cache.get(jwks_url)
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
    if key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chave de assinatura não encontrada para o token",
        )

    try:
        return jwt.decode(
            token,
            key,
            algorithms=[unverified_header.get("alg", "RS256")],
            audience="authenticated",
        )
    except ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado",
        ) from exc
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token inválido: {exc}",
        ) from exc


def _load_role(
    clients: SupabaseClients, user_id: str
) -> Optional[str]:
    """Lê o role de ``user_roles`` via service_role. Retorna o de maior hierarquia."""
    try:
        response = (
            clients.admin.table("user_roles")
            .select("role")
            .eq("user_id", user_id)
            .execute()
        )
    except Exception as exc:  # noqa: BLE001 — supabase-py não tem exception chain clara
        logger.warning("Falha ao carregar role do user %s: %s", user_id, exc)
        return None

    roles: List[str] = [
        row["role"] for row in (response.data or []) if row.get("role")
    ]
    if not roles:
        return None

    # Hierarquia: administrador > editor > kiosk > leitor.
    priority = {"administrador": 4, "editor": 3, "kiosk": 2, "leitor": 1}
    roles.sort(key=lambda r: priority.get(r, 0), reverse=True)
    return roles[0] if is_valid_role(roles[0]) else None


# ----- Dependência principal --------------------------------------------------


def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> UserContext:
    """Dependência base: valida JWT e resolve role. Cacheia no ``request.state``."""
    cached = getattr(request.state, "user", None)
    if cached is not None:
        return cached

    token = _extract_bearer(authorization)
    claims = _decode_jwt(token, settings.jwks_url)

    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token não contém 'sub'",
        )

    email = claims.get("email")
    clients = get_clients()
    role = _load_role(clients, user_id)

    user = UserContext(user_id=user_id, email=email, role=role)
    request.state.user = user
    return user


# ----- Factories de role check -----------------------------------------------


def require_role(*allowed: str) -> Callable[[UserContext], UserContext]:
    """Factory: retorna dependência que exige role ∈ ``allowed``.

    Usado quando a rota aceita múltiplos papéis. Lança 403 com mensagem
    em PT-BR se o role não bate.
    """
    allowed_set: FrozenSet[str] = frozenset(allowed)
    if not allowed_set:
        raise ValueError("require_role precisa de ao menos um role")

    def _dep(user: UserContext = Depends(get_current_user)) -> UserContext:
        if user.role is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuário sem papel definido — contate um administrador",
            )
        if user.role not in allowed_set:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Seu perfil não tem permissão para esta operação",
            )
        return user

    return _dep


def require_admin(
    user: UserContext = Depends(get_current_user),
) -> UserContext:
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores",
        )
    return user


def require_editor(
    user: UserContext = Depends(get_current_user),
) -> UserContext:
    if not user.can_edit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seu perfil não tem permissão para editar",
        )
    return user


def require_kiosk_or_above(
    user: UserContext = Depends(get_current_user),
) -> UserContext:
    """Kiosk, editor ou administrador (qualquer operador de quiosque)."""
    if not user.can_kiosk_action:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Seu perfil não tem permissão para registrar movimentações "
                "no quiosque"
            ),
        )
    return user


def require_kiosk_or_editor_or_admin(
    user: UserContext = Depends(get_current_user),
) -> UserContext:
    """Alias semântico de ``require_kiosk_or_above`` (consistência com DESIGN.md)."""
    return require_kiosk_or_above(user)
