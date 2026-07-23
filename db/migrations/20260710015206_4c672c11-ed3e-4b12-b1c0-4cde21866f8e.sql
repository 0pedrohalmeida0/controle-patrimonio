
-- Enums
CREATE TYPE public.asset_status AS ENUM ('available', 'in_use', 'problem');
CREATE TYPE public.movement_type AS ENUM ('withdraw', 'return');
CREATE TYPE public.problem_status AS ENUM ('open', 'resolved');

-- Tipos de equipamento
CREATE TABLE public.asset_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  multi_use_per_day BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_types TO anon, authenticated;
GRANT ALL ON public.asset_types TO service_role;
ALTER TABLE public.asset_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read asset_types" ON public.asset_types FOR SELECT USING (true);
CREATE POLICY "Public write asset_types" ON public.asset_types FOR ALL USING (true) WITH CHECK (true);

-- Ativos
CREATE TABLE public.assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type_id UUID NOT NULL REFERENCES public.asset_types(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  status public.asset_status NOT NULL DEFAULT 'available',
  current_holder TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (type_id, number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO anon, authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read assets" ON public.assets FOR SELECT USING (true);
CREATE POLICY "Public write assets" ON public.assets FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_assets_type ON public.assets(type_id);
CREATE INDEX idx_assets_status ON public.assets(status);

-- Movimentações
CREATE TABLE public.movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  type public.movement_type NOT NULL,
  holder TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.movements TO anon, authenticated;
GRANT ALL ON public.movements TO service_role;
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read movements" ON public.movements FOR SELECT USING (true);
CREATE POLICY "Public write movements" ON public.movements FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_movements_asset ON public.movements(asset_id);
CREATE INDEX idx_movements_created ON public.movements(created_at DESC);

-- Problemas
CREATE TABLE public.problems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  status public.problem_status NOT NULL DEFAULT 'open',
  reported_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.problems TO anon, authenticated;
GRANT ALL ON public.problems TO service_role;
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read problems" ON public.problems FOR SELECT USING (true);
CREATE POLICY "Public write problems" ON public.problems FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_problems_asset ON public.problems(asset_id);
CREATE INDEX idx_problems_status ON public.problems(status);
