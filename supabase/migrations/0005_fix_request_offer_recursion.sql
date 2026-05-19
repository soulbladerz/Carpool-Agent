-- 0005: break cross-table RLS recursion between requests and offers.
--
-- Problem:
--   requests_participant_select on requests SELECTs from offers, and
--   offers_requester_select on offers SELECTs from requests. When PostgREST
--   evaluates one, RLS on the other fires, which evaluates the first again
--   — infinite recursion, error 42P17. Effect: members couldn't read their
--   own requests via the standard PostgREST query, so the request detail
--   page 404'd.
--
-- Fix: wrap the cross-table lookups in SECURITY DEFINER helpers so they
-- bypass RLS the same way is_admin() and get_my_role() do. The helpers
-- only check membership of the calling user (auth.uid()) so they don't
-- widen access beyond what the inline policy expressed.

create or replace function public.user_owns_offer_on_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from offers o
    where o.request_id = p_request_id
      and o.offerer_id = auth.uid()
  );
$$;

create or replace function public.user_in_booking_on_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from bookings b
    where b.request_id = p_request_id
      and (b.owner_id = auth.uid() or b.booker_id = auth.uid())
  );
$$;

create or replace function public.user_is_request_requester(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from requests r
    where r.id = p_request_id
      and r.requester_id = auth.uid()
  );
$$;

drop policy if exists requests_participant_select on requests;
create policy requests_participant_select on requests
  for select using (
    user_owns_offer_on_request(id)
    or user_in_booking_on_request(id)
  );

drop policy if exists offers_requester_select on offers;
create policy offers_requester_select on offers
  for select using (user_is_request_requester(request_id));

drop policy if exists request_private_requester_select on request_private;
create policy request_private_requester_select on request_private
  for select using (user_is_request_requester(request_id));
