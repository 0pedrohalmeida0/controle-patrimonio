"""Conftest para os testes.

Garante que as variáveis de ambiente mínimas existam ANTES do
``Settings`` do pydantic-settings ser instanciado, e isola cada
teste de singletons globais (clientes Supabase).
"""

from __future__ import annotations

import os

# Variáveis mínimas para o ``Settings()`` não falhar ao importar ``app.config``.
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon-key-for-tests")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-for-tests")
os.environ.setdefault("BACKEND_CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("PORT", "8000")
os.environ.setdefault("LOG_LEVEL", "WARNING")

# Importa depois de setar env.
from app import supabase as supabase_module  # noqa: E402
from app.config import get_settings  # noqa: E402

settings = get_settings()


import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_supabase_singletons():
    """Cada teste começa com os clientes ``None`` (sem I/O real)."""
    supabase_module.reset_clients()
    yield
    supabase_module.reset_clients()
