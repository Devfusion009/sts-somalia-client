-- Visa status becomes a real state machine with one door.
--
-- Two problems this closes. First, status was a free-for-all: adminSetVisaStatus
-- accepted any value in its list, so an application could jump from 'submitted'
-- to 'issued' without ever being reviewed, and four separate call sites wrote
-- the column directly. Second — confirmed by grepping every migration — no
-- notification has ever fired for any visa event: a customer who submitted an
-- application, was asked for a document, or was approved or rejected was told
-- nothing. Only an audit row and a history row were written.
--
-- Shape follows the wallet money path (20260902000002 / 20260907000001): a
-- privileged `_internal` function that does the work and is revoked from
-- clients, plus a public entry point that authorizes the caller. Notifications
-- fan out from inside the internal function, so they cannot be forgotten by a
-- future call site.

-- ----------------------------------------------------------------------------
-- 1) The transition itself — authorization is the caller's job, not this one's
-- ----------------------------------------------------------------------------
create or replace function public.apply_visa_status_transition_internal(
  p_application_id uuid,
  p_status public.visa_status,
  p_actor uuid default null,
  p_note text default null
)
returns public.visa_status
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
  v_visa_name text;
  v_note text := nullif(btrim(p_note), '');
  v_title text;
  v_body text;
  v_data jsonb;
begin
  select * into app from public.visa_applications where id = p_application_id for update;
  if not found then
    raise exception 'visa application not found';
  end if;

  -- A no-op is not an error, but it must not write a second history row or
  -- notify anyone twice (webhook redeliveries in M4 depend on this).
  if app.status = p_status then
    return app.status;
  end if;

  if not (
    case app.status
      when 'draft' then p_status in ('submitted')
      when 'submitted' then p_status in ('in_review', 'cancelled')
      when 'in_review' then p_status in ('additional_info_required', 'ready_for_processing', 'rejected', 'cancelled')
      when 'additional_info_required' then p_status in ('in_review', 'cancelled')
      -- Cleared, then someone spots a problem before it is lodged.
      when 'ready_for_processing' then p_status in ('additional_info_required', 'processing', 'cancelled')
      -- An authority can come back mid-lodgement asking for more paperwork;
      -- the application re-enters review and is cleared again before re-lodging.
      when 'processing' then p_status in ('additional_info_required', 'approved', 'rejected', 'cancelled')
      when 'approved' then p_status in ('issued')
      else false
    end
  ) then
    raise exception 'a visa application cannot move from % to %', app.status, p_status;
  end if;

  -- The guard trigger below rejects any status write that did not come through
  -- here. Transaction-local, and cleared immediately after the update so a
  -- direct write later in the same transaction is still refused.
  perform set_config('sts.visa_transition', p_application_id::text, true);

  update public.visa_applications
     set status = p_status,
         decided_by = case when p_status in ('approved', 'rejected', 'issued')
                           then coalesce(p_actor, decided_by) else decided_by end,
         decided_at = case when p_status in ('approved', 'rejected', 'issued')
                           then now() else decided_at end,
         updated_at = now()
   where id = p_application_id;

  perform set_config('sts.visa_transition', '', true);

  -- log_visa_status_change has just written the history row; carry the note on it.
  if v_note is not null then
    update public.visa_application_status_history
       set note = v_note
     where id = (
       select id from public.visa_application_status_history
        where application_id = p_application_id and status = p_status
        order by created_at desc
        limit 1
     );
  end if;

  select name into v_visa_name from public.visa_types where id = app.visa_type_id;

  v_data := jsonb_build_object(
    'applicationId', p_application_id,
    'applicationRef', app.application_ref,
    'status', p_status::text,
    'agencyId', app.agency_id
  );

  v_title := case p_status
    when 'submitted' then 'Visa application submitted'
    when 'in_review' then 'Visa application under review'
    when 'additional_info_required' then 'Documents needed'
    when 'ready_for_processing' then 'Cleared for processing'
    when 'processing' then 'Visa processing started'
    when 'approved' then 'Visa approved'
    when 'rejected' then 'Visa rejected'
    when 'issued' then 'Visa issued'
    when 'cancelled' then 'Visa application cancelled'
    else 'Visa application updated'
  end;

  v_body := case p_status
    when 'submitted' then coalesce(v_visa_name, 'Visa') || ' — ' || app.application_ref || ' was submitted.'
    when 'in_review' then 'STS is reviewing ' || app.application_ref || '.'
    when 'additional_info_required' then 'More documents are needed for ' || app.application_ref || '.'
    when 'ready_for_processing' then app.application_ref || ' is cleared for processing.'
    when 'processing' then app.application_ref || ' is with the visa authority.'
    when 'approved' then app.application_ref || ' was approved.'
    when 'rejected' then app.application_ref || ' was rejected.'
    when 'issued' then 'The visa for ' || app.application_ref || ' is ready to download.'
    when 'cancelled' then app.application_ref || ' was cancelled.'
    else app.application_ref || ' changed status.'
  end || case when v_note is not null then ' ' || v_note else '' end;

  -- The applicant, whoever filed it, and — for an agency booking — the agency's
  -- active members. One row each: an agent who filed for their own agency must
  -- not get the same notification twice.
  insert into public.notifications (profile_id, type, title, body, data)
  select distinct r.profile_id, 'visa_status_changed', v_title, v_body, v_data
  from (
    select app.submitted_by as profile_id
    union
    select app.applicant_profile_id
    union
    select m.profile_id
      from public.agency_members m
     where app.agency_id is not null
       and m.agency_id = app.agency_id
       and m.status = 'active'
  ) r
  where r.profile_id is not null;

  -- Admins hear about arrivals, not about their own decisions.
  if p_status = 'submitted' then
    insert into public.notifications (profile_id, type, title, body, data)
    select p.id,
           'visa_application_submitted',
           'New visa application',
           coalesce(v_visa_name, 'Visa') || ' — ' || app.application_ref || ' is waiting for review.',
           v_data
    from public.profiles p
    where p.is_platform_admin;
  end if;

  return p_status;
