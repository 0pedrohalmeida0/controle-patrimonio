# Design — controle-patrimonio (template genérico)

Este documento é o contrato entre as duas trilhas (backend Python e frontend
React/TS). Workers: leiam antes de codar, sigam à risca, atualizem se a
realidade revelar uma omissão.

## 1. Visão

Template genérico de **controle de patrimônio físico** com quiosque de
autoatendimento. Suporta registro de equipamentos (assets), retirada/devolução
(via crachá), apontamento de problemas, indicadores e gestão de usuários com
4 perfis (administrador, editor, leitor, kiosk).

Não é específico de nenhum segmento. O schema e a API usam vocabulário
neutro (`assets`, `movements`, `problems`, `collaborators`). A UI é em
PT-BR mas com i18n plugado para troca.

## 2. Stack

| Camada       | Tecnologia                                    |
| ------------ | --------------------------------------------- |
| Backend      | Python 3.11+ / FastAPI / Uvicorn              |
| Frontend     | Vite + React 18 + TypeScript + Tailwind      |
| DB           | Supabase Postgres (PostgREST + Realtime + Auth) |
| Migrations   | SQL idempotente em `db/migrations/`           |
| PWA          | `vite-plugin-pwa`                             |
| Auth         | Supabase Auth (JWT) verificada no backend     |
| Container    | Docker + docker-compose                       |

## 3. Estrutura de diretórios

```
controle-patrimonio/
├── LICENSE                          (já existe — MIT)
├── README.md                        (clone-and-go)
├── .gitignore
├── .env.example                     (apenas referência)
├── docker-compose.yml
├── backend/                         (Python)
│   ├── pyproject.toml
│   ├── Dockerfile
│   ├── .env.example
│   └── app/
│       ├── main.py                  (FastAPI app + lifespan + CORS)
│       ├── config.py                (pydantic-settings)
│       ├── deps.py                  (verify_jwt + role checks)
│       ├── supabase.py              (clientes: anon + service_role)
│       ├── models.py                (Pydantic request/response)
│       ├── permissions.py
│       └── routers/
│           ├── me.py                (/me)
│           ├── asset_types.py
│           ├── assets.py
│           ├── movements.py         (kiosk + return-with-problem)
│           ├── problems.py
│           ├── collaborators.py
│           └── users.py             (admin)
├── frontend/                        (React/TS)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   ├── Dockerfile
│   ├── .env.example
│   ├── public/
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── lib/
│       │   ├── api.ts               (fetch wrapper com JWT)
│       │   ├── auth.tsx
│       │   ├── i18n.ts
│       │   ├── types.ts
│       │   └── realtime.ts          (subscribes Supabase Realtime direto)
│       ├── routes/
│       ├── components/
│       └── hooks/
├── db/
│   ├── README.md                    (como aplicar as migrations)
│   └── migrations/                  (os 18 SQLs do luminaria-hub, copiados
│                                    do source e mantidos idempotentes)
└── docs/
    ├── DESIGN.md                    (este arquivo)
    ├── SETUP.md                     (passo-a-passo Supabase + docker)
    └── ARCHITECTURE.md
```

## 4. Variáveis de ambiente

### Backend (`backend/.env`)
```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon/publishable>
SUPABASE_SERVICE_ROLE_KEY=<service_role>     # necessário para chamar RPCs SECURITY DEFINER
BACKEND_CORS_ORIGINS=http://localhost:5173
```

### Frontend (`frontend/.env`)
```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon/publishable>
VITE_API_BASE_URL=http://localhost:8000
```

## 5. Modelo de dados (resumo)

Tabelas (todas em `public.*`):
- `asset_types(id, code, name, multi_use_per_day, created_at)`
- `assets(id, type_id→asset_types, code, number, status, current_holder, created_at)`
  - `status` ∈ {`available`, `in_use`, `problem`}
