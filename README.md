# Controle Patrimônio

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![React 18](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ecf8e.svg)](https://supabase.com)

Template genérico e **MIT-licensed** de **controle de patrimônio físico** com
quiosque de autoatendimento. Suporta registro de equipamentos, retirada e
devolução (via crachá), apontamento de problemas, indicadores e gestão de
usuários com 4 perfis (administrador, editor, leitor, kiosk).

Backend em **Python + FastAPI**, frontend em **Vite + React 18 + TypeScript**,
DB em **Supabase Postgres** com realtime e auth. PWA instalável, otimizado
pra rodar fullscreen em tablet como quiosque 24/7.

## Features

- **Auth com 4 papéis**: administrador, editor, leitor, kiosk (cada um com permissões granulares)
- **Quiosque de autoatendimento**: state machine fullscreen, multi-ativo por retirada, scan de crachá
- **CRUD completo**: tipos de equipamento, ativos, colaboradores, problemas, movimentações
- **Realtime**: Supabase CDC entre múltiplos usuários, sem polling
- **PWA fullscreen**: instala como app, roda offline, monitora estado de fullscreen
- **Mobile responsivo**: drawer lateral, tabelas com scroll horizontal
- **i18n plugado**: PT-BR default, fácil de trocar
- **Race-safe**: 3 RPCs `SECURITY DEFINER` no Postgres eliminam condições de corrida em movimentações
- **Soft-delete de usuários**: mantém histórico, reativa quando precisar
- **Docker-ready**: `docker compose up` sobe o backend

## Stack

| Camada       | Tecnologia                                          |
| ------------ | --------------------------------------------------- |
| Backend      | Python 3.11+ · FastAPI · Uvicorn · Pydantic v2      |
| Frontend     | Vite · React 18 · TypeScript · Tailwind · PWA       |
| DB           | Supabase Postgres + Realtime + Auth                |
| Migrations   | SQL idempotente em `db/migrations/` (21 arquivos)   |
| Auth         | Supabase Auth (JWT) verificada via JWKS no backend  |
| Container    | Docker + docker-compose                            |

## Quick start (clone-and-go)

5 passos e você tem o app rodando:

### 1. Clone o repo
```bash
git clone https://github.com/0pedrohalmeida0/controle-patrimonio.git
cd controle-patrimonio
```

### 2. Crie um projeto Supabase
- Vá em [supabase.com](https://supabase.com/dashboard) e crie um projeto novo
- Em **Project Settings → API**, anote:
  - `Project URL` → será seu `SUPABASE_URL` / `VITE_SUPABASE_URL`
  - `anon public key` → `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`
  - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ nunca exponha no browser!)

### 3. Aplique as migrations
Veja [`db/README.md`](db/README.md) para o passo-a-passo. Resumo:

Via Supabase CLI:
```bash
supabase link --project-ref <your-project>
supabase db push
```

Ou cole cada arquivo de `db/migrations/` no SQL Editor do Dashboard (em ordem, do mais antigo pro mais novo). Cada migration é idempotente.

### 4. Configure as env vars
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# edite ambos com os valores do passo 2
```

### 5. Suba o backend e rode o frontend
```bash
docker compose up -d backend
cd frontend && npm install && npm run dev
```

Abra http://localhost:5173. Login com o user que você criou no Supabase.

## Crie o primeiro admin

Após criar uma conta no Supabase Auth (qualquer email/senha, pelo Dashboard em
**Authentication → Users → Add user**), promova-o a administrador:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<user-uuid>', 'administrador');
```

O `<user-uuid>` está na tabela `auth.users` do seu projeto Supabase.

## Development

Em dev, é mais prático rodar backend e frontend separados (HMR no frontend):

```bash
# Terminal 1 — backend com reload
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev    # http://localhost:5173
```

## Deploy

### Backend
Qualquer host de container funciona. O `Dockerfile` usa `python:3.11-slim`
multi-stage. Configure as env vars (especialmente `SUPABASE_SERVICE_ROLE_KEY`)
via secrets do seu host (não commite).

### Frontend
Build estático:
```bash
cd frontend && npm run build
# saída em frontend/dist/
```

Sirva via qualquer CDN / nginx / Cloudflare Pages / Vercel. Configure
`VITE_*` em build time.

## Architecture

Veja [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) pra um diagrama detalhado
do fluxo de dados, onde o JWT é verificado, e como as RPCs `SECURITY DEFINER`
garantem atomicidade.

## Setup detalhado

Se é a primeira vez que você mexe com Supabase + FastAPI, siga o passo-a-passo
guiado em [`docs/SETUP.md`](docs/SETUP.md) — ele cobre desde criar o projeto
até criar o primeiro user kiosk.

## Customization

Os pontos mais prováveis de customizar:

- **Roles / permissões**: edite o enum `app_role` em
  `db/migrations/20260710015206_*.sql` e os helpers `can_edit`, `can_kiosk`,
  `has_role` em `db/migrations/20260717023640_*.sql` e `20260717020102_*.sql`.
- **Campos extras em assets / collaborators**: adicione colunas via nova
  migration idempotente.
- **UI / i18n**: o dicionário PT-BR está em
  `frontend/src/lib/i18n.ts` — basta substituir as strings ou plugar um
  novo arquivo de idioma.
- **Cores / tema**: tokens em `frontend/tailwind.config.js`.

## Project structure

```
controle-patrimonio/
├── backend/           # FastAPI + Python
├── frontend/          # Vite + React + TS
├── db/                # SQL migrations + README
├── docs/              # DESIGN, ARCHITECTURE, SETUP
├── docker-compose.yml
├── LICENSE            # MIT
└── README.md          # este arquivo
```

## License

MIT © 2026 — veja [`LICENSE`](LICENSE).

## Créditos

Construído sobre [Lovable](https://lovable.dev), [Supabase](https://supabase.com),
[FastAPI](https://fastapi.tiangolo.com), [Vite](https://vitejs.dev) e
[React](https://react.dev). Padrão de kiosk fullscreen inspirado no
[Chrome Kiosk Mode](https://developer.chrome.com/docs/devtools/device-mode/).
