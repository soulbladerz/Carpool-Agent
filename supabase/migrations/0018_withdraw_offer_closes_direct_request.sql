-- 0018: withdrawing the offer on a DIRECT request should close the request.
--
-- A direct request (car_id is not null) can only be offered by the targeted
-- car's owner. If that owner withdraws their offer, no one else can fulfil it,
-- so the request was being left "open" forever. Now it's cancelled. Broadcast
-- requests (car_id is null) are unaffected — other members can still offer.

create or replace function public.withdraw_offer(p_offer_id uuid, p_acting_id uuid default null)
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
  if o.offerer_id <> acting then raise exception 'only the offerer can withdraw'; end if;
  if o.status <> 'pending' then raise exception 'offer is not pending'; end if;

  update offers set status = 'withdrawn', updated_at = now() where id = o.id;

  select * into r from requests where id = o.request_id;
  if r.car_id is not null and r.status = 'open' then
    update requests set status = 'cancelled', updated_at = now() where id = r.id;
  end if;
end;
$$;
