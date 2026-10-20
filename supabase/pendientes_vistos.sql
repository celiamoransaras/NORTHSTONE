-- =============================================================
-- NORTHSTONE — Avisos de "Pendientes" marcados como vistos
-- Así, lo que cierras en el móvil también desaparece en el ordenador.
-- Cómo aplicarlo: Supabase → SQL Editor → pegar todo → Run.
-- =============================================================
create table if not exists public.coach_dismissed (
  key text primary key,
  dismissed_at timestamptz default now()
);
alter table public.coach_dismissed enable row level security;
drop policy if exists ns_coach_all on public.coach_dismissed;
create policy ns_coach_all on public.coach_dismissed for all to authenticated using (public.ns_is_coach()) with check (public.ns_is_coach());
