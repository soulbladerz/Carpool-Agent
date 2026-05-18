-- Carpool-Agent: member marketplace redesign.
--
-- Collapses the owner/agent split into a single `member` role. Every member
-- both lists cars AND posts customer requests. Replaces the flag/hold model
-- with three new entities: requests, offers, bookings, plus a private side
-- table that keeps customer PII away from car owners.

-- ─────────────────────────── role: add `member` ───────────────────────────

alter type user_role add value if not exists 'member';

-- Backfill existing owners and agents into the new role.
update profiles set role = 'member' where role in ('owner', 'agent');

alter table profiles alter column role set default 'member';

-- Rewrite the auth-user trigger to default to 'member'.
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
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'member')
  );
  return new;
end;
$$;

-- ─────────────────────────── drop flags ───────────────────────────

drop policy if exists flags_agent_insert  on flags;
drop policy if exists flags_agent_select  on flags;
drop policy if exists flags_owner_select  on flags;
drop policy if exists flags_owner_update  on flags;
drop policy if exists flags_admin_all     on flags;
drop table if exists flags;
drop type  if exists flag_status;

-- ─────────────────────────── car_status: drop 'flagged' ───────────────────────────

-- Any car still in the legacy 'flagged' state becomes 'available' again.
update cars set status = 'available' where status::text = 'flagged';

create type car_status_new as enum ('available', 'rented', 'inactive');
alter table cars
  alter column status drop default,
  alter column status type car_status_new using status::text::car_status_new,
  alter column status set default 'available';
drop type car_status;
alter type car_status_new rename to car_status;

-- ─────────────────────────── new enums ───────────────────────────

create type request_status as enum ('open', 'matched', 'fulfilled', 'cancelled', 'expired');
create type offer_status   as enum ('pending', 'accepted', 'rejected', 'withdrawn', 'expired');
create type booking_status as enum ('pending_owner_confirmation', 'confirmed', 'in_progress', 'completed', 'cancelled');

-- ─────────────────────────── requests ───────────────────────────

create table requests (
  id               uuid primary key default gen_random_uuid(),
  requester_id     uuid not null references profiles(id) on delete cascade,
  car_id           uuid references cars(id) on delete set null,
  car_type         text,
  pickup_area      text not null,
  start_at         timestamptz not null,
  end_at           timestamptz not null,
  passenger_count  int not null check (passenger_count > 0),
  max_daily_rate   numeric(10,2),
  notes            text,
  status           request_status not null default 'open',
  expires_at       timestamptz not null default (now() + interval '48 hours'),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (end_at > start_at)
);

create index requests_status_expires_idx on requests(status, expires_at);
create index requests_car_type_idx       on requests(car_type);
create index requests_pickup_area_idx    on requests(pickup_area);
create index requests_requester_idx      on requests(requester_id, created_at desc);

-- ─────────────────────────── request_private ───────────────────────────

create table request_private (
  request_id      uuid primary key references requests(id) on delete cascade,
  customer_name   text not null,
  customer_phone  text not null,
  customer_notes  text
);

-- ─────────────────────────── offers ───────────────────────────