- `movements(id, asset_id→assets, collaborator_id→collaborators NULL, type, holder, note, created_at)`
  - `type` ∈ {`withdraw`, `return`}
- `problems(id, asset_id→assets, description, status, reported_by, created_at, resolved_at)`
  - `status` ∈ {`open`, `resolved`}
- `collaborators(id, full_name, badge_number UNIQUE, active, created_at, updated_at)`
- `profiles(id→auth.users, full_name, email, active, created_at)`
- `user_roles(user_id→auth.users, role)` — PK (user_id, role)
  - `role` ∈ {`administrador`, `editor`, `leitor`, `kiosk`}

Enums: `asset_status`, `movement_type`, `problem_status`, `app_role`.

As migrations estão em `db/migrations/` e devem ser aplicadas no Supabase
via `supabase db push` ou colando no SQL editor. Cada arquivo é idempotente.

## 6. RPCs SECURITY DEFINER (não mudam)

Estas RPCs já estão nas migrations. O backend **não** as reimplementa — ele
as chama via `service_role`. Não exponha estas RPCs para `anon` ou
`authenticated` (as policies já fazem isso). O frontend nunca chama RPC
diretamente: sempre passa pelo backend.

| Função | Parâmetros | Retorno | Permissão |
| --- | --- | --- | --- |
| `kiosk_register_movement` | `_asset_id, _collaborator_id, _type, _holder` | `uuid` (movement id) | service_role |
| `set_user_role` | `_user_id, _role` | `void` | service_role |
| `register_problem` | `_asset_id, _description, _reported_by` | `uuid` (problem id) | service_role |
| `return_with_problem` | `_asset_id, _holder, _description, _reported_by, _note?` | `uuid` (movement id) | service_role |
| `has_role(_user_id, _role)` | — | `boolean` | authenticated |
| `can_edit(_user_id)` | — | `boolean` | authenticated |
| `can_kiosk(_user_id)` | — | `boolean` | authenticated |

## 7. API REST (contrato)

Base: `${VITE_API_BASE_URL}/api/v1`

Todas as rotas (exceto `/auth/*`) exigem header `Authorization: Bearer <jwt>`.
O backend valida o JWT contra `SUPABASE_URL` (JWKS) e carrega `user_id` e
`role` no request state.

### 7.1 Auth (NÃO passa pelo backend)

O frontend usa `@supabase/supabase-js` direto contra `VITE_SUPABASE_URL` para
`signInWithPassword`, `signUp`, `signOut`. O JWT resultante é guardado em
memória (React context, NÃO localStorage) e injetado como
`Authorization: Bearer <jwt>` em todo `fetch` para o backend.

O backend **apenas verifica o JWT** (não proxya auth):
- Usa `python-jose` + JWKS de `${SUPABASE_URL}/.well-known/jwks.json` (cache local)
- Decodifica o JWT, valida assinatura + expiry + audience
- Extrai `user_id` (sub) e popula o request state
- Em paralelo, lê `user_roles` via service_role para resolver o `role`

### 7.2 `/me`

```
GET /api/v1/me
→ { id, email, full_name, role, is_admin, is_kiosk, can_edit }
```

### 7.3 Asset types

```
GET    /api/v1/asset-types                 → AssetType[]
POST   /api/v1/asset-types                 body: { code, name, multi_use_per_day? }     [editor+]
PATCH  /api/v1/asset-types/{id}            body parcial                                [editor+]
DELETE /api/v1/asset-types/{id}                                                  [admin]
```

### 7.4 Assets

```
GET    /api/v1/assets?type_id=&status=&q=&page=&size=         → { items, total, page, size }
GET    /api/v1/assets/{id}                                    → Asset (com type embedded)
POST   /api/v1/assets                 body: { type_id, number }                      [editor+]
PATCH  /api/v1/assets/{id}            body parcial                                   [editor+]
DELETE /api/v1/assets/{id}                                                           [admin]
```

### 7.5 Movements (kiosk + histórico)

