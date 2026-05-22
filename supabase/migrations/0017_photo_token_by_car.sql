-- 0017: re-key photo_token to car_id so the "send photos / share gallery" flow
-- works from both the offer and the booking /act pages (and anywhere a car is
-- in context). resolve_photo_token keeps the same return shape, so the n8n
-- "Send car photos" workflow is unchanged.

drop table if exists public.photo_token cascade;

create table public.photo_token (
  token       text primary key,
  member_id   uuid not null references profiles(id) on delete cascade,
  car_id      uuid not null references cars(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '24 hours')
);

create index if not exists photo_token_expires_idx on public.photo_token (expires_at);
alter table public.photo_token enable row level security;

create or replace function public.resolve_photo_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tok    photo_token%rowtype;
  v_phone  text;
  v_digits text;
  v_intl   text;
  v_photos text[];
begin
  select * into v_tok from photo_token where token = p_token and expires_at > now();
  if v_tok.token is null then
    return jsonb_build_object('ok', false);
  end if;

  select phone into v_phone from profiles where id = v_tok.member_id;
  v_digits := regexp_replace(coalesce(v_phone, ''), '[^0-9]', '', 'g');
  if v_digits = '' then
    return jsonb_build_object('ok', false);
  end if;
  v_intl := case
    when v_digits like '60%' then v_digits
    when v_digits like '0%'  then '60' || substr(v_digits, 2)
    else '60' || v_digits
  end;

  select photo_urls into v_photos from cars where id = v_tok.car_id;
  if v_photos is null or array_length(v_photos, 1) is null then
    return jsonb_build_object('ok', false);
  end if;

  return jsonb_build_object('ok', true, 'chat_id', v_intl || '@c.us', 'photos', to_jsonb(v_photos));
end;
$$;

revoke all on function public.resolve_photo_token(text) from public;
grant execute on function public.resolve_photo_token(text) to service_role;
