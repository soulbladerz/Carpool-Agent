-- 0006: direct requests are private to the targeted car owner.
--
-- A request with car_id set is "direct" — only the requester and the owner
-- of that specific car may see it. Broadcast requests (car_id is null)
-- continue to be visible to all members in the marketplace.

create or replace function public.user_owns_car(p_car_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from cars where id = p_car_id and owner_id = auth.uid()
  );
$$;

-- Tighten the broadcast policy: only car_id IS NULL requests show in marketplace.
drop policy if exists requests_members_select_open on requests;
create policy requests_members_select_open on requests
  for select using (
    (get_my_role() = 'member' or is_admin())
    and status = 'open'
    and car_id is null
  );

-- New policy: targeted car owner sees direct requests for their car.
drop policy if exists requests_direct_target_owner_select on requests;
create policy requests_direct_target_owner_select on requests
  for select using (
    car_id is not null
    and user_owns_car(car_id)
  );
