-- =============================================================
-- NORTHSTONE — Cuestionario de alta v2 (salud femenina, deporte, día a día)
-- Cómo aplicarlo: Supabase → SQL Editor → pegar todo → Run.
-- =============================================================
alter table public.athlete_intake add column if not exists v2 jsonb default '{}'::jsonb;
alter table public.athlete_intake add column if not exists intake_version int default 1;