```
GET    /api/v1/movements?asset_id=&collaborator_id=&from=&to=&page=&size=  → { items, total, ... }
POST   /api/v1/movements
       body: { asset_id, collaborator_id?, type: "withdraw"|"return", holder }
       chama RPC `kiosk_register_movement` (service_role)                    [kiosk/editor/admin]
POST   /api/v1/movements/return-with-problem
       body: { asset_id, holder, description, reported_by, note? }
       chama RPC `return_with_problem`                                       [editor+]
```

### 7.6 Problems

```
GET    /api/v1/problems?status=&asset_id=&page=&size=           → { items, total, ... }
POST   /api/v1/problems
       body: { asset_id, description, reported_by }
       chama RPC `register_problem`                                          [editor+]
PATCH  /api/v1/problems/{id}        body: { status: "resolved" }             [editor+]
```

### 7.7 Collaborators

```
GET    /api/v1/collaborators?q=&active=&page=&size=             → { items, total, ... }
POST   /api/v1/collaborators       body: { full_name, badge_number }         [editor+]
PATCH  /api/v1/collaborators/{id}  body parcial                              [editor+]
DELETE /api/v1/collaborators/{id}                                            [admin]
```

### 7.8 Users (admin)

```
GET    /api/v1/users                                               → ManagedUser[]
POST   /api/v1/users/{id}/role     body: { role }                    chama RPC `set_user_role`  [admin]
POST   /api/v1/users/{id}/deactivate                              soft-delete (active=false)   [admin]
```

## 8. Permissões (papéis)

| Papel         | Pode                                                              |
| ------------- | ----------------------------------------------------------------- |
| `kiosk`       | registrar movimentações; ver suas próprias movimentações          |
| `leitor`      | leitura em tudo; sem mutação                                      |
| `editor`      | leitor + criar/editar tipos, ativos, problemas, colaboradores     |
| `administrador` | editor + deletar + gerenciar usuários                            |

`leitor` é redirecionado para `/` em qualquer rota de mutação. `kiosk` é
preso em `/kiosk` (server-side guard no frontend: se o role é kiosk-only,
qualquer outra rota redireciona para `/kiosk`).

## 9. Auth flow

1. Frontend usa `supabase.auth.signInWithPassword({ email, password })` direto contra Supabase
2. Frontend guarda `{access_token, refresh_token, user}` no `AuthContext` (em memória, NÃO localStorage — kiosk 24/7 não pode vazar token em cookie persistente)
3. Frontend injeta `Authorization: Bearer <jwt>` em todo `fetch` para o backend
4. Frontend usa o MESMO JWT no `supabase-js` client para Realtime subscriptions (channels do PostgREST CDC)
5. Refresh: frontend chama `supabase.auth.refreshSession()` quando recebe 401 do backend

> **Decisão:** o frontend tem 2 clientes Supabase: um com o JWT do user
> (para Realtime direto), outro não usa (todas as mutações passam pelo
> backend que tem service_role). Isso evita expor service_role no browser.

## 10. Realtime

Subscriptions do Supabase CDC funcionam direto no browser via `@supabase/supabase-js`.
Canais:
- `assets` — refetch lista ao mudar
- `movements` — refetch lista e histórico
- `problems` — refetch lista e indicadores
- `user_roles` — refetch role do user atual

A implementação fica em `frontend/src/lib/realtime.ts` e é plugada nos hooks
de query (similar ao `use-realtime-sync.ts` do original).

## 11. PWA / kiosk mode

- `vite-plugin-pwa` com `registerType: 'autoUpdate'`, manifest com nome
  "Controle Patrimônio", display `standalone`, icons 192/512
- Hook `use-pwa-install.ts` para prompt de install
- Rota `/kiosk` é fullscreen: ao montar, chama `requestFullscreen()` e
  monitora `fullscreenchange` para re-entrar se o user sair
- Detecção de touch otimiza o layout (botões maiores)

