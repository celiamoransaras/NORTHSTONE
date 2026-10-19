-- NORTHSTONE — Deshacer la seguridad por usuario (vuelve al estado anterior).
-- Úsalo solo si tras aplicar rls.sql algo deja de funcionar.
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
      execute format('alter table public.%I disable row level security', t);
    end if;
  end loop;
end $$;
