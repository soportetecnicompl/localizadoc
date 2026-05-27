-- ============================================================
-- LocalizaDoc - Supabase Schema
-- Ejecuta esto en el SQL Editor de tu proyecto Supabase
-- ============================================================

-- TABLAS
create table if not exists documents (
  id uuid default gen_random_uuid() primary key,
  country text not null,
  doc_type text not null,
  doc_number text not null check (length(doc_number) > 0 and length(doc_number) < 50),
  owner_name text,
  owner_id text not null,
  contact_phone text,
  secondary_phone text,
  has_reward boolean default false,
  status text not null default 'lost' check (status in ('lost', 'found', 'match', 'recovered')),
  finder_name text,
  finder_contact text,
  hide_finder boolean default false,
  location text,
  finder_views jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists sponsors (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  logo_url text not null,
  phone text,
  email text,
  address text,
  created_at timestamptz default now()
);

create table if not exists honesty_submissions (
  id uuid default gen_random_uuid() primary key,
  report_id uuid,
  owner_id text not null,
  finder_name text,
  finder_contact text,
  owner_message text not null check (length(owner_message) > 0 and length(owner_message) < 1000),
  status text not null default 'pending' check (status in ('pending', 'approved')),
  created_at timestamptz default now()
);

-- Replica identity completa para que Realtime envie la fila completa en DELETE
alter table documents replica identity full;
alter table sponsors replica identity full;
alter table honesty_submissions replica identity full;

-- ROW LEVEL SECURITY
alter table documents enable row level security;
alter table sponsors enable row level security;
alter table honesty_submissions enable row level security;

-- REALTIME
alter publication supabase_realtime add table documents;
alter publication supabase_realtime add table sponsors;
alter publication supabase_realtime add table honesty_submissions;

-- Policies: documents
create policy "Lectura publica de documentos"
  on documents for select using (true);

create policy "Usuarios autenticados pueden crear documentos"
  on documents for insert
  with check (auth.role() = 'authenticated');

create policy "Usuarios autenticados pueden actualizar documentos"
  on documents for update
  using (auth.role() = 'authenticated');

create policy "Usuarios autenticados pueden eliminar documentos"
  on documents for delete
  using (auth.role() = 'authenticated');

-- Policies: sponsors
create policy "Lectura publica de sponsors"
  on sponsors for select using (true);

create policy "Solo admins pueden crear sponsors"
  on sponsors for insert
  with check (auth.jwt() ->> 'email' is not null);

create policy "Solo admins pueden actualizar sponsors"
  on sponsors for update
  using (auth.jwt() ->> 'email' is not null);

create policy "Solo admins pueden eliminar sponsors"
  on sponsors for delete
  using (auth.jwt() ->> 'email' is not null);

-- Policies: honesty_submissions
create policy "Lectura publica de honesty"
  on honesty_submissions for select using (true);

create policy "Usuarios autenticados pueden crear honesty"
  on honesty_submissions for insert
  with check (auth.role() = 'authenticated');

create policy "Solo admins pueden actualizar honesty"
  on honesty_submissions for update
  using (auth.jwt() ->> 'email' is not null);

create policy "Solo admins pueden eliminar honesty"
  on honesty_submissions for delete
  using (auth.jwt() ->> 'email' is not null);

-- ============================================================
-- IMPORTANTE: En el dashboard de Supabase ve a:
-- Authentication > Providers > Habilita "Anonymous sign-ins"
-- ============================================================

-- ============================================================
-- MIGRACION 2026-05-26: owner_uid / finder_uid para RLS seguro
-- ============================================================
alter table documents add column if not exists owner_uid uuid;
alter table documents add column if not exists finder_uid uuid;

drop policy if exists "Usuarios autenticados pueden actualizar documentos" on documents;
drop policy if exists "Usuarios autenticados pueden eliminar documentos" on documents;

create policy "Owner or finder can update"
  on documents for update
  using (
    auth.uid() = owner_uid OR
    auth.uid() = finder_uid OR
    auth.jwt() ->> 'email' is not null
  );

create policy "Owner can delete"
  on documents for delete
  using (
    auth.uid() = owner_uid OR
    auth.jwt() ->> 'email' is not null
  );

-- ============================================================
-- MIGRACION 2026-05-26: reward_amount para monto de recompensa
-- ============================================================
alter table documents add column if not exists reward_amount text;
