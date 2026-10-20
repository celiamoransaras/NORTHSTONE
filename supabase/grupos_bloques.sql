-- =============================================================
-- NORTHSTONE — Grupos de deportistas y bloques de entreno guardados
-- Cómo aplicarlo: Supabase → SQL Editor → pegar todo → Run.
-- Se puede ejecutar varias veces sin problema.
-- =============================================================
create table if not exists public.athlete_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  athlete_ids uuid[] not null default '{}',
  created_at timestamptz default now()
);

create table if not exists public.coach_blocks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  videos jsonb default '[]'::jsonb,
  category text,
  created_at timestamptz default now()
);

alter table public.athlete_groups enable row level security;
alter table public.coach_blocks enable row level security;
drop policy if exists ns_coach_all on public.athlete_groups;
drop policy if exists ns_coach_all on public.coach_blocks;
create policy ns_coach_all on public.athlete_groups for all to authenticated using (public.ns_is_coach()) with check (public.ns_is_coach());
create policy ns_coach_all on public.coach_blocks for all to authenticated using (public.ns_is_coach()) with check (public.ns_is_coach());
