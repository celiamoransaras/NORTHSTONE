-- =============================================================
-- NORTHSTONE — Alta (consentimiento + cuestionario), peticiones de
-- cambio de día y notas privadas de la entrenadora
-- -------------------------------------------------------------
-- Cómo aplicarlo: Supabase → SQL Editor → pegar todo → Run.
-- Se puede ejecutar varias veces sin problema.
-- =============================================================

-- ---------- Cuestionario de alta y consentimiento ----------
create table if not exists public.athlete_intake (
  athlete_id uuid primary key references public.athletes(id) on delete cascade,
  consent_privacy boolean not null default false,
  consent_health boolean not null default false,
  consent_version text,
  consent_at timestamptz,
  parq jsonb default '{}'::jsonb,        -- respuestas sí/no del cuestionario de salud
  parq_flag boolean default false,        -- alguna respuesta "sí"
  goals text,
  availability jsonb default '[]'::jsonb, -- días que puede entrenar
  sessions_per_week int,
  equipment text,
  injuries_history text,
  medical_notes text,
  deletion_requested_at timestamptz,
  coach_seen_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- Peticiones de cambio de día ----------
create table if not exists public.session_change_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade,
  athlete_id uuid references public.athletes(id) on delete cascade,
  from_date date not null,
  to_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  created_at timestamptz default now(),
  resolved_at timestamptz
);
create index if not exists idx_change_requests_status on public.session_change_requests (status, created_at desc);

-- ---------- Notas privadas (solo la entrenadora) ----------
create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.athletes(id) on delete cascade,
  text text not null,
  pinned boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_coach_notes_athlete on public.coach_notes (athlete_id, created_at desc);

-- ---------- Seguridad ----------
alter table public.athlete_intake enable row level security;
alter table public.session_change_requests enable row level security;
alter table public.coach_notes enable row level security;

drop policy if exists ns_coach_all on public.athlete_intake;
drop policy if exists ns_athlete_select on public.athlete_intake;
drop policy if exists ns_athlete_insert on public.athlete_intake;
drop policy if exists ns_athlete_update on public.athlete_intake;
create policy ns_coach_all on public.athlete_intake for all to authenticated using (public.ns_is_coach()) with check (public.ns_is_coach());
create policy ns_athlete_select on public.athlete_intake for select to authenticated using (athlete_id = public.ns_my_athlete_id());
create policy ns_athlete_insert on public.athlete_intake for insert to authenticated with check (athlete_id = public.ns_my_athlete_id());
create policy ns_athlete_update on public.athlete_intake for update to authenticated using (athlete_id = public.ns_my_athlete_id()) with check (athlete_id = public.ns_my_athlete_id());

drop policy if exists ns_coach_all on public.session_change_requests;
drop policy if exists ns_athlete_select on public.session_change_requests;
drop policy if exists ns_athlete_insert on public.session_change_requests;
drop policy if exists ns_athlete_update on public.session_change_requests;
create policy ns_coach_all on public.session_change_requests for all to authenticated using (public.ns_is_coach()) with check (public.ns_is_coach());
create policy ns_athlete_select on public.session_change_requests for select to authenticated using (athlete_id = public.ns_my_athlete_id());
-- La deportista solo puede pedir cambios de SUS sesiones
create policy ns_athlete_insert on public.session_change_requests for insert to authenticated
  with check (
    athlete_id = public.ns_my_athlete_id() and status = 'pending'
    and exists (select 1 from public.session_athletes sa where sa.session_id = session_change_requests.session_id and sa.athlete_id = public.ns_my_athlete_id())
  );
-- ...y solo cancelar las suyas pendientes
create policy ns_athlete_update on public.session_change_requests for update to authenticated
  using (athlete_id = public.ns_my_athlete_id() and status = 'pending')
  with check (athlete_id = public.ns_my_athlete_id() and status = 'cancelled');

drop policy if exists ns_coach_all on public.coach_notes;
create policy ns_coach_all on public.coach_notes for all to authenticated using (public.ns_is_coach()) with check (public.ns_is_coach());

-- Comprobación (opcional):
-- select relname, relrowsecurity from pg_class where relname in ('athlete_intake','session_change_requests','coach_notes');