end;
$$;

revoke execute on function public.apply_visa_status_transition_internal(uuid, public.visa_status, uuid, text)
  from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2) Public entry point — who is allowed to ask for a transition
-- ----------------------------------------------------------------------------
create or replace function public.set_visa_application_status(
  p_application_id uuid,
  p_status public.visa_status,
  p_note text default null
)
returns public.visa_status
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
begin
  select * into app from public.visa_applications where id = p_application_id;
  if not found then
    raise exception 'visa application not found';
  end if;

  if not public.is_admin() then
    -- The one transition an applicant owns is submitting their own draft.
    if app.submitted_by is distinct from auth.uid() then
      raise exception 'not authorized to change this application';
    end if;
    if not (app.status = 'draft' and p_status = 'submitted') then
      raise exception 'only STS staff can change this application''s status';
    end if;
  end if;

  return public.apply_visa_status_transition_internal(p_application_id, p_status, auth.uid(), p_note);
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) The door is the only door
-- ----------------------------------------------------------------------------
create or replace function public.guard_visa_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('sts.visa_transition', true), '') <> new.id::text then
    raise exception
      'visa application status must change through set_visa_application_status()';
  end if;
  return new;
end;
$$;

create trigger visa_applications_guard_status
  before update of status on public.visa_applications
  for each row execute function public.guard_visa_status_transition();

-- ----------------------------------------------------------------------------
-- 4) Cancelling an unpaid order cascades to its visa application, and that
--    cascade is system-initiated — no auth.uid() to authorize, and it must not
--    raise on an application that is already finished. Re-declared here in full
--    (last defined in 20260808000001) so it goes through the new door.
-- ----------------------------------------------------------------------------
create or replace function public._apply_order_cancellation(target_order_id uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
begin
  update public.orders
    set status = 'cancelled', notes = coalesce(reason, notes)
    where id = target_order_id and status in ('held', 'pending_payment');

  for item in select * from public.order_items where order_id = target_order_id loop
    if item.hotel_booking_id is not null then
      update public.hotel_bookings set status = 'cancelled'
        where id = item.hotel_booking_id and status <> 'cancelled';
    elsif item.flight_booking_id is not null then
      update public.flight_bookings set status = 'cancelled'
        where id = item.flight_booking_id and status <> 'cancelled';
    elsif item.umrah_booking_id is not null then
      update public.umrah_bookings set status = 'cancelled'
        where id = item.umrah_booking_id and status <> 'cancelled';
    elsif item.hall_booking_id is not null then
      update public.hall_bookings set status = 'cancelled'
        where id = item.hall_booking_id and status <> 'cancelled';
    elsif item.visa_application_id is not null then
      perform public.apply_visa_status_transition_internal(v.id, 'cancelled', auth.uid(), reason)
        from public.visa_applications v
       where v.id = item.visa_application_id
         and v.status not in ('approved', 'rejected', 'issued', 'cancelled');
    end if;
  end loop;
end;
$$;
