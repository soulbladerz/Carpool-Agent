-- 0013: fix mint_action_token — gen_random_bytes lives in the `extensions`
-- schema (not on the function's search_path). Use core gen_random_uuid()
-- instead (pg_catalog, always available) to build the token.

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
  if p_kind not in ('offer_decision', 'booking_decision') then
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
