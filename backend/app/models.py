"""Schemas Pydantic v2 — request/response da API pública.

Convenção:

- Sufixo ``In``  → entrada do cliente (POST/PATCH).
- Sufixo ``Out`` → saída para o cliente (GET/POST response).
- ``Patch``      → body parcial de PATCH (todos os campos opcionais).
- Genéricos ``PaginatedResponse[T]`` para listas paginadas.

Os campos seguem o contrato do ``docs/DESIGN.md`` seção 7.
"""

from __future__ import annotations

from datetime import datetime
from typing import Generic, List, Literal, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


# ----- Genéricos -------------------------------------------------------------


class PaginatedResponse(BaseModel, Generic[T]):
    """Envelope padrão para listas paginadas."""

    items: List[T]
    total: int = Field(..., description="Total de registros (sem paginação)")
    page: int = Field(..., ge=1, description="Página atual (1-based)")
    size: int = Field(..., ge=1, description="Tamanho da página")


# ----- Auth / me -------------------------------------------------------------


class MeOut(BaseModel):
    """Resposta de ``GET /me``."""

    model_config = ConfigDict(from_attributes=True)

    id: str = Field(..., description="ID do usuário (auth.users)")
    email: Optional[str] = Field(default=None, description="Email do usuário")
    full_name: Optional[str] = Field(default=None, description="Nome completo (profiles)")
    role: Optional[str] = Field(default=None, description="Papel (app_role)")
    is_admin: bool = Field(..., description="Atalho: role == 'administrador'")
    is_kiosk: bool = Field(..., description="Atalho: role == 'kiosk'")
    can_edit: bool = Field(..., description="editor ou administrador")


# ----- Asset types -----------------------------------------------------------


class AssetTypeBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=64, description="Código curto único")
    name: str = Field(..., min_length=1, max_length=200, description="Nome legível")
    multi_use_per_day: bool = Field(
        default=False, description="Permite múltiplas retiradas no mesmo dia"
    )


class AssetTypeIn(AssetTypeBase):
    pass


class AssetTypePatch(BaseModel):
    code: Optional[str] = Field(default=None, min_length=1, max_length=64)
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    multi_use_per_day: Optional[bool] = None


class AssetTypeOut(AssetTypeBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime


# ----- Assets ----------------------------------------------------------------


class AssetTypeEmbedded(BaseModel):
    """Subset de ``asset_types`` embedded em ``AssetOut``."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str
    multi_use_per_day: bool


class AssetIn(BaseModel):
    type_id: str = Field(..., description="FK para asset_types.id")
    number: str = Field(..., min_length=1, max_length=64, description="Número/patrimônio")


class AssetPatch(BaseModel):
    type_id: Optional[str] = None
    number: Optional[str] = Field(default=None, min_length=1, max_length=64)
    status: Optional[Literal["available", "in_use", "problem"]] = None
    current_holder: Optional[str] = None


class AssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type_id: str
    code: Optional[str] = None
    number: str
    status: Literal["available", "in_use", "problem"]
    current_holder: Optional[str] = None
    created_at: datetime
    asset_types: Optional[AssetTypeEmbedded] = Field(
        default=None, description="Tipo do ativo (embedded via JOIN)"
    )


# ----- Movements -------------------------------------------------------------


class MovementIn(BaseModel):
    """Entrada de ``POST /movements`` (kiosk)."""

    asset_id: str = Field(..., description="ID do ativo a ser movido")
    collaborator_id: Optional[str] = Field(
        default=None, description="FK para collaborators.id (opcional)"
    )
    type: Literal["withdraw", "return"] = Field(..., description="Tipo da movimentação")
    holder: str = Field(..., min_length=1, description="Nome do responsável")


class ReturnWithProblemIn(BaseModel):
    """Entrada de ``POST /movements/return-with-problem`` (editor+)."""

    asset_id: str
    holder: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1, description="Descrição do problema")
    reported_by: str = Field(..., min_length=1, description="Quem reportou")
    note: Optional[str] = Field(default=None, description="Observação da devolução")


class MovementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    asset_id: str
    collaborator_id: Optional[str] = None
    type: Literal["withdraw", "return"]
    holder: str
    note: Optional[str] = None
    created_at: datetime
    assets: Optional["MovementAssetEmbedded"] = None
    collaborators: Optional["MovementCollaboratorEmbedded"] = None


class MovementAssetEmbedded(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    number: str
    type_id: str
    asset_types: Optional[AssetTypeEmbedded] = None


class MovementCollaboratorEmbedded(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    badge_number: str


# ----- Problems --------------------------------------------------------------


class ProblemIn(BaseModel):
    """Entrada de ``POST /problems`` (editor+)."""

    asset_id: str
    description: str = Field(..., min_length=1)
    reported_by: str = Field(..., min_length=1, description="Quem reportou")


class ProblemPatch(BaseModel):
    """Body de ``PATCH /problems/{id}`` (editor+)."""

    status: Optional[Literal["open", "resolved"]] = None
    description: Optional[str] = Field(default=None, min_length=1)


class ProblemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    asset_id: str
    description: str
    status: Literal["open", "resolved"]
    reported_by: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None
    assets: Optional[MovementAssetEmbedded] = None


# ----- Collaborators ----------------------------------------------------------


class CollaboratorIn(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=200)
    badge_number: str = Field(..., min_length=1, max_length=64)
    active: bool = True


class CollaboratorPatch(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    badge_number: Optional[str] = Field(default=None, min_length=1, max_length=64)
    active: Optional[bool] = None


class CollaboratorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    badge_number: str
    active: bool
    created_at: datetime
    updated_at: datetime


# ----- Users (admin) ---------------------------------------------------------


class UserOut(BaseModel):
    """Item da listagem ``GET /users``."""

    id: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    active: bool
    email_confirmed: bool
    created_at: datetime
    last_sign_in_at: Optional[datetime] = None


class RoleUpdate(BaseModel):
    """Body de ``POST /users/{id}/role`` (admin)."""

    role: Literal["administrador", "editor", "leitor", "kiosk"]


# ----- Resposta genérica de mutação -----------------------------------------


class OkResponse(BaseModel):
    ok: bool = True
