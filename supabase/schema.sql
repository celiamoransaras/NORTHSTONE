-- =============================================
-- NORTHSTONE — Esquema completo con autenticación
-- Pega este SQL en Supabase → SQL Editor → Run
-- =============================================

create extension if not exists "uuid-ossp";

-- ---- DEPORTISTAS ----
create table if not exists athletes (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text,
  phone text,
  dob date,
  sport text default 'Híbrido',
  color text default '#F59E0B',
  status text default 'active' check (status in ('active','injured','inactive')),
  notes text,
  created_at timestamp with time zone default now()
);

-- ---- PERFILES (vincula auth.users con roles) ----
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text default 'athlete' check (role in ('coach','athlete')),
  athlete_id uuid references athletes(id) on delete set null,
  created_at timestamp with time zone default now()
);

-- ---- SESIONES DE ENTRENAMIENTO ----
create table if not exists sessions (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  title text not null,
  type text default 'strength' check (type in ('strength','cardio','flexibility','mixed')),
  duration integer default 60,
  notes text,
  created_at timestamp with time zone default now()
);

-- ---- EJERCICIOS ----
create table if not exists exercises (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references sessions(id) on delete cascade,
  name text not null,
  sets integer default 3,
  reps text default '10',
  notes text,
  youtube_url text,
  sort_order integer default 0,
  videos jsonb default '[]'::jsonb
);

-- ---- DEPORTISTAS POR SESIÓN ----
create table if not exists session_athletes (
  session_id uuid references sessions(id) on delete cascade,
  athlete_id uuid references athletes(id) on delete cascade,
  attended boolean default false,
  primary key (session_id, athlete_id)
);

-- ---- LESIONES ----
create table if not exists injuries (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid references athletes(id) on delete cascade,
  date_start date not null,
  date_end date,
  type text,
  body_part text,
  severity text default 'mild' check (severity in ('mild','moderate','severe')),
  notes text,
  created_at timestamp with time zone default now()
);

-- ---- PAGOS ----
create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid references athletes(id) on delete cascade,
  month integer not null check (month between 1 and 12),
  year integer not null,
  amount numeric(8,2) default 80,
  status text default 'pending' check (status in ('pending','paid','exempt')),
  paid_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  unique (athlete_id, month, year)
);

-- ---- MENSAJES ----
create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  group_id text not null,
  sender text not null default 'me',
  sender_name text,
  text text not null,
  created_at timestamp with time zone default now()
);

-- =============================================
-- ÍNDICES
-- =============================================
create index if not exists idx_payments_month on payments (athlete_id, month, year);
create index if not exists idx_injuries_athlete on injuries (athlete_id);
create index if not exists idx_messages_group on messages (group_id, created_at);
create index if not exists idx_sessions_date on sessions (date);
create index if not exists idx_session_athletes on session_athletes (athlete_id);

-- =============================================
-- REALTIME (para el chat en tiempo real)
-- =============================================
alter publication supabase_realtime add table messages;

-- =============================================
-- ROW LEVEL SECURITY
-- Descomenta estas líneas cuando quieras añadir
-- seguridad por usuario (fase siguiente)
-- =============================================

-- alter table athletes enable row level security;
-- alter table sessions enable row level security;
-- alter table injuries enable row level security;
-- alter table payments enable row level security;
-- alter table messages enable row level security;
-- alter table profiles enable row level security;

-- Política temporal: acceso total mientras desarrollas
-- (ya protegida por la autenticación de la app)
