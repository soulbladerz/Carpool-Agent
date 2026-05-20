-- 0007: prevent overlapping bookings + hide cars currently booked

create or replace function public.car_has_blocking_booking(
  p_car_id     uuid,
  p_start_at   timestamptz,
  p_end_at     timestamptz,
  p_exclude_booking_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from bookings b
    where b.car_id = p_car_id
      and b.status in ('pending_owner_confirmation', 'confirmed', 'in_progress')
      and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
      and b.start_at < p_end_at
      and b.end_at   > p_start_at
  );
$$;

create or replace function public.car_is_currently_booked(p_car_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from bookings b
    where b.car_id = p_car_id
      and b.status in ('confirmed', 'in_progress')
      and b.start_at <= now()
      and b.end_at   >= now()
  );
$$;

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
  if acting is null then raise exception 'no acting user'; end if;
  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'customer_name required';
  end if;
  if p_customer_phone is null or btrim(p_customer_phone) = '' then
    raise exception 'customer_phone required';
  end if;
  if p_car_id is not null
     and public.car_has_blocking_booking(p_car_id, p_start_at, p_end_at)
  then
    raise exception 'car_unavailable_in_window'
      using hint = 'This car is already booked for part of the requested window.';
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

create or replace function public.assert_offer_no_overlap()
returns trigger
language plpgsql
as $$
declare
  r requests%rowtype;
begin
  select * into r from requests where id = new.request_id;
  if not found then raise exception 'request % does not exist', new.request_id; end if;
  if public.car_has_blocking_booking(new.car_id, r.start_at, r.end_at) then
    raise exception 'car_unavailable_in_window'
      using hint = 'Your car is already booked during this request''s window.';
  end if;
  return new;
end;
$$;

drop trigger if exists offers_assert_no_overlap_ins on offers;
create trigger offers_assert_no_overlap_ins
  before insert on offers
  for each row execute function public.assert_offer_no_overlap();

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

  if public.car_has_blocking_booking(b.car_id, b.start_at, b.end_at, b.id) then
    raise exception 'car_unavailable_in_window'
      using hint = 'This car was already confirmed for an overlapping window.';
  end if;

  update bookings set status = 'confirmed', confirmed_at = now() where id = b.id;
  update requests set status = 'matched', updated_at = now() where id = b.request_id;
  update offers
     set status = 'rejected', updated_at = now()
   where request_id = b.request_id and status = 'pending' and id <> b.offer_id;
  update bookings
     set status = 'cancelled', cancelled_at = now(), cancel_reason = 'superseded'
   where request_id = b.request_id
     and status = 'pending_owner_confirmation'
     and id <> b.id;
end;
$$;
