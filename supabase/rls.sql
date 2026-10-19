-- =============================================================
-- NORTHSTONE — Seguridad por usuario (Row Level Security)
-- -------------------------------------------------------------
-- Qué hace:
--   · La entrenadora (role = 'coach') y la nutricionista (role = 'nutritionist')
--     pueden ver y editar todo, como hasta ahora.
--   · Cada deportista solo puede ver y editar SUS datos.
--   · Sin sesión iniciada no se puede leer nada.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar todo → Run.
-- Se puede ejecutar varias veces sin problema (es idempotente).
--
-- Cómo deshacerlo si algo falla: ejecutar supabase/rls_rollback.sql
-- =============================================================

-- ---------- Funciones auxiliares ----------
-- SECURITY DEFINER para que puedan leer "profiles" sin chocar con sus propias políticas.

create or replace function public.ns_is_coach()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('coach', 'nutritionist')
  );
$$;

create or replace function public.ns_my_athlete_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select athlete_id from public.profiles where id = auth.uid();
$$;

grant execute on function public.ns_is_coach() to authenticated;
grant execute on function public.ns_my_athlete_id() to authenticated;

-- ---------- Activar RLS en todas las tablas ----------
do $$
declare t text;
begin
  foreach t in array array[
    'athletes','profiles','sessions','exercises','session_athletes','session_templates',
    'injuries','payments','documents','messages','message_reactions','personal_records',
    'goals','wellness','achievements','weight_logs','nutrition_plans','nutrition_logs',
    'push_subscriptions'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      -- Borrar políticas antiguas de este script para poder re-ejecutarlo
      execute format('drop policy if exists ns_coach_all on public.%I', t);
      execute format('drop policy if exists ns_athlete_select on public.%I', t);
      execute format('drop policy if exists ns_athlete_insert on public.%I', t);
      execute format('drop policy if exists ns_athlete_update on public.%I', t);
      execute format('drop policy if exists ns_athlete_delete on public.%I', t);
      -- La entrenadora puede hacer de todo en todas las tablas
      execute format(
        'create policy ns_coach_all on public.%I for all to authenticated using (public.ns_is_coach()) with check (public.ns_is_coach())', t);
    end if;
  end loop;
end $$;

-- ---------- PROFILES ----------
-- Cada usuario ve su perfil; todas pueden ver el perfil de la entrenadora (foto en el chat).
create policy ns_athlete_select on public.profiles for select to authenticated
  using (id = auth.uid() or role = 'coach');
-- Al entrar por primera vez la app crea el perfil: solo como deportista
-- (o como coach si es el email de Celia) y solo vinculado a su propia ficha.
create policy ns_athlete_insert on public.profiles for insert to authenticated
  with check (
    id = auth.uid()
    and (
      (role = 'athlete' and (
        athlete_id is null
        or athlete_id in (select a.id from public.athletes a where lower(a.email) = lower(auth.email()))
      ))
      or (role = 'coach' and lower(auth.email()) = 'celia.moransaras@gmail.com')
    )
  );

-- ---------- ATHLETES ----------
-- La deportista ve su ficha (también la encuentra por email la primera vez).
create policy ns_athlete_select on public.athletes for select to authenticated
  using (id = public.ns_my_athlete_id() or lower(email) = lower(auth.email()));
-- Puede actualizar su ficha (foto, duración del ciclo...).
create policy ns_athlete_update on public.athletes for update to authenticated
  using (id = public.ns_my_athlete_id())
  with check (id = public.ns_my_athlete_id());

-- ---------- SESSIONS / EXERCISES (solo lectura de lo que tiene asignado) ----------
create policy ns_athlete_select on public.sessions for select to authenticated
  using (exists (
    select 1 from public.session_athletes sa
    where sa.session_id = sessions.id and sa.athlete_id = public.ns_my_athlete_id()
  ));
create policy ns_athlete_select on public.exercises for select to authenticated
  using (exists (
    select 1 from public.session_athletes sa
    where sa.session_id = exercises.session_id and sa.athlete_id = public.ns_my_athlete_id()
  ));

-- ---------- SESSION_ATHLETES (asistencia y valoración de esfuerzo) ----------
create policy ns_athlete_select on public.session_athletes for select to authenticated
  using (athlete_id = public.ns_my_athlete_id());
create policy ns_athlete_update on public.session_athletes for update to authenticated
  using (athlete_id = public.ns_my_athlete_id())
  with check (athlete_id = public.ns_my_athlete_id());

-- ---------- Tablas "propias" de la deportista: lectura y escritura de lo suyo ----------
do $$
declare t text;
begin
  foreach t in array array[
    'injuries','personal_records','wellness','achievements','weight_logs','nutrition_logs'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('create policy ns_athlete_select on public.%I for select to authenticated using (athlete_id = public.ns_my_athlete_id())', t);
      execute format('create policy ns_athlete_insert on public.%I for insert to authenticated with check (athlete_id = public.ns_my_athlete_id())', t);
      execute format('create policy ns_athlete_update on public.%I for update to authenticated using (athlete_id = public.ns_my_athlete_id()) with check (athlete_id = public.ns_my_athlete_id())', t);
      execute format('create policy ns_athlete_delete on public.%I for delete to authenticated using (athlete_id = public.ns_my_athlete_id())', t);
    end if;
  end loop;
end $$;

-- ---------- Tablas que la deportista solo lee ----------
do $$
declare t text;
begin
  foreach t in array array['payments','goals','nutrition_plans'] loop
    if to_regclass('public.' || t) is not null then
      execute format('create policy ns_athlete_select on public.%I for select to authenticated using (athlete_id = public.ns_my_athlete_id())', t);
    end if;
  end loop;
end $$;

-- ---------- DOCUMENTS ----------
-- Generales de la entrenadora + los suyos (incluidos los médicos de su ficha).
create policy ns_athlete_select on public.documents for select to authenticated
  using (
    category is null or category = 'general'
    or athlete_id = public.ns_my_athlete_id()
  );
create policy ns_athlete_insert on public.documents for insert to authenticated
  with check (athlete_id = public.ns_my_athlete_id());

-- ---------- MESSAGES ----------
-- Chat de grupo ('general') y su chat privado (group_id = id de la deportista).
create policy ns_athlete_select on public.messages for select to authenticated
  using (group_id = 'general' or group_id = public.ns_my_athlete_id()::text);
create policy ns_athlete_insert on public.messages for insert to authenticated
  with check (
    (group_id = 'general' or group_id = public.ns_my_athlete_id()::text)
    and sender = public.ns_my_athlete_id()::text
  );

-- ---------- MESSAGE_REACTIONS ----------
create policy ns_athlete_select on public.message_reactions for select to authenticated
  using (group_id = 'general' or group_id = public.ns_my_athlete_id()::text);
create policy ns_athlete_insert on public.message_reactions for insert to authenticated
  with check (
    (group_id = 'general' or group_id = public.ns_my_athlete_id()::text)
    and sender_id = public.ns_my_athlete_id()::text
  );
create policy ns_athlete_delete on public.message_reactions for delete to authenticated
  using (sender_id = public.ns_my_athlete_id()::text);

-- ---------- PUSH_SUBSCRIPTIONS ----------
-- Cada deportista gestiona solo sus suscripciones. El envío lo hace la función
-- send-push con la clave de servicio, que no se ve afectada por RLS.
create policy ns_athlete_select on public.push_subscriptions for select to authenticated
  using (athlete_id = public.ns_my_athlete_id());
create policy ns_athlete_insert on public.push_subscriptions for insert to authenticated
  with check (athlete_id = public.ns_my_athlete_id());
create policy ns_athlete_delete on public.push_subscriptions for delete to authenticated
  using (athlete_id = public.ns_my_athlete_id());

-- =============================================================
-- Comprobación rápida (opcional): debe devolver todas las tablas con rls = true
-- select relname, relrowsecurity as rls from pg_class
--   where relnamespace = 'public'::regnamespace and relkind = 'r' order by 1;
-- =============================================================
