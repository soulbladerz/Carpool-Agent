-- Carpool-Agent: RLS fixes
--
-- Issues fixed:
--   1. current_role() helper caused stack-overflow recursion because the
--      function read from public.profiles, which has RLS policies that
--      themselves called current_role() — infinite loop.
--   2. profiles_self_read policy had an OR-branch that ran a subquery on
--      public.profiles, also recursive when invoked from RLS context.
--   3. Agents couldn't see verified owners' profiles, so the cars page
--      join `owner:profiles(...)` returned null and defense-in-depth
--      filter dropped every car.
--
-- Fix strategy:
--   - Add SECURITY DEFINER helper functions get_my_role() and is_admin()
--     that bypass RLS when looking up the caller's role.
--   - Rewrite policies to use those helpers (or auth.uid() directly)
--     so they never call the same policy they belong to.
--   - Add a SELECT policy that exposes verified owner profiles to any
--     authenticated user (needed for the cars browse join).

-- ─────────────────────────── helper functions ───────────────────────────

create or replace function public.get_my_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Patch legacy current_role() for any code still calling it.
create or replace function public.current_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ─────────────────────────── profiles policies ───────────────────────────

drop policy if exists profiles_self_read on profiles;
create policy profiles_self_read on profiles
  for select using (id = auth.uid());

drop policy if exists profiles_admin_read on profiles;
create policy profiles_admin_read on profiles
  for select using (public.is_admin());

drop policy if exists profiles_admin_update on profiles;
create policy profiles_admin_update on profiles
  for update using (public.is_admin());

-- Allow any authenticated user to read profile info of VERIFIED OWNERS.
-- Needed so the cars browse page can join cars → owner profile.
drop policy if exists profiles_verified_owners_public on profiles;
create policy profiles_verified_owners_public on profiles
  for select using (
    is_verified = true and role = 'owner'
  );

-- ─────────────────────────── cars policy ───────────────────────────

drop policy if exists cars_read_for_agents on cars;
create policy cars_read_for_agents on cars
  for select using (
    public.get_my_role() in ('agent', 'admin')
    and exists (
      select 1 from public.profiles owner
      where owner.id = cars.owner_id and owner.is_verified = true
    )
  );

-- ─────────────────────────── service_areas policy ───────────────────────────

drop policy if exists service_areas_read_for_agents on service_areas;
create policy service_areas_read_for_agents on service_areas
  for select using (public.get_my_role() in ('agent', 'admin'));

-- ─────────────────────────── flags policies ───────────────────────────

drop policy if exists flags_agent_insert on flags;
create policy flags_agent_insert on flags
  for insert with check (
    agent_id = auth.uid() and public.get_my_role() = 'agent'
  );

drop policy if exists flags_admin_all on flags;
create policy flags_admin_all on flags
  for all using (public.is_admin())
  with check (public.is_admin());

-- ─────────────────────────── audit_log policy ───────────────────────────

drop policy if exists audit_admin_read on audit_log;
create policy audit_admin_read on audit_log
  for select using (public.is_admin());
