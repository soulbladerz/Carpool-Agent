-- Carpool-Agent: initial schema
-- Run inside Supabase SQL editor, or via `supabase db push`.

create extension if not exists "pgcrypto";

-- ─────────────────────────── profiles ───────────────────────────
create type user_role as enum ('owner', 'agent', 'admin');

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique,
  full_name    text,
  phone        text,
  role         user_role not null default 'agent',
  is_verified  boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'agent')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────── cars ───────────────────────────
create type car_status as enum ('available', 'flagged', 'rented', 'inactive');

create table cars (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  make        text not null,
  model       text not null,
  year        integer,
  car_type    text not null,
  plate       text,
  daily_rate  numeric(10,2) not null check (daily_rate >= 0),
  deposit     numeric(10,2) not null check (deposit >= 0),
  status      car_status not null default 'available',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index cars_owner_id_idx on cars(owner_id);
create index cars_status_idx on cars(status);
create index cars_type_idx on cars(car_type);

-- ─────────────────────────── service_areas ───────────────────────────
create table service_areas (
  id      uuid primary key default gen_random_uuid(),
  car_id  uuid not null references cars(id) on delete cascade,
  area    text not null,
  unique (car_id, area)
);
create index service_areas_area_idx on service_areas(area);

-- ─────────────────────────── flags / holds ───────────────────────────
create type flag_status as enum ('held', 'confirmed', 'released');

create table flags (
  id          uuid primary key default gen_random_uuid(),
  car_id      uuid not null references cars(id) on delete cascade,
  agent_id    uuid not null references profiles(id) on delete cascade,
  status      flag_status not null default 'held',
  expires_at  timestamptz not null default (now() + interval '24 hours'),
  created_at  timestamptz not null default now()
);
create index flags_car_id_idx on flags(car_id);
create index flags_agent_id_idx on flags(agent_id);

-- ─────────────────────────── audit_log ───────────────────────────
create table audit_log (
  id          bigserial primary key,
  actor_id    uuid references profiles(id) on delete set null,
  entity      text not null,
  entity_id   uuid,
  action      text not null,
  payload     jsonb,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────── RLS ───────────────────────────
alter table profiles      enable row level security;
alter table cars          enable row level security;
alter table service_areas enable row level security;
alter table flags         enable row level security;
alter table audit_log     enable row level security;

-- helper: current role
create or replace function public.current_role()
returns user_role
language sql
stable
as $$
  select role from profiles where id = auth.uid();
$$;

-- profiles: a user can read their own profile; admins read all.
create policy profiles_self_read on profiles
  for select using (id = auth.uid() or public.current_role() = 'admin');

create policy profiles_self_update on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_admin_update on profiles
  for update using (public.current_role() = 'admin');

-- cars: owners manage their own; agents and admins read verified-owner cars.
create policy cars_owner_all on cars
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy cars_read_for_agents on cars
  for select
  using (
    public.current_role() in ('agent', 'admin')
    and exists (
      select 1 from profiles p
      where p.id = cars.owner_id and p.is_verified = true
    )
  );

-- service_areas: same access as parent car.
create policy service_areas_owner_all on service_areas
  for all
  using (exists (select 1 from cars c where c.id = service_areas.car_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from cars c where c.id = service_areas.car_id and c.owner_id = auth.uid()));

create policy service_areas_read_for_agents on service_areas
  for select using (public.current_role() in ('agent', 'admin'));

-- flags: agent creates / reads their own; owner reads flags on their cars.
create policy flags_agent_insert on flags
  for insert with check (agent_id = auth.uid() and public.current_role() = 'agent');

create policy flags_agent_select on flags
  for select using (agent_id = auth.uid());

create policy flags_owner_select on flags
  for select using (exists (select 1 from cars c where c.id = flags.car_id and c.owner_id = auth.uid()));

create policy flags_owner_update on flags
  for update using (exists (select 1 from cars c where c.id = flags.car_id and c.owner_id = auth.uid()));

create policy flags_admin_all on flags
  for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

-- audit_log: only admins can read.
create policy audit_admin_read on audit_log
  for select using (public.current_role() = 'admin');
