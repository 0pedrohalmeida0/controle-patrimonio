# Controle Patrimônio — Backend

Backend FastAPI do template genérico de **controle de patrimônio físico**.
Implementa o contrato definido em [`../docs/DESIGN.md`](../docs/DESIGN.md) (seção 7).

- **Stack:** Python 3.11+, FastAPI, Uvicorn, Pydantic v2, Supabase (PostgREST), `python-jose` para JWT/JWKS.
- **Auth:** o frontend loga direto no Supabase e envia o JWT em `Authorization: Bearer <jwt>`. O backend **apenas verifica** o JWT e resolve o role; não proxya sign-in/sign-up.
- **Service role:** usada só para as 3 RPCs `SECURITY DEFINER` e para a listagem de usuários via `auth.admin`. CRUD normal passa pelo `service_role` também, mas com checagem de role no app — o ideal é deixar o RLS cuidar (configurável no deploy).

## Estrutura

```
backend/
├── pyproject.toml
├── Dockerfile
├── .env.example
├── app/
│   ├── main.py             # FastAPI app + lifespan + CORS + logging
│   ├── config.py           # pydantic-settings
│   ├── supabase.py         # clientes anon + admin
│   ├── deps.py             # verify_jwt + role checks
│   ├── models.py           # Pydantic v2 (In/Out/Patch)
│   ├── permissions.py      # hierarquia de roles (puro)
│   └── routers/
│       ├── me.py
│       ├── asset_types.py
│       ├── assets.py
│       ├── movements.py    # kiosk + return-with-problem
│       ├── problems.py
│       ├── collaborators.py
│       └── users.py        # admin
└── tests/
    ├── conftest.py
    └── test_smoke.py
```

## Como rodar local

1. Copie o env de exemplo e preencha com as chaves do seu projeto Supabase:

   ```bash
   cp .env.example .env
   $EDITOR .env
   ```

2. Instale as dependências (use Poetry ou pip):

   ```bash
   # pip
   python -m venv .venv && source .venv/bin/activate
   pip install -e ".[dev]"

   # ou poetry
   poetry install
   ```

3. Sobe o servidor de dev:

   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

   A API fica em `http://localhost:8000`. OpenAPI/Swagger em `http://localhost:8000/docs`.

## Como rodar os testes

```bash
pytest tests/ -v
```

Os smoke tests:

- Importam o app sem precisar de env real (o `conftest.py` seta placeholders).
- Verificam que **todas** as rotas do `DESIGN.md` seção 7 estão expostas no OpenAPI.
- Batem no `/health` e garantem 200.

## Como buildar o Docker

```bash
docker build -t controle-patrimonio-backend .
docker run --rm -p 8000:8000 --env-file .env controle-patrimonio-backend
```

A imagem é baseada em `python:3.11-slim`, roda como usuário não-root e tem
`HEALTHCHECK` apontando para `/health`.

## Endpoints (resumo)

Base: `/api/v1`. Todas as rotas (exceto `/health`) exigem JWT.

| Método | Path                                | Role            |
| ------ | ----------------------------------- | --------------- |
| GET    | `/me`                               | qualquer auth   |
| GET    | `/asset-types`                      | editor+         |
| POST   | `/asset-types`                      | editor+         |
| PATCH  | `/asset-types/{id}`                 | editor+         |
| DELETE | `/asset-types/{id}`                 | admin           |
| GET    | `/assets?type_id=&status=&q=&page=` | editor+         |
| GET    | `/assets/{id}`                      | editor+         |
| POST   | `/assets`                           | editor+         |
| PATCH  | `/assets/{id}`                      | editor+         |
| DELETE | `/assets/{id}`                      | admin           |
| GET    | `/movements?asset_id=&...&page=`    | kiosk+          |
| POST   | `/movements`                        | kiosk+          |
| POST   | `/movements/return-with-problem`    | editor+         |
| GET    | `/problems?status=&asset_id=&page=` | editor+         |
| POST   | `/problems`                         | editor+         |
| PATCH  | `/problems/{id}`                    | editor+         |
| GET    | `/collaborators?q=&active=&page=`   | editor+         |
| POST   | `/collaborators`                    | editor+         |
| PATCH  | `/collaborators/{id}`               | editor+         |
| DELETE | `/collaborators/{id}`               | admin           |
| GET    | `/users`                            | admin           |
| POST   | `/users/{id}/role`                  | admin           |
| POST   | `/users/{id}/deactivate`            | admin           |
| GET    | `/health`                           | público         |

## Notas de segurança

- O `.env` está no `.gitignore`. Nunca commite `SUPABASE_SERVICE_ROLE_KEY`.
- O `service_role` é usado apenas para as 3 RPCs `SECURITY DEFINER` (`kiosk_register_movement`, `register_problem`, `return_with_problem`, `set_user_role`) e para a listagem de usuários via `auth.admin`. Para o CRUD normal, o ideal é que o `supabase_anon` carregando o JWT do usuário seja usado e o RLS faça o filtro — isso ainda é configurável dependendo do deploy.
- Mensagens de erro são em PT-BR, consistentes com a UI.
- JWKS é cacheado em memória por 1h; falhas forçam refresh uma vez.
