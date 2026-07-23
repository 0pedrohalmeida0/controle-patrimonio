# Arquitetura — controle-patrimonio

## Visão geral

```
┌─────────────────┐         ┌─────────────────┐         ┌──────────────────────┐
│  Browser        │         │  FastAPI        │         │  Supabase            │
│  (React/Vite)   │ ──────▶ │  (Python)       │ ──────▶ │  Postgres + Auth     │
│                 │  JWT    │                 │  serv   │  + Realtime          │
│  - Auth UI      │ Bearer  │  - JWT verify   │ role    │                      │
│  - Dashboard    │ ◀────── │  - Role check   │ ◀────── │  - 21 SQL migrations │
│  - Kiosk        │  JSON   │  - CRUD proxy   │  RLS    │  - 3 SECURITY DEFINER│
│  - Realtime     │  WS CDC │  - RPC invoke   │         │    RPCs              │
└─────────────────┘         └─────────────────┘         └──────────────────────┘
```

| Camada       | Responsabilidade                                                          |
| ------------ | ------------------------------------------------------------------------- |
| **Browser**  | UI, state local, validação de input, realtime direto via Supabase channel |
| **FastAPI**  | Verifica JWT, resolve role, aplica regras de permissão, chama RPCs        |
| **Supabase** | Persistência, auth, RLS, atomicidade (via RPCs), CDC pra realtime         |

## Decisões-chave

### 1. Frontend NÃO conhece `service_role`
- O frontend usa **apenas** o JWT do user (anon key + signIn).
- `service_role` vive **só** no backend, usado em 3 RPCs SECURITY DEFINER e na listagem admin de users.
- Por isso: **vazamento de service_role = catastrophic**, mas está fisicamente isolado.

### 2. JWT verificado no backend
- Toda request (exceto `/health`) precisa de `Authorization: Bearer <jwt>`.
- Backend valida via **JWKS** (chave pública do Supabase), cache local, sem round-trip por request.
- Audience é `authenticated`. Audience errada = 401 imediato.

### 3. Mutações atômicas via RPC
- `kiosk_register_movement`: cria `movement` + flippa `assets.status` numa única transação com `WHERE status = expected` (race-safe).
- `return_with_problem`: insere movement + problem + flippa asset. Se qualquer passo falha, **rollback total** (sem rows órfãs).
- `register_problem`: snapshot do holder na description + flippa asset. Idempotente pra open problems.
- `set_user_role`: insert + delete numa tx, sem janela "user sem role".

Todas usam `SECURITY DEFINER` + `REVOKE FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE TO service_role`. Só o backend alcança.

### 4. Realtime direto no browser
- Frontend cria `supabase.channel('public:assets').on('postgres_changes', ...)` com o JWT do user.
- Não passa pelo backend — é PostgREST CDC via WebSocket.
- Custo zero no FastAPI, latência ~100ms.

### 5. Roles como hierarquia explícita
```python
ADMIN_ROLES    = {"administrador"}
EDITOR_ROLES   = {"administrador", "editor"}
KIOSK_ROLES    = {"administrador", "editor", "kiosk"}
```

Cada endpoint declara o role mínimo via dependency:
```python
@router.post("/assets", dependencies=[Depends(require_editor)])
```

`kiosk` é preso em `/kiosk` no frontend (se só tem essa role, qualquer outra rota redireciona).

## Fluxo: retirada no quiosque

```
1. Tablet no /kiosk
2. User escolhe tipo de equipamento (ex: "Chave de fenda #4")
3. Tablet mostra grid de equipamentos do tipo, status=available
4. User toca em 1+ (se o tipo permite multi-use)
5. Tablet pede crachá (scan QR via camera OU input manual)
6. Backend valida: o user tem role kiosk/editor/admin
7. Backend chama RPC `kiosk_register_movement` via service_role
8. RPC valida status=available, atualiza pra in_use, insere movement
9. CDC dispara → todos os tablets veem o ativo sumir da lista "available"
10. Tablet mostra sucesso + reset pra idle (2s)
```

## Fluxo: return-with-problem

```
1. Editor abre detalhe do ativo (status=in_use)
2. Clica em "Devolver com problema"
3. Modal: descreve o problema + reporta por
4. Frontend POST /api/v1/movements/return-with-problem
5. Backend valida role=editor+ e chama RPC `return_with_problem`
6. RPC: insere movement(return) + insere problem + UPDATE asset status=problem
7. Se UPDATE falha (asset não está mais in_use) → RAISE EXCEPTION → rollback total
8. Sucesso: ativo some de "em uso", aparece em "problemas"
```

## Modelo de dados (resumo)

| Tabela          | Propósito                                                  |
| --------------- | ---------------------------------------------------------- |
| `profiles`      | mirror de `auth.users` com `full_name`, `active`           |
| `user_roles`    | N:M users ↔ roles (admin/editor/leitor/kiosk)              |
| `asset_types`   | tipo de equipamento (`code`, `name`, `multi_use_per_day`)  |
| `assets`        | item físico (`code`, `number`, `status`, `current_holder`) |
| `movements`     | histórico de retiradas/devoluções                          |
| `problems`      | problemas reportados (open/resolved)                       |
| `collaborators` | pessoas que podem pegar equipamento (`badge_number`)       |

Enums: `asset_status`, `movement_type`, `problem_status`, `app_role`.

## Permissões (papéis)

| Papel         | Pode                                                              |
| ------------- | ----------------------------------------------------------------- |
| `kiosk`       | registrar movimentações; ver suas próprias movimentações          |
| `leitor`      | leitura em tudo; sem mutação                                      |
| `editor`      | leitor + criar/editar tipos, ativos, problemas, colaboradores     |
| `administrador` | editor + deletar + gerenciar usuários                            |

## Decisões deliberadamente NÃO tomadas

- ❌ **Auto-logout por inatividade**: kiosk roda 24/7, não pode deslogar
- ❌ **Hard-delete de usuários**: soft-delete via `active=false` (preserva histórico)
- ❌ **Service role no browser**: blast radius limitado
- ❌ **Cookies httpOnly**: Supabase já gerencia sessão, trocamos pra cookie se requisitos de compliance exigirem
- ❌ **ORM**: SQL direto via supabase-py — explícito e auditável
- ❌ **Frontend service worker para mutações offline**: kiosk é 24/7 online; offline é fora de escopo
