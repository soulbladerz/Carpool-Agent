-- 0010: WhatsApp inbound "brain" — the conversation state machine, in SQL.
--
-- n8n stays a thin shell: webhook -> wa_handle_inbound() -> [generic REST call
-- it returns] -> WAHA reply. All decision/state logic lives here so it can be
-- unit-tested with SQL. Runs as the service role (bypasses RLS).

-- Seed a pending action when an outbound notification goes out. Resolves the
-- member from the recipient's WhatsApp number, normalizes the key, and parks an
-- awaiting_confirm row so a "YES" reply maps to a concrete action.
create or replace function public.wa_seed_state(p_wa text, p_action text, p_target uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into wa_conversation (wa_number, member_id, step, action, target_id, options, updated_at, expires_at)
  select normalize_phone(p_wa), m.id, 'awaiting_confirm', p_action, p_target, '[]'::jsonb, now(), now() + interval '30 minutes'
  from find_member_by_wa(p_wa) m
  limit 1
  on conflict (wa_number) do update set
    member_id  = excluded.member_id,
    step       = excluded.step,
    action     = excluded.action,
    target_id  = excluded.target_id,
    options    = excluded.options,
    updated_at = now(),
    expires_at = excluded.expires_at;
$$;

revoke all on function public.wa_seed_state(text, text, uuid) from public;
grant execute on function public.wa_seed_state(text, text, uuid) to service_role;

-- Interpret one inbound message against the member's current state and return
-- what n8n should do next:
--   { claim: bool,           -- false => not ours, let other bots handle it
--     reply: text,           -- message to send back (may be '')
--     execute: {             -- null, or a REST call for n8n to perform
--        url_path, body, success_reply, error_reply } }
-- When execute is present, n8n calls CARPOOL_PUBLIC_URL||url_path with the body
-- (x-api-key) so the carpool app's webhook fan-out notifies the counterparty.
create or replace function public.wa_handle_inbound(p_wa text, p_text text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_norm    text := normalize_phone(p_wa);
  v_text    text := upper(trim(coalesce(p_text, '')));
  v_state   wa_conversation%rowtype;
  v_email   text;
  v_mcount  int;
  v_req     uuid;
  v_url     text;
  v_body    jsonb;
  v_success text;
begin
  select * into v_state from wa_conversation where wa_number = v_norm and expires_at > now();

  -- Phase 1 slice: only claim a message when the sender has an active pending
  -- action (seeded by a notification). No state => not ours.
  if v_state.wa_number is null then
    return jsonb_build_object('claim', false);
  end if;

  -- Resolve member; require exactly one match.
  select count(*) into v_mcount from find_member_by_wa(p_wa);
  if v_mcount <> 1 then
    delete from wa_conversation where wa_number = v_norm;
    return jsonb_build_object('claim', true, 'execute', null,
      'reply', 'Could not match your number to a single Carpool account. Please use the web app.');
  end if;
  select email into v_email from find_member_by_wa(p_wa) limit 1;

  -- awaiting_confirm: YES executes, NO aborts.
  if v_state.step = 'awaiting_confirm' then
    if v_text in ('YES', 'Y', 'CONFIRM', 'OK') then
      if v_state.action = 'accept_offer' then
        select request_id into v_req from offers where id = v_state.target_id;
        if v_req is null then
          delete from wa_conversation where wa_number = v_norm;
          return jsonb_build_object('claim', true, 'execute', null, 'reply', 'That offer is no longer available.');
        end if;
        v_url := '/api/v1/requests/' || v_req || '/accept';
        v_body := jsonb_build_object('offer_id', v_state.target_id, 'acting_email', v_email);
        v_success := '✅ Offer accepted — booking created. The owner has been notified to confirm.';
      elsif v_state.action = 'reject_offer' then
        v_url := '/api/v1/offers/' || v_state.target_id || '/reject';
        v_body := jsonb_build_object('acting_email', v_email);
        v_success := '👍 Offer rejected.';
      elsif v_state.action = 'confirm_booking' then
        v_url := '/api/v1/bookings/' || v_state.target_id || '/confirm';
        v_body := jsonb_build_object('acting_email', v_email);
        v_success := '🎉 Booking confirmed. The renter has been notified.';
      elsif v_state.action = 'cancel_booking' then
        v_url := '/api/v1/bookings/' || v_state.target_id || '/cancel';
        v_body := jsonb_build_object('acting_email', v_email);
        v_success := '❌ Booking cancelled. The other party has been notified.';
      else
        delete from wa_conversation where wa_number = v_norm;
        return jsonb_build_object('claim', true, 'execute', null, 'reply', 'Unknown action.');
      end if;

      delete from wa_conversation where wa_number = v_norm;
      return jsonb_build_object('claim', true, 'reply', '',
        'execute', jsonb_build_object(
          'url_path', v_url,
          'body', v_body,
          'success_reply', v_success,
          'error_reply', '⚠️ Could not complete that action — it may have expired or already been handled.'));

    elsif v_text in ('NO', 'N', 'CANCEL', 'STOP') then
      delete from wa_conversation where wa_number = v_norm;
      return jsonb_build_object('claim', true, 'execute', null, 'reply', 'Okay, no action taken.');
    else
      return jsonb_build_object('claim', true, 'execute', null, 'reply', 'Please reply *YES* to confirm or *NO* to cancel.');
    end if;
  end if;

  -- Fallback (e.g. awaiting_choice not used in the slice).
  return jsonb_build_object('claim', true, 'execute', null, 'reply', 'Please reply *YES* or *NO*.');
end;
$$;

revoke all on function public.wa_handle_inbound(text, text) from public;
grant execute on function public.wa_handle_inbound(text, text) to service_role;