create table offers (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references requests(id) on delete cascade,
  car_id       uuid not null references cars(id) on delete cascade,
  offerer_id   uuid not null references profiles(id) on delete cascade,
  daily_rate   numeric(10,2) not null check (daily_rate >= 0),
  deposit      numeric(10,2) not null check (deposit >= 0),
  notes        text,
  status       offer_status not null default 'pending',
  expires_at   timestamptz not null default (now() + interval '24 hours'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (request_id, car_id)
);

create index offers_request_status_idx on offers(request_id, status);
create index offers_offerer_idx        on offers(offerer_id, created_at desc);

-- Trigger: offerer_id must equal cars.owner_id at insert time.
create or replace function public.assert_offer_owner()
returns trigger
language plpgsql
as $$
declare
  car_owner uuid;
begin
  select owner_id into car_owner from cars where id = new.car_id;
  if car_owner is null then
    raise exception 'car % does not exist', new.car_id;
  end if;
  if car_owner <> new.offerer_id then
    raise exception 'offerer_id (%) must own the car (%)', new.offerer_id, new.car_id;
  end if;
  return new;
end;
$$;

create trigger offers_assert_owner_ins
  before insert on offers
  for each row execute function public.assert_offer_owner();

-- ─────────────────────────── bookings ───────────────────────────

create table bookings (
  id                uuid primary key default gen_random_uuid(),
  request_id        uuid not null references requests(id) on delete restrict,
  offer_id          uuid not null unique references offers(id) on delete restrict,
  car_id            uuid not null references cars(id) on delete restrict,
  owner_id          uuid not null references profiles(id) on delete restrict,
  booker_id         uuid not null references profiles(id) on delete restrict,
  pickup_area       text not null,
  passenger_count   int not null,
  daily_rate        numeric(10,2) not null,
  deposit           numeric(10,2) not null,
  start_at          timestamptz not null,
  end_at            timestamptz not null,
  status            booking_status not null default 'pending_owner_confirmation',
  confirmed_at      timestamptz,
  started_at        timestamptz,
  completed_at      timestamptz,
  cancelled_at      timestamptz,
  cancel_reason     text,
  created_at        timestamptz not null default now()
);

create index bookings_owner_status_idx  on bookings(owner_id, status);
create index bookings_booker_status_idx on bookings(booker_id, status);
create index bookings_car_window_idx    on bookings(car_id, start_at, end_at);

-- ─────────────────────────── webhook_endpoints ───────────────────────────

create table webhook_endpoints (
  id                uuid primary key default gen_random_uuid(),
  url               text not null,
  secret            text not null,
  event_types       text[] not null default '{}',
  is_active         boolean not null default true,
  last_delivery_at  timestamptz,
  last_status       int,
  created_at        timestamptz not null default now()
);

-- ─────────────────────────── enable RLS on new tables ───────────────────────────

alter table requests          enable row level security;
alter table request_private   enable row level security;
alter table offers            enable row level security;
alter table bookings          enable row level security;
alter table webhook_endpoints enable row level security;

-- ─────────────────────────── replace member-facing policies ───────────────────────────

-- profiles: drop the legacy "verified owner" carve-out and replace with a
-- members directory (any authenticated member can SELECT other member rows;
-- email exposure is mediated by the members_directory view below).
drop policy if exists profiles_verified_owners_public on profiles;

create policy profiles_members_directory_read on profiles
  for select using (
    get_my_role() = 'member' or id = auth.uid() or is_admin()
  );

-- cars: any member can read cars whose owner is verified.
drop policy if exists cars_read_for_agents on cars;
create policy cars_read_for_members on cars
  for select using (
    get_my_role() = 'member'
    and exists (
      select 1 from profiles owner
      where owner.id = cars.owner_id and owner.is_verified = true
    )
  );

-- service_areas: any member can read.
drop policy if exists service_areas_read_for_agents on service_areas;
create policy service_areas_read_for_members on service_areas
  for select using (get_my_role() = 'member');

-- ─────────────────────────── requests policies ───────────────────────────

create policy requests_requester_all on requests
  for all
  using (requester_id = auth.uid())
  with check (requester_id = auth.uid());

create policy requests_members_select_open on requests
  for select using (get_my_role() = 'member' and status = 'open');

create policy requests_participant_select on requests
  for select using (
    exists (select 1 from offers o     where o.request_id = requests.id and o.offerer_id = auth.uid())
    or exists (select 1 from bookings b where b.request_id = requests.id and (b.owner_id = auth.uid() or b.booker_id = auth.uid()))
  );

create policy requests_admin_all on requests
  for all using (is_admin()) with check (is_admin());

-- ─────────────────────────── request_private policies ───────────────────────────

create policy request_private_requester_all on request_private
  for all
  using (
    exists (select 1 from requests r where r.id = request_private.request_id and r.requester_id = auth.uid())
  )
  with check (
    exists (select 1 from requests r where r.id = request_private.request_id and r.requester_id = auth.uid())
  );

create policy request_private_admin_read on request_private
  for select using (is_admin());

-- ─────────────────────────── offers policies ───────────────────────────

create policy offers_offerer_all on offers
  for all
  using (offerer_id = auth.uid())
  with check (
    offerer_id = auth.uid()
    and exists (select 1 from cars c where c.id = offers.car_id and c.owner_id = auth.uid())
  );

create policy offers_requester_select on offers
  for select using (
    exists (select 1 from requests r where r.id = offers.request_id and r.requester_id = auth.uid())
  );

create policy offers_admin_all on offers
  for all using (is_admin()) with check (is_admin());

-- ─────────────────────────── bookings policies ───────────────────────────

create policy bookings_participant_select on bookings
  for select using (booker_id = auth.uid() or owner_id = auth.uid());

create policy bookings_admin_all on bookings
  for all using (is_admin()) with check (is_admin());

-- (No direct INSERT/UPDATE policy: all transitions go through the
-- SECURITY DEFINER functions below.)

-- ─────────────────────────── webhook_endpoints policies ───────────────────────────

create policy webhook_endpoints_admin_all on webhook_endpoints
  for all using (is_admin()) with check (is_admin());

-- ─────────────────────────── members_directory view ───────────────────────────

-- Hides email; client code that needs other-member profile info reads here.
create or replace view public.members_directory
  with (security_invoker = true)
  as
  select id, full_name, phone, is_verified, role, created_at
  from profiles;

-- ─────────────────────────── transition functions ───────────────────────────

-- Acceptance: requester accepts an offer. Creates a booking in
-- pending_owner_confirmation. Sibling offers stay pending so they remain a
-- fallback if the owner rejects.
--
-- p_acting_id: optional override for service-role callers. When null, falls
-- back to auth.uid() (the normal app path).
create or replace function public.accept_offer(p_offer_id uuid, p_acting_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  o offers%rowtype;
  r requests%rowtype;
  c cars%rowtype;
  acting uuid := coalesce(p_acting_id, auth.uid());
  new_booking_id uuid;
begin
  select * into o from offers where id = p_offer_id for update;
  if not found then raise exception 'offer % not found', p_offer_id; end if;
  if o.status <> 'pending' then raise exception 'offer % is not pending', p_offer_id; end if;

  select * into r from requests where id = o.request_id for update;
  if r.requester_id <> acting then raise exception 'only the requester can accept this offer'; end if;
  if r.status not in ('open', 'matched') then raise exception 'request is not open'; end if;

  select * into c from cars where id = o.car_id;

  update offers set status = 'accepted', updated_at = now() where id = o.id;

  insert into bookings (
    request_id, offer_id, car_id, owner_id, booker_id,
    pickup_area, passenger_count, daily_rate, deposit,
    start_at, end_at, status
  ) values (
    r.id, o.id, c.id, c.owner_id, r.requester_id,
    r.pickup_area, r.passenger_count, o.daily_rate, o.deposit,
    r.start_at, r.end_at, 'pending_owner_confirmation'
  ) returning id into new_booking_id;

  return new_booking_id;
end;
$$;

-- Owner confirms the booking. Cascades: request -> matched, sibling pending
-- offers on this request -> rejected, sibling pending bookings -> cancelled.
create or replace function public.confirm_booking(p_booking_id uuid, p_acting_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b bookings%rowtype;
  acting uuid := coalesce(p_acting_id, auth.uid());
begin
  select * into b from bookings where id = p_booking_id for update;
  if not found then raise exception 'booking % not found', p_booking_id; end if;
  if b.owner_id <> acting then raise exception 'only the car owner can confirm'; end if;
  if b.status <> 'pending_owner_confirmation' then
    raise exception 'booking is not pending owner confirmation';
  end if;

  update bookings
     set status = 'confirmed', confirmed_at = now()
   where id = b.id;

  update requests set status = 'matched', updated_at = now() where id = b.request_id;

  update offers
     set status = 'rejected', updated_at = now()
   where request_id = b.request_id
     and status = 'pending'
     and id <> b.offer_id;

  update bookings
     set status = 'cancelled', cancelled_at = now(), cancel_reason = 'superseded'
   where request_id = b.request_id
     and status = 'pending_owner_confirmation'
     and id <> b.id;
end;
$$;

-- Owner declines the proposed booking. The parent offer is rejected; the
-- request stays open so the requester can pick another offer.
create or replace function public.cancel_booking(p_booking_id uuid, p_reason text default null, p_acting_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b bookings%rowtype;
  acting uuid := coalesce(p_acting_id, auth.uid());
begin
  select * into b from bookings where id = p_booking_id for update;
  if not found then raise exception 'booking % not found', p_booking_id; end if;
  if b.owner_id <> acting and b.booker_id <> acting then
    raise exception 'only a booking participant can cancel';
  end if;
  if b.status in ('completed', 'cancelled') then
    raise exception 'booking already terminal';
  end if;

  update bookings
     set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason
   where id = b.id;

  -- If the booking was the one tied to a matched request, free it again.
  update requests
     set status = case
                    when status = 'matched' then 'open'
                    else status
                  end,
         updated_at = now()
   where id = b.request_id
     and not exists (
       select 1 from bookings b2
        where b2.request_id = requests.id
          and b2.status in ('confirmed','in_progress','pending_owner_confirmation')
     );

  -- The parent offer becomes rejected (it's terminal).
  update offers set status = 'rejected', updated_at = now()
   where id = b.offer_id and status not in ('rejected','withdrawn','expired');
end;
$$;

create or replace function public.start_booking(p_booking_id uuid, p_acting_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b bookings%rowtype;
  acting uuid := coalesce(p_acting_id, auth.uid());
begin
  select * into b from bookings where id = p_booking_id for update;
  if not found then raise exception 'booking % not found', p_booking_id; end if;
  if b.owner_id <> acting and b.booker_id <> acting then
    raise exception 'only a booking participant can start';
  end if;
  if b.status <> 'confirmed' then raise exception 'booking is not confirmed'; end if;

  update bookings set status = 'in_progress', started_at = now() where id = b.id;
end;
$$;

create or replace function public.complete_booking(p_booking_id uuid, p_acting_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b bookings%rowtype;
  acting uuid := coalesce(p_acting_id, auth.uid());
begin
  select * into b from bookings where id = p_booking_id for update;
  if not found then raise exception 'booking % not found', p_booking_id; end if;
  if b.owner_id <> acting and b.booker_id <> acting then
    raise exception 'only a booking participant can complete';
  end if;
  if b.status not in ('confirmed', 'in_progress') then
    raise exception 'booking is not active';
  end if;

  update bookings set status = 'completed', completed_at = now() where id = b.id;
  update requests set status = 'fulfilled', updated_at = now() where id = b.request_id;
end;
$$;

create or replace function public.reject_offer(p_offer_id uuid, p_acting_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o offers%rowtype;
  r requests%rowtype;
  acting uuid := coalesce(p_acting_id, auth.uid());
begin
  select * into o from offers where id = p_offer_id for update;
  if not found then raise exception 'offer % not found', p_offer_id; end if;
  select * into r from requests where id = o.request_id;
  if r.requester_id <> acting then raise exception 'only the requester can reject'; end if;
  if o.status <> 'pending' then raise exception 'offer is not pending'; end if;

  update offers set status = 'rejected', updated_at = now() where id = o.id;
end;
$$;

create or replace function public.withdraw_offer(p_offer_id uuid, p_acting_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o offers%rowtype;
  acting uuid := coalesce(p_acting_id, auth.uid());
begin
  select * into o from offers where id = p_offer_id for update;
  if not found then raise exception 'offer % not found', p_offer_id; end if;
  if o.offerer_id <> acting then raise exception 'only the offerer can withdraw'; end if;
  if o.status <> 'pending' then raise exception 'offer is not pending'; end if;

  update offers set status = 'withdrawn', updated_at = now() where id = o.id;
end;
$$;

create or replace function public.cancel_request(p_request_id uuid, p_acting_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r requests%rowtype;
  acting uuid := coalesce(p_acting_id, auth.uid());
begin
  select * into r from requests where id = p_request_id for update;
  if not found then raise exception 'request % not found', p_request_id; end if;
  if r.requester_id <> acting then raise exception 'only the requester can cancel'; end if;
  if r.status <> 'open' then raise exception 'request is not open'; end if;

  update requests  set status = 'cancelled', updated_at = now() where id = r.id;
  update offers    set status = 'rejected',  updated_at = now() where request_id = r.id and status = 'pending';
end;
$$;
