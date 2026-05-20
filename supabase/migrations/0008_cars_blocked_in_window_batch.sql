-- 0008: bulk overlap predicate for marketplace filtering
--
-- car_has_blocking_booking is single-car. The marketplace needs to filter a
-- list of cars by their availability in one window — a batch version saves a
-- per-row roundtrip.

create or replace function public.cars_blocked_in_window(
  p_car_ids   uuid[],
  p_start_at  timestamptz,
  p_end_at    timestamptz
)
returns table (car_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select distinct b.car_id
  from bookings b
  where b.car_id = any(p_car_ids)
    and b.status in ('pending_owner_confirmation', 'confirmed', 'in_progress')
    and b.start_at < p_end_at
    and b.end_at   > p_start_at;
$$;
