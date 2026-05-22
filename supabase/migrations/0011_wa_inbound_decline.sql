-- 0011: extend the inbound brain so a booking notification supports confirm AND
-- decline from one YES/NO prompt.
--
-- For a confirm_booking pending state: YES -> confirm, NO -> cancel (decline).
-- For an accept_offer pending state: YES -> accept, NO -> ignore (offer just
-- expires). Replaces wa_handle_inbound from 0010.

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
  v_do      text;
  v_req     uuid;
  v_url     text;
  v_body    jsonb;
  v_success text;
begin
  select * into v_state from wa_conversation where wa_number = v_norm and expires_at > now();
  if v_state.wa_number is null then
    return jsonb_build_object('claim', false);
  end if;

  select count(*) into v_mcount from find_member_by_wa(p_wa);
  if v_mcount <> 1 then
    delete from wa_conversation where wa_number = v_norm;
    return jsonb_build_object('claim', true, 'execute', null,
      'reply', 'Could not match your number to a single Carpool account. Please use the web app.');
  end if;
  select email into v_email from find_member_by_wa(p_wa) limit 1;

  if v_state.step <> 'awaiting_confirm' then
    return jsonb_build_object('claim', true, 'execute', null, 'reply', 'Please reply *YES* or *NO*.');
  end if;

  -- Decide which action (if any) the reply maps to.
  if v_text in ('YES', 'Y', 'CONFIRM', 'OK') then
    v_do := v_state.action;
  elsif v_text in ('NO', 'N', 'DECLINE', 'CANCEL', 'STOP') then
    if v_state.action = 'confirm_booking' then
      v_do := 'cancel_booking';   -- declining a pending booking releases it
    else
      delete from wa_conversation where wa_number = v_norm;
      return jsonb_build_object('claim', true, 'execute', null, 'reply', 'Okay, no action taken.');
    end if;
  else
    return jsonb_build_object('claim', true, 'execute', null, 'reply', 'Please reply *YES* to confirm or *NO* to cancel.');
  end if;

  -- Build the REST call n8n should make.
  if v_do = 'accept_offer' then
    select request_id into v_req from offers where id = v_state.target_id;
    if v_req is null then
      delete from wa_conversation where wa_number = v_norm;
      return jsonb_build_object('claim', true, 'execute', null, 'reply', 'That offer is no longer available.');
    end if;
    v_url := '/api/v1/requests/' || v_req || '/accept';
    v_body := jsonb_build_object('offer_id', v_state.target_id, 'acting_email', v_email);
    v_success := '✅ Offer accepted — booking created. The owner has been notified to confirm.';
  elsif v_do = 'reject_offer' then
    v_url := '/api/v1/offers/' || v_state.target_id || '/reject';
    v_body := jsonb_build_object('acting_email', v_email);
    v_success := '👍 Offer rejected.';
  elsif v_do = 'confirm_booking' then
    v_url := '/api/v1/bookings/' || v_state.target_id || '/confirm';
    v_body := jsonb_build_object('acting_email', v_email);
    v_success := '🎉 Booking confirmed. The renter has been notified.';
  elsif v_do = 'cancel_booking' then
    v_url := '/api/v1/bookings/' || v_state.target_id || '/cancel';
    v_body := jsonb_build_object('acting_email', v_email);
    v_success := '❌ Booking declined and released. The other party has been notified.';
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
end;
$$;

revoke all on function public.wa_handle_inbound(text, text) from public;
grant execute on function public.wa_handle_inbound(text, text) to service_role;
