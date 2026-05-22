-- 0019: no-login "offer your car" action for a direct request.
--
-- The "New direct request" notification (to the targeted car owner) now carries
-- an offer_create token so the owner can make their offer (or decline) from a
-- no-login web page — no more login wall. Adds the kind to action_token and to
-- mint_action_token's allow-list.

alter table public.action_token drop constraint if exists action_token_kind_check;
alter table public.action_token
  add constraint action_token_kind_check
  check (kind in ('offer_decision', 'booking_decision', 'offer_create'));

create or replace function public.mint_action_token(p_wa text, p_kind text, p_target uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid;
  v_token  text;
begin
  if p_kind not in ('offer_decision', 'booking_decision', 'offer_create') then
    raise exception 'invalid kind %', p_kind;
  end if;

  select id into v_member from find_member_by_wa(p_wa) limit 1;
  if v_member is null then
    return jsonb_build_object('token', null);
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into action_token (token, member_id, kind, target_id)
  values (v_token, v_member, p_kind, p_target);

  return jsonb_build_object('token', v_token);
end;
$$;

revoke all on function public.mint_action_token(text, text, uuid) from public;
grant execute on function public.mint_action_token(text, text, uuid) to service_role;
