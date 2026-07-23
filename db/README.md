# Banco de dados

Migrations SQL idempotentes. Aplique no Supabase antes de subir o backend.

## Como aplicar

### Opção A — Supabase CLI (recomendado)

```bash
# Na raiz do repo, com supabase CLI instalado:
supabase db push --db-url "postgresql://postgres:<password>@db.<project>.supabase.co:5432/postgres"

# Ou linked project:
supabase link --project-ref <your-project>
supabase db push
```

### Opção B — SQL Editor do Dashboard

1. Abra o Supabase Dashboard → SQL Editor
2. Cole e rode cada arquivo em `migrations/` em ordem (do mais antigo pro mais novo)
3. Cada migration é idempotente — pode re-rodar sem quebrar

## Estrutura

- 18 migrations aplicam, em ordem:
  1. Schema base (enums, tabelas, índices, RLS)
  2. Profiles + user_roles (auth)
  3. Collaborators + FK em movements
  4. Asset code auto-generator
  5. Realtime publication
  6. Kiosk role + `can_kiosk()` helper
  7. RPCs atômicas (`kiosk_register_movement`, `set_user_role`, `register_problem`, `return_with_problem`)

## Helpers SQL

```sql
-- Promover um user a admin (rode no SQL editor após o user se cadastrar):
INSERT INTO public.user_roles (user_id, role) VALUES ('<user-uuid>', 'administrador');
```
