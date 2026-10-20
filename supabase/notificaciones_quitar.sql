-- NORTHSTONE — Quitar los avisos automáticos
select cron.unschedule(jobid) from cron.job where jobname in ('ns_remind_rpe', 'ns_weekly_summary');
drop function if exists public.ns_remind_rpe();
drop function if exists public.ns_weekly_summary();
drop function if exists public.ns_send_push(jsonb);
