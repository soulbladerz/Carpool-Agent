-- 0012: no-login "magic action links". A notification embeds a unique tokenized
-- URL (/act/<token>); tapping it opens a web page where the member accepts/rejects
-- an offer or confirms/declines a booking without logging in. The token is the
-- capability: high-entropy, single-use, short-lived, scoped to one target.

create extension if not exists pgcrypto;

create table if not exists public.action_token (
  token       text primary key,
  member_id   uuid not null references profiles(id) on delete cascade,
  kind        text not null check (kind in ('offer_decision', 'booking_decision')),
  target_id   uuid not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '6 hours'),
  used_at     timestamptz
);

create index if not exists action_token_expires_idx on public.action_token (expires_at);

-- Only the service role (app server / bot) reads/writes tokens; RLS on, no
-- policies => anon/authenticated blocked, service_role bypasses.
alter table public.action_token enable row level security;

-- Mint a token for a recipient (resolved from their WhatsApp number) + target.
-- Returns { token } or { token: null } if the number matches no member.
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

  v_token := encode(gen_random_bytes(24), 'hex');
  insert into action_token (token, member_id, kind, target_id)
  values (v_token, v_member, p_kind, p_target);

  return jsonb_build_object('token', v_token);
end;
$$;

revoke all on function public.mint_action_token(text, text, uuid) from public;
grant execute on function public.mint_action_token(text, text, uuid) to service_role;
