-- =============================================
-- NORTHSTONE — Esquema de base de datos Supabase
-- Ejecuta este SQL en el Editor SQL de Supabase
-- =============================================

-- Habilitar extensión UUID
create extension if not exists "uuid-ossp";

-- ---- DEPORTISTAS ----
create table athletes (
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

-- ---- SESIONES DE ENTRENAMIENTO ----
create table sessions (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  title text not null,
  type text default 'strength' check (type in ('strength','cardio','flexibility','mixed')),
  duration integer default 60,
  notes text,
  created_at timestamp with time zone default now()
);

-- ---- EJERCICIOS POR SESIÓN ----
create table exercises (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references sessions(id) on delete cascade,
  name text not null,
  sets integer default 3,
  reps text default '10',
  notes text,
  youtube_url text,
  sort_order integer default 0
);

-- ---- DEPORTISTAS POR SESIÓN ----
create table session_athletes (
  session_id uuid references sessions(id) on delete cascade,
  athlete_id uuid references athletes(id) on delete cascade,
  attended boolean default false,
  primary key (session_id, athlete_id)
);

-- ---- LESIONES ----
create table injuries (
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
create table payments (
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
create table messages (
  id uuid primary key default uuid_generate_v4(),
  group_id text not null,
  sender text not null default 'me',
  sender_name text,
  text text not null,
  created_at timestamp with time zone default now()
);

-- =============================================
-- Row Level Security (RLS) — Seguridad básica
-- Actívalo cuando añadas autenticación
-- =============================================

-- alter table athletes enable row level security;
-- alter table sessions enable row level security;
-- alter table injuries enable row level security;
-- alter table payments enable row level security;
-- alter table messages enable row level security;

-- =============================================
-- Índices para mejor rendimiento
-- =============================================
create index on payments (athlete_id, month, year);
create index on injuries (athlete_id);
create index on messages (group_id, created_at);
create index on sessions (date);
