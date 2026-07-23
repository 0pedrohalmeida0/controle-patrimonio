"""Smoke tests do backend.

Validam:

1. O app importa sem erros.
2. O OpenAPI expõe **todas** as rotas listadas no ``docs/DESIGN.md``.
3. ``GET /health`` retorna 200 com ``{"ok": true}``.
"""

from __future__ import annotations

from typing import Set

from fastapi.testclient import TestClient

from app.main import app


# Rotas canônicas declaradas no DESIGN.md (seção 7). O path aqui é o do
# FastAPI, ou seja, SEM o prefixo ``/api/v1`` (o prefixo é adicionado
# em ``app.main``). Quando a rota tem path param, usamos ``{id}``.
EXPECTED_PATHS: Set[str] = {
    # /me
    "/api/v1/me",
    # /asset-types
    "/api/v1/asset-types",
    "/api/v1/asset-types/{type_id}",
    # /assets
    "/api/v1/assets",
    "/api/v1/assets/{asset_id}",
    # /movements
    "/api/v1/movements",
    "/api/v1/movements/return-with-problem",
    # /problems
    "/api/v1/problems",
    "/api/v1/problems/{problem_id}",
    # /collaborators
    "/api/v1/collaborators",
    "/api/v1/collaborators/{collaborator_id}",
    # /users
    "/api/v1/users",
    "/api/v1/users/{user_id}/role",
    "/api/v1/users/{user_id}/deactivate",
    # health (sem prefixo)
    "/health",
}


def _openapi_paths() -> Set[str]:
    schema = app.openapi()
    return set(schema.get("paths", {}).keys())


def test_app_imports():
    assert app.title.startswith("Controle Patrimônio")


def test_openapi_has_all_design_routes():
    """Garante que toda rota do DESIGN.md seção 7 está exposta no OpenAPI."""
    declared = _openapi_paths()
    missing = sorted(EXPECTED_PATHS - declared)
    assert not missing, f"Rotas faltando no OpenAPI: {missing}"


def test_openapi_contains_health_outside_api_v1():
    """O /health fica FORA de /api/v1 conforme contrato."""
    paths = _openapi_paths()
    assert "/health" in paths
    assert "/api/v1/health" not in paths


def test_openapi_tags_are_separated_per_resource():
    schema = app.openapi()
    tags = {tag["name"] for tag in schema.get("tags", [])}
    for required in {
        "me",
        "asset-types",
        "assets",
        "movements",
        "problems",
        "collaborators",
        "users",
    }:
        assert required in tags, f"Tag {required!r} ausente"


def test_health_returns_ok():
    """O healthcheck é público e não exige env real."""
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200, response.text
    assert response.json() == {"ok": True}


def test_route_count_is_sufficient():
    """Sanity check: tem que ter >= 15 paths reais no OpenAPI."""
    declared = _openapi_paths()
    # 1 por path (não por método). Filtra /openapi.json, /docs, /redoc, /docs/oauth2-redirect
    # que são boilerplate do FastAPI.
    real_paths = {
        p for p in declared
        if p not in {"/openapi.json", "/docs", "/redoc", "/docs/oauth2-redirect"}
    }
    # 15 paths (DESIGN.md §7) = 23 endpoints quando contado por método.
    assert len(real_paths) >= 15, (
        f"Esperava >= 15 paths reais, achei {len(real_paths)}: {real_paths}"
    )
    # E contagem por método >= 20 (5 CRUDs × 5 métodos ≈ 25).
    method_count = sum(
        len(methods) for methods in app.openapi()["paths"].values()
    )
    assert method_count >= 20, (
        f"Esperava >= 20 endpoints por método, achei {method_count}"
    )
