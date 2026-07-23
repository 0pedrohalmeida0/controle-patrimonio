"""Configurações carregadas do ambiente via pydantic-settings.

Variáveis esperadas (ver `backend/.env.example`):

- ``SUPABASE_URL`` — ex.: https://xxxx.supabase.co
- ``SUPABASE_ANON_KEY`` — chave pública/anon
- ``SUPABASE_SERVICE_ROLE_KEY`` — chave de serviço (NUNCA expor ao frontend)
- ``BACKEND_CORS_ORIGINS`` — lista CSV de origens permitidas no CORS
- ``PORT`` — porta do uvicorn (default 8000)
- ``ENV`` — ``dev`` | ``prod`` (opcional; só usado em logs)
- ``LOG_LEVEL`` — nível de log (default ``INFO``)
"""

from __future__ import annotations

from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configurações globais do backend."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        enable_decoding=False,
    )

    SUPABASE_URL: str = Field(..., description="URL do projeto Supabase")
    SUPABASE_ANON_KEY: str = Field(..., description="Chave anon/publicável do Supabase")
    SUPABASE_SERVICE_ROLE_KEY: str = Field(
        ..., description="Chave service_role (NUNCA expor ao frontend)"
    )

    BACKEND_CORS_ORIGINS: List[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://localhost:4173"],
        description="Origens CORS permitidas (CSV)",
    )

    PORT: int = Field(default=8000, description="Porta do uvicorn")
    ENV: str = Field(default="dev", description="Ambiente: dev | prod")
    LOG_LEVEL: str = Field(default="INFO", description="Nível de log")

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def _split_cors(cls, value: object) -> object:
        """Aceita CSV em string OU lista.

        ``pydantic-settings`` 2.13 tenta decodar a string como JSON
        antes de chamar validators; quando o valor não é JSON válido
        (ex.: ``http://x,http://y``), o parse levanta ``SettingsError``
        e o validator nem roda. Para contornar isso, sobrescrevemos a
        decodificação: se a string não começar com ``[``, tratamos como
        CSV puro. Caso comece com ``[``, devolvemos como está (será
        decodado normalmente).
        """
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return []
            if stripped.startswith("["):
                return value
            return [origin.strip() for origin in stripped.split(",") if origin.strip()]
        if isinstance(value, (list, tuple)):
            return [str(v).strip() for v in value if str(v).strip()]
        return value

    @field_validator("SUPABASE_URL")
    @classmethod
    def _validate_supabase_url(cls, value: str) -> str:
        if not value.startswith("http://") and not value.startswith("https://"):
            raise ValueError("SUPABASE_URL deve começar com http:// ou https://")
        return value.rstrip("/")

    @property
    def jwks_url(self) -> str:
        """URL do JWKS público do Supabase (usado para validar JWTs)."""
        return f"{self.SUPABASE_URL}/.well-known/jwks.json"

    @property
    def is_prod(self) -> bool:
        return self.ENV.lower() == "prod"


def get_settings() -> Settings:
    """Factory das configurações. Útil para testes (override via env)."""
    return Settings()  # type: ignore[call-arg]
