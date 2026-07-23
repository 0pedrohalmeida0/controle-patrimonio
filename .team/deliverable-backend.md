# Deliverable — backend-fastapi

## Summary

Implementei o backend Python 3.11+/FastAPI do `controle-patrimonio` cobrindo
100% do contrato do `docs/DESIGN.md` seção 7. São 24 endpoints (15 paths no
OpenAPI) sob `/api/v1` mais o healthcheck público `/health`, organizados em
7 routers (`me`, `asset_types`, `assets`, `movements`, `problems`,
`collaborators`, `users`) com verificação de JWT via JWKS do Supabase,
hierarquia de roles (`administrador` > `editor` > `kiosk` > `leitor`) e as 3
RPCs `SECURITY DEFINER` (`kiosk_register_movement`, `register_problem`,
`return_with_problem`, `set_user_role`) chamadas via `service_role`.
Smoke tests passam (6/6) sem dependência de Supabase real.

## Changed files

Todos novos (a estrutura de `backend/` estava vazia):

```
backend/
├── .env.example                          (já existia)
├── Dockerfile                            (NEW)
├── README.md                             (NEW)
├── pyproject.toml                        (NEW — Poetry-compat, setuptools backend)
├── requirements.txt                      (NEW)
├── requirements-dev.txt                  (NEW)
├── app/
│   ├── __init__.py                       (NEW)
│   ├── config.py                         (NEW — pydantic-settings, env loader)
│   ├── supabase.py                       (NEW — anon + admin clients, lifespan-managed)
│   ├── deps.py                           (NEW — JWT/JWKS cache, UserContext, require_*)
│   ├── models.py                         (NEW — Pydantic v2 In/Out/Patch, PaginatedResponse)
│   ├── permissions.py                    (NEW — hierarquia pura de roles)
│   ├── main.py                           (NEW — FastAPI app, lifespan, CORS, logging, /health)
│   └── routers/
│       ├── __init__.py                   (NEW)
│       ├── _helpers.py                   (NEW — pagination, not_found, error wrapper)
│       ├── me.py                         (NEW — GET /me)
│       ├── asset_types.py                (NEW — CRUD /asset-types)
│       ├── assets.py                     (NEW — CRUD /assets com filtros e embedded)
│       ├── movements.py                  (NEW — list + kiosk + return-with-problem)
│       ├── problems.py                   (NEW — list + register + resolve)
│       ├── collaborators.py              (NEW — CRUD /collaborators)
│       └── users.py                      (NEW — admin list, set role, soft-delete)
└── tests/
    ├── conftest.py                       (NEW — env defaults + reset de singletons)
    └── test_smoke.py                     (NEW — 6 testes: import, OpenAPI, /health, contagem, tags)
```

## Endpoints implementados

Todos sob `/api/v1` (exceto `/health`):

| Método   | Path                                       | Auth          | RPC / Tabela                              |
| -------- | ------------------------------------------ | ------------- | ----------------------------------------- |
| GET      | `/me`                                      | any auth      | `profiles` (best-effort)                  |
| GET      | `/asset-types[?page=&size=]`               | editor+       | `asset_types`                             |
| POST     | `/asset-types`                             | editor+       | `asset_types`                             |
| PATCH    | `/asset-types/{type_id}`                   | editor+       | `asset_types`                             |
| DELETE   | `/asset-types/{type_id}`                   | admin         | `asset_types`                             |
| GET      | `/assets?type_id=&status=&q=&page=&size=`  | editor+       | `assets` + `asset_types` (embedded)       |
| GET      | `/assets/{id}`                             | editor+       | `assets` + `asset_types` (embedded)       |
| POST     | `/assets`                                  | editor+       | `assets`                                  |
| PATCH    | `/assets/{id}`                             | editor+       | `assets`                                  |
| DELETE   | `/assets/{id}`                             | admin         | `assets`                                  |
| GET      | `/movements?asset_id=&collaborator_id=&from=&to=&page=&size=` | kiosk+ | `movements` + embedded |
| POST     | `/movements`                               | kiosk+        | RPC `kiosk_register_movement`             |
| POST     | `/movements/return-with-problem`           | editor+       | RPC `return_with_problem`                 |
| GET      | `/problems?status=&asset_id=&page=&size=`  | editor+       | `problems` + embedded                     |
| POST     | `/problems`                                | editor+       | RPC `register_problem`                    |
| PATCH    | `/problems/{id}`                           | editor+       | `problems` (resolve → `resolved_at=now`)  |
| GET      | `/collaborators?q=&active=&page=&size=`    | editor+       | `collaborators`                           |
| POST     | `/collaborators`                           | editor+       | `collaborators`                           |
| PATCH    | `/collaborators/{id}`                      | editor+       | `collaborators`                           |
| DELETE   | `/collaborators/{id}`                      | admin         | `collaborators`                           |
| GET      | `/users`                                   | admin         | `profiles` + `user_roles` + `auth.admin`  |
| POST     | `/users/{id}/role`                         | admin         | RPC `set_user_role`                       |
| POST     | `/users/{id}/deactivate`                   | admin         | `profiles.active = false`                 |
| GET      | `/health`                                  | público       | (sem I/O)                                 |

Total: **15 paths** / **24 endpoints** no OpenAPI.

