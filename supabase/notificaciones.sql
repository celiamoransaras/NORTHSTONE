-- =============================================================
-- NORTHSTONE — Avisos automáticos
-- -------------------------------------------------------------
--  1) Cada día a las 21:00 (hora de Madrid): aviso a las deportistas
--     que tenían entreno hoy y aún no lo han valorado.
--  2) Cada domingo a las 19:00 (hora de Madrid): resumen de la semana
--     para la entrenadora (sesiones hechas, check-ins, quién no ha entrenado
--     y pagos pendientes del mes).
--
-- Solo llega a quien tiene activadas las notificaciones en la app.
-- Cómo aplicarlo: Supabase → SQL Editor → pegar todo → Run.
-- Se puede ejecutar varias veces. Para quitarlo: notificaciones_quitar.sql
-- =============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Envía una notificación a través de la función send-push (la misma que usa la app).
-- La clave es la pública de la app (la misma que va dentro de la web).
create or replace function public.ns_send_push(payload jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform net.http_post(
    url     := 'https://yxizhqfkajznbdigfxho.supabase.co/functions/v1/send-push',
    body    := payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aXpocWZrYWp6bmJkaWdmeGhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NjkxMzcsImV4cCI6MjA5NjI0NTEzN30.LZxbHk2wdGKqDcMZQQaXeeXX-uEvzse6Gt6KDKzKnpA'
    )
  );
end $$;

-- ---------- 1) Recordatorio de valorar el entreno ----------
create or replace function public.ns_remind_rpe()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  madrid timestamp := now() at time zone 'Europe/Madrid';
  ids text[];
begin
  -- Se programa a dos horas UTC para acertar con el cambio de hora; solo actúa a las 21 h de Madrid
  if extract(hour from madrid) <> 21 then return; end if;

  select array_agg(distinct sa.athlete_id::text) into ids
  from session_athletes sa
  join sessions s on s.id = sa.session_id
  join athletes a on a.id = sa.athlete_id
  where s.date = madrid::date
    and coalesce(s.type, '') <> 'rest_day'
    and sa.rpe is null
    and coalesce(a.status, 'active') <> 'inactive';

  if ids is null then return; end if;

  perform public.ns_send_push(jsonb_build_object(
    'athleteIds', to_jsonb(ids),
    'notification', jsonb_build_object(
      'title', '⭐ ¿Qué tal el entreno de hoy?',
      'body',  'Valora tu esfuerzo en 20 segundos: así Celia ajusta tu plan.',
      'url',   '/?tab=training'
    )
  ));
end $$;

-- ---------- 2) Resumen semanal para la entrenadora ----------
create or replace function public.ns_weekly_summary()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  madrid timestamp := now() at time zone 'Europe/Madrid';
  today date := (now() at time zone 'Europe/Madrid')::date;
  monday date := today - (extract(isodow from today)::int - 1);
  total int; done int; checkins int; idle int; pending int; pct int;
  body text;
begin
  if extract(hour from madrid) <> 19 then return; end if;

  select count(*), count(*) filter (where sa.attended)
    into total, done
  from session_athletes sa
  join sessions s on s.id = sa.session_id
  where s.date between monday and today
    and coalesce(s.type, '') <> 'rest_day';

  select count(*) into checkins from wellness where date between monday and today;

  select count(*) into idle
  from athletes a
  where coalesce(a.status, 'active') = 'active'
    and not exists (
      select 1 from session_athletes sa join sessions s on s.id = sa.session_id
      where sa.athlete_id = a.id and sa.attended and s.date between monday and today
    );

  select count(*) into pending
  from payments
  where month = extract(month from today) and year = extract(year from today)
    and status = 'pending' and coalesce(amount, 0) > 0;

  if total = 0 and checkins = 0 then return; end if;

  pct := case when total > 0 then round(done * 100.0 / total) else 0 end;
  body := done || '/' || total || ' sesiones hechas (' || pct || '%) · ' || checkins || case when checkins = 1 then ' check-in' else ' check-ins' end;
  if idle > 0 then body := body || ' · ' || idle || case when idle = 1 then ' deportista sin entrenar' else ' deportistas sin entrenar' end; end if;
  if pending > 0 then body := body || ' · ' || pending || case when pending = 1 then ' pago pendiente' else ' pagos pendientes' end; end if;

  perform public.ns_send_push(jsonb_build_object(
    'toCoach', true,
    'notification', jsonb_build_object('title', '📊 Tu semana en Northstone', 'body', body, 'url', '/')
  ));
end $$;

-- Nadie puede lanzar estas funciones desde la app: solo el programador de tareas
revoke execute on function public.ns_send_push(jsonb) from public, anon, authenticated;
revoke execute on function public.ns_remind_rpe() from public, anon, authenticated;
revoke execute on function public.ns_weekly_summary() from public, anon, authenticated;

-- ---------- Programación (horas en UTC; cubre horario de invierno y de verano) ----------
select cron.unschedule(jobid) from cron.job where jobname in ('ns_remind_rpe', 'ns_weekly_summary');
select cron.schedule('ns_remind_rpe',     '0 19,20 * * *', 'select public.ns_remind_rpe()');
select cron.schedule('ns_weekly_summary', '0 17,18 * * 0', 'select public.ns_weekly_summary()');

-- Comprobación (opcional): select jobname, schedule, active from cron.job;
