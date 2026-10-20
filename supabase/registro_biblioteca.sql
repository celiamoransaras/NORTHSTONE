-- =============================================================
-- NORTHSTONE — Registro de series/pesos/tiempos y biblioteca de ejercicios
-- Cómo aplicarlo: Supabase → SQL Editor → pegar todo → Run.
-- Se puede ejecutar varias veces sin problema.
-- =============================================================

-- Lo que apunta la deportista en cada línea de un entreno
create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade,
  athlete_id uuid references public.athletes(id) on delete cascade,
  block_idx int not null,
  line_idx int not null,
  line_text text,
  exercise_key text,       -- ejercicio de la biblioteca (o el texto normalizado)
  exercise_name text,
  kind text,               -- strength | reps | time | carry
  sets jsonb not null default '[]'::jsonb,  -- [{kg, reps, time, dist}]
  notes text,
  date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (session_id, athlete_id, block_idx, line_idx)
);
create index if not exists idx_workout_logs_athlete on public.workout_logs (athlete_id, exercise_key, date);

-- Ajustes de la entrenadora sobre la biblioteca (vídeo propio, indicaciones) y ejercicios nuevos
create table if not exists public.coach_exercises (
  id uuid primary key default gen_random_uuid(),
  base_key text,           -- si personaliza uno de la biblioteca base
  name text not null,
  category text,
  kind text,
  cues text,
  video_url text,
  hidden boolean default false,
  created_at timestamptz default now()
);

alter table public.workout_logs enable row level security;
alter table public.coach_exercises enable row level security;

drop policy if exists ns_coach_all on public.workout_logs;
drop policy if exists ns_athlete_select on public.workout_logs;
drop policy if exists ns_athlete_insert on public.workout_logs;
drop policy if exists ns_athlete_update on public.workout_logs;
drop policy if exists ns_athlete_delete on public.workout_logs;
create policy ns_coach_all on public.workout_logs for all to authenticated using (public.ns_is_coach()) with check (public.ns_is_coach());
create policy ns_athlete_select on public.workout_logs for select to authenticated using (athlete_id = public.ns_my_athlete_id());
create policy ns_athlete_insert on public.workout_logs for insert to authenticated with check (athlete_id = public.ns_my_athlete_id());
create policy ns_athlete_update on public.workout_logs for update to authenticated using (athlete_id = public.ns_my_athlete_id()) with check (athlete_id = public.ns_my_athlete_id());
create policy ns_athlete_delete on public.workout_logs for delete to authenticated using (athlete_id = public.ns_my_athlete_id());

drop policy if exists ns_coach_all on public.coach_exercises;
drop policy if exists ns_read_all on public.coach_exercises;
create policy ns_coach_all on public.coach_exercises for all to authenticated using (public.ns_is_coach()) with check (public.ns_is_coach());
-- Las deportistas pueden leer la biblioteca (para ver vídeos e indicaciones)
create policy ns_read_all on public.coach_exercises for select to authenticated using (true);
