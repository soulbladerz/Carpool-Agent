-- 0004: audit fixes.
--
-- 1. Lock down requests / offers / request_private so direct UPDATE / DELETE
--    by the requester or offerer is blocked. State transitions must go
--    through the SECURITY DEFINER functions.
-- 2. Include admins in the member-only read policies (cars, service_areas,
--    open requests) so the admin "member" navigation actually returns rows.
-- 3. Add a transactional create_request() RPC so the requests + request_private
--    rows are inserted atomically — no half-baked public requests with
--    missing customer PII.

-- ─────────────────────────── 1. Tighten state-machine RLS ───────────────────────────

drop policy if exists requests_requester_all       on requests;
drop policy if exists offers_offerer_all           on offers;
drop policy if exists request_private_requester_all on request_private;

-- requests: requester can insert + select; updates/deletes go through RPC.
create policy requests_requester_insert on requests
  for insert
  with check (requester_id = auth.uid());

create policy requests_requester_select on requests
  for select
  using (requester_id = auth.uid());

-- offers: offerer can insert + select; status changes go through RPC.
create policy offers_offerer_insert on offers
  for insert
  with check (
    offerer_id = auth.uid()
    and exists (select 1 from cars c where c.id = offers.car_id and c.owner_id = auth.uid())
  );

create policy offers_offerer_select on offers
  for select
  using (offerer_id = auth.uid());

-- request_private: requester can read; insert/update only through the
-- create_request RPC below. The RPC runs as security definer so it bypasses
-- this policy. No client-side insert path.
create policy request_private_requester_select on request_private
  for select
  using (
    exists (select 1 from requests r where r.id = request_private.request_id and r.requester_id = auth.uid())
  );

-- ─────────────────────────── 2. Admin reads of member-facing tables ───────────────────────────

drop policy if exists cars_read_for_members          on cars;
drop policy if exists service_areas_read_for_members on service_areas;
drop policy if exists requests_members_select_open   on requests;

create policy cars_read_for_members on cars
  for select using (
    (get_my_role() = 'member' or is_admin())
    and exists (
      select 1 from profiles owner
      where owner.id = cars.owner_id and owner.is_verified = true
    )
  );

create policy service_areas_read_for_members on service_areas
  for select using (get_my_role() = 'member' or is_admin());

create policy requests_members_select_open on requests
  for select using (
    (get_my_role() = 'member' or is_admin()) and status = 'open'
  );

-- ─────────────────────────── 3. Atomic request creation ───────────────────────────

create or replace function public.create_request(
  p_car_id          uuid,
  p_car_type        text,
  p_pickup_area     text,
  p_start_at        timestamptz,
  p_end_at          timestamptz,
  p_passenger_count int,
  p_max_daily_rate  numeric,
  p_notes           text,
  p_customer_name   text,
  p_customer_phone  text,
  p_customer_notes  text,
  p_acting_id       uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  acting uuid := coalesce(p_acting_id, auth.uid());
  new_id uuid;
begin
  if acting is null then
    raise exception 'no acting user';
  end if;
  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'customer_name required';
  end if;
  if p_customer_phone is null or btrim(p_customer_phone) = '' then
    raise exception 'customer_phone required';
  end if;

  insert into requests (
    requester_id, car_id, car_type, pickup_area, start_at, end_at,
    passenger_count, max_daily_rate, notes
  ) values (
    acting, p_car_id, p_car_type, p_pickup_area, p_start_at, p_end_at,
    p_passenger_count, p_max_daily_rate, p_notes
  ) returning id into new_id;

  insert into request_private (request_id, customer_name, customer_phone, customer_notes)
  values (new_id, p_customer_name, p_customer_phone, p_customer_notes);

  return new_id;
end;
$$;
