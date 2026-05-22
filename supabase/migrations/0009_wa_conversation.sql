-- 0009: WhatsApp interactive actions (Phase 1) — conversation state + identity helpers.
--
-- Supports the n8n "Carpool Inbound" bot that lets members accept/reject offers
-- and confirm/cancel bookings by replying to WhatsApp notifications. The bot
-- runs as the Supabase service role (which bypasses RLS), so these objects are
-- locked down to service_role only.

-- Normalize a phone number to its national significant digits so a WhatsApp
-- sender (e.g. "60123456789") matches a free-text profiles.phone (e.g.
-- "012-345 6789" or "+60123456789"). Strips non-digits, then drops a leading
-- "60" (country code) or "0" (trunk prefix).
create or replace function public.normalize_phone(p_phone text)
returns text
language sql
immutable
as $$
  select case
    when d like '60%' then substr(d, 3)
    when d like '0%'  then substr(d, 2)
    else d
  end
  from (select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as d) s;
$$;

-- Resolve a WhatsApp number to carpool member(s). Returns 0 rows (unknown),
-- 1 row (act as them), or >1 rows (ambiguous -> bot defers to the web app).
create or replace function public.find_member_by_wa(p_wa text)
returns table (id uuid, email text, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.email, p.full_name
  from profiles p
  where p.phone is not null
    and normalize_phone(p_wa) <> ''
    and normalize_phone(p.phone) = normalize_phone(p_wa);
$$;

revoke all on function public.find_member_by_wa(text) from public;
grant execute on function public.find_member_by_wa(text) to service_role;

-- Short-lived per-number conversation memory for the structured reply flow:
-- choice (pick an item) -> confirm (YES/NO) -> execute.
create table if not exists public.wa_conversation (
  wa_number   text primary key,
  member_id   uuid references profiles(id) on delete cascade,
  step        text not null check (step in ('awaiting_choice', 'awaiting_confirm')),
  action      text check (action in ('accept_offer', 'reject_offer', 'confirm_booking', 'cancel_booking')),
  target_id   uuid,
  options     jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '30 minutes')
);

create index if not exists wa_conversation_expires_at_idx on public.wa_conversation (expires_at);

-- Only the service-role bot touches this table; RLS on with no policies blocks
-- anon/authenticated while service_role bypasses RLS.
alter table public.wa_conversation enable row level security;