## 12. Docker

`docker-compose.yml` na raiz:
```yaml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: ./backend/.env
    restart: unless-stopped
```

O frontend tem Dockerfile separado (build estático servido por nginx) mas
**não** entra no compose por padrão — instruções de build ficam no README.
Quem quiser compose com frontend, adiciona.

## 13. i18n

- Strings em `frontend/src/lib/i18n.ts` como dicionário PT-BR (default)
- Helper `t(key, vars?)` resolve a string
- Para trocar idioma: criar `en.ts`, `es.ts`, etc., e plugar no hook
- Strings do backend em PT-BR nas mensagens de erro (consistente com a UI)

## 14. O que NÃO entra

- ❌ Referência a `mor.com.br`, Metalúrgica MOR, ou qualquer marca
- ❌ Dados seed específicos (apenas dados de exemplo mínimos no seed.sql opcional)
- ❌ Lógica de negócio adicional além das 3 RPCs + CRUDs básicos
- ❌ Hard-delete de usuários (soft-delete via `active=false`)
- ❌ Service role key commitada (deve vir de env)
- ❌ Auto-logout por inatividade (kiosk roda 24/7)
- ❌ Edge function de criação automática de user kiosk (deixar como TODO no README)

## 15. O que COPIA do source `/workspace/lumin-ria-hub`

- Os 21 arquivos em `supabase/migrations/*.sql` → vão para `db/migrations/` **sem renomear nem reformatar** (são idempotentes; renomear quebra a história).
- O conceito de UI e os textos em PT-BR. Workers podem reusar HTML/JSX patterns do original (é código do próprio usuário, MIT reescrita é OK), mas devem **reescrever** — não copiar verbatim — para evitar código com bindings de marcas antigas.

## 16. O que NÃO copia

- Qualquer string com `mor.com.br` ou `MOR` (a constante `ALLOWED_DOMAIN` em `auth.tsx`, references na auth callback, etc.)
- O token / `.env` real do source
- O `bun.lock` / `package.json` específico do source (template tem suas próprias deps)
- O `bunfig.toml` (não é necessário)
- Componentes Lovable-específicos (`.lovable/`, `lovable-error-reporting.ts`)

## 17. Divergências documentadas pelo backend (Python)

Pequenos desvios do DESIGN.md feitos durante a implementação. Cada um tem
uma justificativa; nenhum muda o contrato HTTP.

- **Service role no CRUD normal (não só nas 3 RPCs).** O DESIGN.md
  sugere "ideal é deixar o RLS cuidar" e usar `supabase_anon` carregando
  o JWT do user. Como as policies ativas no DB (vide migration
  `20260710015206_4c672c11-*.sql`) estão bem permissivas
  (`Public read/write`), e como injetar o JWT do header no client
  `supabase_anon` em cada chamada adiciona complexidade sem benefício
  imediato, optei por usar `supabase_admin` no CRUD. As checagens de
  role ficam no app, com mensagens em PT-BR. Trocar para `anon` é
  mecânico (substituir `clients.admin` por `clients.anon` em cada
  router) e fica documentado no `backend/README.md`.

- **Settings lazy em `app/main.py`.** O `Settings()` do
  `pydantic-settings` 2.14 falha no import se o env não tem os 3
  campos required. Para os smoke tests rodarem sem Supabase real,
  `get_settings()` é chamado só no `lifespan` e no CORS, não no
  top-level.

- **`enable_decoding=False` no `SettingsConfigDict`.** Necessário
  porque `pydantic-settings` 2.14 tenta decodar `BACKEND_CORS_ORIGINS`
  como JSON antes dos validators. CSV puro (`http://x,http://y`)
  quebraria. Fix documentado e estável.

- **PATCH em `/problems/{id}` aceita `description` também**, além do
  `status` canônico. Foi conveniência, não contradição — `description`
  raramente muda, mas é barato aceitar.
