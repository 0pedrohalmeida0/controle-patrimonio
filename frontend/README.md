# controle-patrimonio — frontend

Frontend React/TypeScript do template **controle-patrimonio**.
Stack: Vite + React 18 + TypeScript + Tailwind + Radix (UI mínima) +
TanStack Query + Supabase JS + react-router-dom v6 + PWA (vite-plugin-pwa).

## Setup local

```bash
cp .env.example .env
# edite VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL
npm install
npm run dev      # http://localhost:5173
```

## Scripts

| Script              | O que faz                                  |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Vite dev server (HMR)                      |
| `npm run build`     | `tsc --noEmit` + build de produção (PWA)   |
| `npm run preview`   | Serve o `dist/` localmente                 |
| `npm run typecheck` | Type-check sem emit                        |

## Docker

```bash
docker build -t controle-patrimonio-frontend .
docker run -p 8080:80 controle-patrimonio-frontend
```

O `nginx.conf` interno configura SPA fallback (`/index.html`), service
worker sem cache e gzip para assets textuais.

## Estrutura

```
src/
├── components/        AppShell, AppShell children, badges, dialogs
│   ├── ui/            primitivos shadcn-style (Button, Input, Card, …)
│   └── …
├── hooks/             use-debounce, use-pwa-install, use-mobile, use-theme
├── lib/
│   ├── api.ts         fetch wrapper com JWT + refresh em 401
│   ├── auth.tsx       AuthProvider + useAuth + useProfile
│   ├── i18n.ts        dicionário PT-BR
│   ├── realtime.ts    helper useRealtimeChannel
│   ├── supabase.ts    cliente Supabase
│   ├── types.ts       tipos compartilhados com o backend
│   └── utils.ts       cn + formatadores
├── routes/            12 rotas (auth, dashboard, ativos, kiosk, …)
├── App.tsx            roteamento + Suspense
├── main.tsx           entrypoint (QueryClient, PWA register)
└── index.css          Tailwind directives + CSS variables de tema
```

## Notas

- **Sem `ALLOWED_DOMAIN`** (versão genérica). A constante `mor.com.br` do
  projeto original foi removida.
- **Sem `/me/bootstrap`**. O signup do Supabase Auth já dispara o
  trigger (se a tabela `profiles` tiver). Se não, o admin cria o profile
  manualmente via SQL: ver `../db/README.md`.
- **Kiosk** entra em tela cheia automaticamente; o usuário pode sair
  pelo menu.
- **PWA** está configurada com `registerType: 'autoUpdate'` e manifest
  com ícones placeholder em `public/pwa-{192,512}x512.png`.
