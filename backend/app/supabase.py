"""Clientes Supabase (anon e service_role).

Dois clientes são inicializados via lifespan do FastAPI:

- ``supabase_anon`` — usa ``SUPABASE_ANON_KEY``. Usado para chamadas que
  respeitam RLS (validação adicional de permissão pelo banco).
- ``supabase_admin`` — usa ``SUPABASE_SERVICE_ROLE_KEY``. Usado **apenas**
  para chamar as 3 RPCs SECURITY DEFINER (``kiosk_register_movement``,
  ``register_problem``, ``return_with_problem``, ``set_user_role``) e
  para o endpoint admin de listagem de usuários.

O backend NUNCA usa ``supabase_admin`` para CRUD normal — o RLS do banco
é a fonte da verdade. O service_role é a exceção consciente para fechar
a lacuna entre "verificado pelo backend" e "executar como superuser".
"""

from __future__ import annotations

import logging
from typing import Optional

from supabase import Client, create_client

from app.config import Settings

logger = logging.getLogger(__name__)


class SupabaseClients:
    """Container para os dois clientes. Acessado via ``app.state.supabase``."""

    def __init__(self, anon: Client, admin: Client) -> None:
        self.anon = anon
        self.admin = admin


_clients: Optional[SupabaseClients] = None


def init_clients(settings: Settings) -> SupabaseClients:
    """Cria e armazena os clientes Supabase. Chamado pelo lifespan."""
    global _clients
    if _clients is not None:
        return _clients

    logger.info("Inicializando clientes Supabase (URL=%s)", settings.SUPABASE_URL)

    anon = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    admin = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    _clients = SupabaseClients(anon=anon, admin=admin)
    return _clients


def get_clients() -> SupabaseClients:
    """Retorna os clientes inicializados. Falha se o lifespan não rodou."""
    if _clients is None:
        raise RuntimeError(
            "Clientes Supabase não foram inicializados. "
            "O lifespan do FastAPI precisa rodar antes (init_clients)."
        )
    return _clients


def reset_clients() -> None:
    """Reseta o estado global. Usado em testes."""
    global _clients
    _clients = None
