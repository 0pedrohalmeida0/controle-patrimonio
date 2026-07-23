"""Ponto de entrada do FastAPI: app + lifespan + CORS + error handler.

Para rodar local:

    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

from app.config import get_settings
from app.routers import asset_types, assets, collaborators, me, movements, problems, users
from app.supabase import init_clients

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Inicializa e derruba recursos compartilhados (clientes Supabase)."""
    settings = get_settings()
    logging.basicConfig(
        level=settings.LOG_LEVEL.upper(),
        format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
    )
    logger.info("Iniciando backend (env=%s, port=%s)", settings.ENV, settings.PORT)
    init_clients(settings)
    try:
        yield
    finally:
        logger.info("Encerrando backend")


def _cors_origins() -> list[str]:
    """Lê CORS lazy — assim testes sem env completo ainda importam o módulo."""
    try:
        return get_settings().BACKEND_CORS_ORIGINS
    except Exception:  # noqa: BLE001
        return []

app = FastAPI(
    title="Controle Patrimônio — API",
    version="0.1.0",
    description=(
        "Backend do template genérico de controle de patrimônio físico. "
        "Todas as rotas (exceto /health) exigem `Authorization: Bearer <jwt>`."
    ),
    lifespan=lifespan,
    openapi_tags=[
        {"name": "me", "description": "Identidade e papel do usuário atual"},
        {"name": "asset-types", "description": "Tipos de equipamento"},
        {"name": "assets", "description": "Ativos físicos"},
        {"name": "movements", "description": "Movimentações (kiosk + devolução com problema)"},
        {"name": "problems", "description": "Problemas reportados"},
        {"name": "collaborators", "description": "Colaboradores (usuários de equipamento)"},
        {"name": "users", "description": "Gestão de usuários (admin)"},
    ],
)

# ----- CORS ------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----- Logging estruturado por request ---------------------------------------


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Loga UMA linha por request com método, path, status e duração."""
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = (time.perf_counter() - start) * 1000
        logger.exception(
            "request failed method=%s path=%s duration_ms=%.1f",
            request.method,
            request.url.path,
            duration_ms,
        )
        raise
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "request method=%s path=%s status=%s duration_ms=%.1f",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


# ----- Exception handler genérico --------------------------------------------


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handler genérico: loga stack trace e devolve 500 com mensagem em PT-BR."""
    logger.exception(
        "Erro não tratado em %s %s: %s", request.method, request.url.path, exc
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Erro interno do servidor"},
    )


# ----- Healthcheck (fora de /api/v1) -----------------------------------------


@app.get("/health", tags=["health"], summary="Healthcheck público")
def health() -> dict:
    return {"ok": True}


# ----- Routers ---------------------------------------------------------------

API_PREFIX = "/api/v1"
app.include_router(me.router, prefix=API_PREFIX)
app.include_router(asset_types.router, prefix=API_PREFIX)
app.include_router(assets.router, prefix=API_PREFIX)
app.include_router(movements.router, prefix=API_PREFIX)
app.include_router(problems.router, prefix=API_PREFIX)
app.include_router(collaborators.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)


def list_routes() -> list[dict]:
    """Helper para introspecção (testes, healthcheck, debug)."""
    out: list[dict] = []
    for route in app.routes:
        if isinstance(route, APIRoute):
            out.append(
                {
                    "path": route.path,
                    "methods": sorted(route.methods or []),
                    "name": route.name,
                }
            )
    return out
