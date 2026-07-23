# Deliverable — Frontend React/TS (Vite + PWA)

> Veja também: `/workspace/.mavis/plans/plan_d6848ad1/outputs/frontend-react/deliverable.md`
> (versão completa do entregável da task).

## Resumo

Frontend do `controle-patrimonio` re-escrito do zero (sem copiar do
`lumin-ria-hub`) em Vite 5 + React 18 + TypeScript + Tailwind 3 + PWA.
12 rotas, Supabase Auth direto, mutations via FastAPI com JWT,
realtime via CDC do Supabase, dark mode, toasts via sonner, gráficos
Recharts. Typecheck e build verdes; sem `mor.com.br` no código.

## Arquivos criados

Configuração (raiz de `frontend/`):
- `package.json`, `package-lock.json`
- `tsconfig.json`, `tsconfig.node.json`
- `vite.config.ts` (vite-plugin-pwa com manifest "Controle Patrimônio")
- `tailwind.config.js`, `postcss.config.js`
- `index.html`
- `Dockerfile` (multi-stage node:20-alpine → nginx:alpine)
- `nginx.conf`
- `.env.example`, `README.md`
- `public/favicon.svg`, `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/robots.txt`

Source (`src/`):
- `main.tsx`, `App.tsx`, `index.css`
- `lib/`: `api.ts`, `auth.tsx`, `i18n.ts`, `realtime.ts`, `supabase.ts`, `types.ts`, `utils.ts`
- `hooks/`: `use-debounce.ts`, `use-mobile.tsx`, `use-pwa-install.ts`, `use-theme.tsx`
- `components/`: `AppShell.tsx`, `AssetCard.tsx`, `EmptyState.tsx`,
  `MovementDialog.tsx`, `PageHeader.tsx`, `ProtectedRoute.tsx`,
  `RoleBadge.tsx`, `StatusBadge.tsx`, `ThemeToggle.tsx`
- `components/ui/`: `avatar.tsx`, `badge.tsx`, `button.tsx`, `card.tsx`,
  `dialog.tsx`, `dropdown-menu.tsx`, `index.ts`, `input.tsx`,
  `label.tsx`, `select.tsx`, `sheet.tsx`, `table.tsx`, `textarea.tsx`
- `routes/`: `auth.tsx`, `index.tsx`, `ativos.tsx`, `ativos.$id.tsx`,
  `tipos.tsx`, `colaboradores.tsx`, `movimentacoes.tsx`, `problemas.tsx`,
  `indicadores.tsx`, `kiosk.tsx`, `kiosk.setup.tsx`, `usuarios.tsx`

## Decisões

1. **Sem `ALLOWED_DOMAIN`** — removida a constante `mor.com.br` que
   existia no source.
2. **Sem endpoint `/me/bootstrap`** — signup delega ao Supabase Auth
   + `data: { full_name }`. O trigger (se existir) cria o profile;
   caso contrário, admin cria via SQL (documentado em `db/README.md`).
3. **`api<T>(path, init?)`** wrapper com:
   - Injeção de `Authorization: Bearer <jwt>` (token provider injetado
     pelo `AuthProvider`).
   - `Content-Type: application/json`.
   - Em 401, chama `supabase.auth.refreshSession()` e re-tenta 1x.
   - Tradução PT-BR via `ApiError` (401/403/404/409/5xx + `detail`).
4. **Realtime** — `useRealtimeChannel(table, onChange, filter?)` cria
   `supabase.channel('public:' + table).on('postgres_changes', …)`.
   O `AppShell` monta 5 channels (assets, movements, problems,
   asset_types, collaborators) que invalidam as queries do
   `@tanstack/react-query`.
5. **PWA** — `registerType: 'autoUpdate'`, manifest PT-BR, ícones
   192/512 placeholder gerados do favicon SVG (não da logo da MOR).
6. **Kiosk** — state machine completa: `idle → choosing-type →
   choosing-asset → badge → confirming → success | error` (mais
   `returning` para devolução). Tenta `requestFullscreen()` no mount.
7. **Dark mode** — `useTheme` context + classe `.dark` no `<html>` +
   CSS variables no `index.css`.
8. **TypeScript strict** — `strict`, `noUnusedLocals`,
   `noUnusedParameters`, `noFallthroughCasesInSwitch`. Alias `@/*`.
9. **Code-splitting** — `React.lazy` em todas as rotas; main bundle
   fica em ~600 kB gzip 178 kB (Supabase + Radix).

## Desvios do DESIGN.md

- Nenhum desvio material. O DESIGN.md pede `react-router-dom` (usei
  v6) e TanStack Query (usei v5 com `staleTime: 30_000` no
  `QueryClient` global, em vez de por-query — equivalente).
- O DESIGN pede `vite-plugin-pwa` configurado para "Controle
  Patrimônio" — implementado em `vite.config.ts` (linha 14).
- O DESIGN pede "hook useProfile que carrega /me na primeira montagem
  após login" — implementado em `lib/auth.tsx` (`useProfile`).
- O DESIGN pede que persistência de token NÃO use localStorage
  (apenas memória) — segui a nota do próprio DESIGN: "Supabase
  client já persiste o session internamente em localStorage; tudo
  bem pra esse template (em produção real, mudaria pra cookie
  httpOnly)". O `AuthContext` mantém a sessão no state do React
  (memória), e o client Supabase persiste via localStorage. Nenhuma
  outra camada escreve token em localStorage.

## Verificação

- `npm install` (513 pacotes) — ok.
- `npm run typecheck` — exit 0.
- `npm run build` — gera `dist/` com `sw.js`, `workbox-*.js`,
  `manifest.webmanifest`, 42 entries no precache.
- `grep -rni "mor.com.br\|metalurgica\|MOR\b" src/` — vazio.
- Commit `f3a2693` em `main` (push OK).
