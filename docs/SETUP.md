# Setup — controle-patrimonio

Guia passo-a-passo pra colocar o app de pé pela primeira vez, do zero.

## 0. Pré-requisitos

- Conta no [Supabase](https://supabase.com) (free tier serve)
- [Node.js](https://nodejs.org) 20+ (frontend)
- [Docker](https://docker.com) (recomendado pro backend) ou Python 3.11+ (alternativa)
- `git`

## 1. Crie o projeto Supabase

1. Vá em [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Escolha uma org, dê um nome (ex: `controle-patrimonio`) e uma senha forte pro DB
3. Região: escolha a mais próxima dos seus usuários
4. Espere ~2min o projeto provisionar

## 2. Pegue as credenciais

Vá em **Project Settings → API** e anote:

| Campo                      | Onde usar                                                  |
| -------------------------- | ---------------------------------------------------------- |
| `Project URL`              | `SUPABASE_URL` (backend) e `VITE_SUPABASE_URL` (frontend)  |
| `anon public` key          | `SUPABASE_ANON_KEY` (backend) e `VITE_SUPABASE_ANON_KEY`   |
| `service_role secret` key  | `SUPABASE_SERVICE_ROLE_KEY` (backend **SOMENTE**)          |

⚠️ A `service_role` bypassa RLS — **nunca** coloque no frontend ou exponha publicamente.

## 3. Aplique as migrations

### Opção A — Supabase CLI (recomendado)

```bash
# instala se ainda não tem: https://github.com/supabase/cli
supabase link --project-ref <project-ref>
supabase db push
```

`<project-ref>` é o slug do seu projeto (visible na URL: `https://supabase.com/dashboard/project/<project-ref>`).

### Opção B — SQL Editor do Dashboard

1. **SQL Editor** → **New query**
2. Cole e rode cada arquivo de `db/migrations/` em ordem (do mais antigo pro mais novo)
3. Cada migration é idempotente — pode re-rodar sem quebrar

Ao final, você deve ter 7 tabelas: `profiles`, `user_roles`, `asset_types`, `assets`, `movements`, `problems`, `collaborators`, mais 4 enums e 4 funções SECURITY DEFINER.

## 4. Configure as env vars do backend

```bash
cd backend
cp .env.example .env
# edite .env com os valores do passo 2
```

Exemplo:
```
SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
BACKEND_CORS_ORIGINS=http://localhost:5173,http://localhost:4173
PORT=8000
```

## 5. Configure as env vars do frontend

```bash
cd ../frontend
cp .env.example .env
# edite .env com os valores do passo 2
```

Exemplo:
```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
VITE_API_BASE_URL=http://localhost:8000
```

## 6. Suba o backend

```bash
cd ..
docker compose up -d backend
```

Verifique:
```bash
curl http://localhost:8000/health
# esperado: {"ok":true}
```

Abra a doc interativa: http://localhost:8000/docs

## 7. Rode o frontend

```bash
cd frontend
npm install
npm run dev
```

Abra http://localhost:5173. Você deve ver a tela de login.

## 8. Crie o primeiro admin

1. Em **Supabase Dashboard → Authentication → Users → Add user → Create new user**
2. Email: `admin@seudominio.com` (ou qualquer um — esse template não restringe domínio)
3. Senha: forte
4. **Auto Confirm User**: ✅
5. Anote o UUID que aparece na lista

Promova a admin via SQL Editor:
```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<uuid-do-passo-anterior>', 'administrador');
```

Faça login no app com esse email/senha.

## 9. Crie um user kiosk (opcional, se for usar o quiosque)

1. Crie outro user em **Authentication → Users** (ex: `kiosk@empresa.com`)
2. Promova:
```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<uuid>', 'kiosk');
```

Esse user é preso em `/kiosk` no frontend (server-side guard: role só `kiosk` → qualquer outra rota redireciona).

## 10. Teste end-to-end

1. Login como admin → vai pro dashboard
2. Vá em **Tipos** → crie um tipo (ex: `Chave de fenda`, code `CH4`, multi-use ❌)
3. Vá em **Ativos** → crie 2 ativos (números `1` e `2`) desse tipo
4. Abra uma aba anônima e login como kiosk
5. Vá em `/kiosk` → escolha o tipo `Chave de fenda` → toque no ativo `1` → input de crachá → OK
6. Volta na aba admin: o ativo `1` deve estar como `in_use` e a movimentação aparece no histórico
7. Tente retirar de novo: vai dar erro "Este equipamento não está mais disponível"
8. Como admin, abra o ativo `1` → devolva (return) sem problema → status volta pra `available`

Se tudo isso funcionou: **template tá no ar**.

## Próximos passos

- Customize o tema em `frontend/tailwind.config.js`
- Adicione campos custom via migration nova
- Traduza a UI em `frontend/src/lib/i18n.ts`
- Deploy: backend em qualquer container host, frontend como build estático em CDN

## Problemas comuns

| Sintoma                                  | Causa provável                                       |
| ---------------------------------------- | ---------------------------------------------------- |
| `401` em toda request                    | JWT não tá sendo enviado ou `SUPABASE_URL` errado     |
| `CORS error` no browser                  | `BACKEND_CORS_ORIGINS` não inclui a URL do frontend  |
| `404` em todas as rotas                  | FastAPI não subiu — veja `docker compose logs backend` |
| Frontend carrega mas tela vazia          | `VITE_API_BASE_URL` errado ou backend down            |
| `permission denied` no SQL Editor        | Você está usando `anon` key em vez de `service_role` |
| Migrations dão erro                      | Rode em ordem; cada migration é idempotente          |
| Login não funciona                       | Confirmar email não foi feito; ou trigger de profile não criou a row |
