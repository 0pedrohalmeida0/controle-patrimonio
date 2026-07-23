"""Funções puras para checagem de role.

Mantemos a lógica de hierarquia num lugar só, sem I/O — útil para
documentação e para os helpers em ``app/deps.py``.

Hierarquia (do mais alto para o mais baixo):

- ``administrador``  — pode tudo
- ``editor``         — pode ler e mutar (exceto deletar em alguns casos)
- ``kiosk``          — pode registrar movimentações, sem mutar o resto
- ``leitor``         — só leitura

Os helpers abaixo retornam booleanos e são a base de ``require_role``.
"""

from __future__ import annotations

from typing import FrozenSet, Iterable, Optional

# Roles válidas no enum ``app_role`` (espelha o que está no SQL).
ALL_ROLES: FrozenSet[str] = frozenset(
    {"administrador", "editor", "leitor", "kiosk"}
)

# Agrupamentos por capacidade (espelham os helpers SQL ``can_edit``,
# ``can_kiosk`` e a checagem inline de ``has_role(..., 'administrador')``).
ADMIN_ROLES: FrozenSet[str] = frozenset({"administrador"})
EDITOR_ROLES: FrozenSet[str] = frozenset({"administrador", "editor"})
KIOSK_ROLES: FrozenSet[str] = frozenset({"administrador", "editor", "kiosk"})


def is_valid_role(role: Optional[str]) -> bool:
    return role is not None and role in ALL_ROLES


def is_admin(role: Optional[str]) -> bool:
    return role in ADMIN_ROLES


def can_edit(role: Optional[str]) -> bool:
    return role in EDITOR_ROLES


def can_kiosk(role: Optional[str]) -> bool:
    return role in KIOSK_ROLES


def can_read(role: Optional[str]) -> bool:
    """Qualquer role autenticada pode ler (incluindo ``kiosk`` e ``leitor``)."""
    return role in ALL_ROLES


def role_in(role: Optional[str], allowed: Iterable[str]) -> bool:
    return role is not None and role in set(allowed)
