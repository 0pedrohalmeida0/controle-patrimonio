"""Rotas HTTP do backend, organizadas por recurso."""

from app.routers import (  # noqa: F401
    asset_types,
    assets,
    collaborators,
    me,
    movements,
    problems,
    users,
)