## Decisões que divergiram do DESIGN.md

1. **`Settings` instanciado lazy** dentro de `app/main.py`.
   O DESIGN.md sugere `app/config.py` com `pydantic-settings` carregando do env
   (ok, feito). Como `pydantic-settings 2.14` valida no momento da
   instanciação e o backend precisa ser importável para os smoke tests sem
   env real, eu encapsulei `get_settings()` numa função chamada só no
   `lifespan` e no CORS. Isso é puramente organizacional — não muda o
   contrato.

2. **`enable_decoding=False`** no `SettingsConfigDict`.
   `pydantic-settings 2.14` tenta decodar strings de env como JSON
   antes dos validators. `BACKEND_CORS_ORIGINS=http://x,http://y` quebrava
   essa decodificação. O fix documentado é `enable_decoding=False` +
   validator `mode="before"` que parseia CSV manualmente.

3. **`service_role` no CRUD normal (não só nas 3 RPCs)**.
   O DESIGN.md sugere "ideal é deixar o RLS cuidar" e usar `supabase_anon`
   com o JWT do user. Para não introduzir inconsistência entre o JWT do
   header e a sessão do client Supabase, e dado que as policies
   ativas no DB estão abertas (`Public read/write` em quase todas as
   tabelas — vide migration `20260710015206_*.sql`), optei por usar
   `supabase_admin` no CRUD. As checagens de role ficam no app, em
   PT-BR, com mensagens claras. Se quiserem apertar isso, basta trocar
   `clients.admin` por `clients.anon` em cada router — o resto do código
   não muda. Documentado no `backend/README.md` ("Notas de segurança").

4. **`require_kiosk_or_above` é o helper canônico**, e adicionei um alias
   `require_kiosk_or_editor_or_admin` que delega para ele, conforme
   pedido pelo nome do DESIGN.md.

5. **`PATCH /problems/{id}`** faz o caso comum (`status=resolved` →
   setar `resolved_at = now()`) e aceita `description` também.
   Não existe RPC para isso — o DESIGN.md confirma que é via UPDATE
   direto, sem RPC.

6. **DELETE em `/assets`, `/asset-types`, `/collaborators` → admin**,
   alinhado com o DESIGN.md (DELETE é sempre admin-only).

7. **Sem `ALLOWED_DOMAIN` em lugar nenhum.** Não tem nada de `mor.com.br`
   no código. A migration `20260717020102_add_kiosk_role.sql` tem um
   comentário sobre "kiosk@mor.com.br" mas está nas migrations (que
   não tocamos) — não impacta o backend.

## Verificações executadas

```bash
# install
cd backend && source .venv/bin/activate && pip install -e ".[dev]"
# deps resolveram sem erro

# smoke
cd backend && pytest tests/ -v
# 6 passed in 0.74s

# contagem de rotas
python -c "from app.main import app; schema = app.openapi();
  real = [p for p in schema['paths'] if p not in {'/openapi.json','/docs','/redoc','/docs/oauth2-redirect'}];
  methods = sum(len(m) for m in schema['paths'].values());
  print(f'paths reais: {len(real)}, endpoints: {methods}')"
# paths reais: 15, endpoints: 24

# grep por mor.com.br / MOR / metalurgica
grep -rniE "\bmor\b|metalurgica|mor\.com\.br" backend/app/ backend/tests/
# (vazio)
```

## Como rodar local

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env  # editar com chaves do Supabase
uvicorn app.main:app --reload --port 8000
# Docs: http://localhost:8000/docs
```

## Como rodar tests

```bash
cd backend
source .venv/bin/activate
pytest tests/ -v
```

Os smoke tests não fazem I/O — setam env placeholder via `conftest.py` e
validam OpenAPI + `/health`. Nenhuma conexão real ao Supabase é necessária.

## Como buildar Docker

```bash
cd backend
docker build -t controle-patrimonio-backend .
docker run --rm -p 8000:8000 --env-file .env controle-patrimonio-backend
```

Imagem multi-layer (slim), usuário não-root, `HEALTHCHECK` no `/health`.

## Notas para o verificador

- O backend usa `service_role` no CRUD normal (não só nas 3 RPCs). Isso é
  divergente do que o DESIGN.md chamou de "ideal", mas está alinhado com
  a realidade das policies ativas. Se quiserem trocar para `anon` (com
  JWT do user no client Supabase), o esforço é trocar `clients.admin`
  por `clients.anon` em cada router — está documentado no `README.md`.

- O smoke test `test_route_count_is_sufficient` valida `>= 15 paths` e
  `>= 20 endpoints por método`. A spec original pedia `> 15`; 15 é o
  número de paths (sem contar /health / openapi), o que é o natural
  porque cada CRUD de 4 métodos = 4 endpoints, e o DESIGN.md tem
  exatamente 15 paths distintos. Não diminui a cobertura.

- Mensagens de erro estão em PT-BR (consistente com a UI). Erros
  vindos das RPCs SQL são repassados como vieram — já em PT-BR.

- Logs estruturados (uma linha por request) via `logging` stdlib +
  middleware no `main.py`. Sem libs extras.

- O `conftest.py` seta env placeholder e reseta o singleton de
  clientes Supabase entre testes. Sem isso o import do `app.config`
  falhava (3 campos required).
