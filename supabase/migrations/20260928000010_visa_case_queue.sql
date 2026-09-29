-- Visa case management, milestone 4 of 5: work queues, ownership, SLA.
--
-- visa_case_queue is one row per submitted case with every lifecycle
-- dimension flattened for the Applications console (stage, payment,
-- documents, appointment, submission, decision, passports, owner, SLA, age).
-- visa_case_attention() answers "does STS owe this case an action right now"
-- and drives both the "Needs action" queue and the sidebar badge.

-- ----------------------------------------------------------------------------
-- Attention: why a case is waiting on STS (null = nothing for STS to do).
-- ----------------------------------------------------------------------------
create or replace function public.visa_case_attention(app public.visa_applications)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when app.status = 'submitted'
         and public.visa_payment_state(app.id) in ('paid', 'partially_paid') then 'new'
    when app.status in ('in_review', 'ready_for_processing', 'processing', 'additional_info_required')
         and exists (
           select 1 from public.visa_appointments a
            where a.application_id = app.id and a.status = 'booked' and a.scheduled_at < now()
         ) then 'appointment_outcome'
    when app.status = 'in_review' then 'review'
    when app.status = 'additional_info_required'
         and (
           exists (
             select 1 from public.visa_documents d
              where d.application_id = app.id and d.is_current and d.review_status = 'pending'
                and d.document_type not in ('visa_result', 'decision_letter', 'submission_receipt', 'passport_authorization')
           )
           or exists (
             select 1 from public.visa_document_requests r
              where r.application_id = app.id and r.status = 'uploaded'
           )
         ) then 'customer_replied'
    when app.status = 'ready_for_processing' then 'ready'
    when app.status = 'approved'
         and (
           (coalesce((app.workflow->>'requires_physical_passport')::boolean, false)
             and exists (select 1 from public.visa_passports p
                          where p.application_id = app.id and p.status not in ('delivered', 'collected')))
           or (not coalesce((app.workflow->>'requires_physical_passport')::boolean, false)
             and not exists (select 1 from public.visa_documents d
                              where d.application_id = app.id and d.document_type = 'visa_result' and d.is_current))
         ) then 'deliver'
    else null
  end;
$$;

revoke execute on function public.visa_case_attention(public.visa_applications) from public, anon;
grant execute on function public.visa_case_attention(public.visa_applications) to authenticated;

-- ----------------------------------------------------------------------------
-- Queue view
-- ----------------------------------------------------------------------------
create or replace view public.visa_case_queue
with (security_invoker = true)
as
select
  a.id,
  a.application_ref,
  a.status,
  a.applicant_type,
  a.agency_id,
  a.created_at,
  a.submitted_at,
  coalesce(nullif(a.traveler_details->>'full_name', ''), sp.full_name, sp.email) as applicant_name,
  coalesce(nullif(a.contact_details->>'email', ''), sp.email) as applicant_email,
  vt.id as visa_type_id,
  vt.name as visa_type_name,
  vt.destination_country_code,
  ops.assigned_to,
  asg.full_name as assignee_name,
  coalesce(ops.priority, 'normal') as priority,
  ops.sla_due_at,
  public.visa_payment_state(a.id) as payment_state,
  coalesce((a.workflow->>'requires_appointment')::boolean, false) as requires_appointment,
  coalesce((a.workflow->>'requires_physical_passport')::boolean, false) as requires_passport,
  docs.required as docs_required,
  docs.verified as docs_verified,
  docs.pending as docs_pending,
  docs.rejected as docs_rejected,
  (select count(*) from public.visa_document_requests r
    where r.application_id = a.id and r.status in ('requested', 'uploaded'))::int as open_requests,
  appt.next_at as next_appointment_at,
  appt.attended as appointment_attended,
  job.centre_status,
  job.processing_stage,
  dec.outcome as decision_outcome,
  pp.total as passports_total,
  pp.returned as passports_returned,
  coalesce(
    (select max(e.created_at) from public.visa_case_events e
      where e.application_id = a.id and e.event_type = 'stage.changed' and e.to_stage = a.status),
    a.submitted_at, a.created_at
  ) as stage_entered_at,
  (select max(e.created_at) from public.visa_case_events e
    where e.application_id = a.id and e.event_type <> 'document.accessed') as last_activity_at,
  public.visa_case_attention(a) as attention,
  lower(concat_ws(' ',
    a.application_ref,
    a.traveler_details->>'full_name',
    a.contact_details->>'email',
    sp.full_name,
    sp.email,
    a.partner_ref,
    job.lodgement_reference,
    (select string_agg(ap.confirmation_number, ' ') from public.visa_appointments ap where ap.application_id = a.id)
  )) as search_text,
  docs.uploaded + (
    select count(*) from public._visa_required_slots(a.id) rs
     where not exists (
       select 1 from public.visa_documents d
        where d.application_id = a.id and d.document_type = rs.slot_key and d.is_current
     )
  )::int as docs_total,
  (pp.total - pp.returned)::int as passports_outstanding
from public.visa_applications a
join public.visa_types vt on vt.id = a.visa_type_id
left join public.profiles sp on sp.id = a.submitted_by
left join public.visa_case_ops ops on ops.application_id = a.id
left join public.profiles asg on asg.id = ops.assigned_to
left join lateral (
  select
    (select count(*) from public._visa_required_slots(a.id))::int as required,
    count(*) filter (where d.review_status = 'accepted')::int as verified,
    count(*) filter (where d.review_status = 'pending')::int as pending,
    count(*) filter (where d.review_status = 'rejected')::int as rejected,
    count(*)::int as uploaded
  from public.visa_documents d
  where d.application_id = a.id and d.is_current
    and d.document_type not in ('visa_result', 'decision_letter', 'submission_receipt', 'passport_authorization')
    and d.request_id is null
) docs on true
left join lateral (
  select min(ap.scheduled_at) filter (where ap.status = 'booked') as next_at,
         bool_or(ap.status = 'attended') as attended
  from public.visa_appointments ap
  where ap.application_id = a.id
) appt on true
left join lateral (
  select j.centre_status, j.processing_stage, j.lodgement_reference
  from public.visa_processing_jobs j
  where j.application_id = a.id and j.status = 'active'
  limit 1
) job on true
left join lateral (
  select d.outcome
  from public.visa_decisions d
  where d.application_id = a.id
    and not exists (select 1 from public.visa_decisions n where n.supersedes_id = d.id)
  order by d.recorded_at desc
  limit 1
) dec on true
left join lateral (
  select count(*)::int as total,
         count(*) filter (where p.status in ('delivered', 'collected'))::int as returned
  from public.visa_passports p
  where p.application_id = a.id
) pp on true
where a.status <> 'draft'
  and public.visa_staff_can('visa.applications.read');

revoke all on public.visa_case_queue from anon;
grant select on public.visa_case_queue to authenticated;

-- _visa_required_slots is used inside the view, which runs as the caller, so
-- it becomes callable — scoped to staff, the case's own parties, or a
-- non-request session.
create or replace function public._visa_required_slots(p_application_id uuid)
returns table (slot_key text, slot_label text)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(s->>'key', s #>> '{}') as slot_key,
         coalesce(nullif(btrim(s->>'label'), ''), s->>'key', s #>> '{}') as slot_label
    from public.visa_applications a
    join public.visa_types vt on vt.id = a.visa_type_id
   cross join lateral jsonb_array_elements(coalesce(a.resolved_documents, vt.required_documents, '[]'::jsonb)) s
   where a.id = p_application_id
     and (jsonb_typeof(s) = 'string' or coalesce((s->>'required')::boolean, true))
     and (
       public._visa_trusted_writer(a.id)
       or public.visa_staff_can('visa.applications.read')
       or a.submitted_by = auth.uid()
       or a.applicant_profile_id = auth.uid()
       or (a.agency_id is not null and public.is_agency_member(a.agency_id))
     );
$$;

grant execute on function public._visa_required_slots(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Counts per queue for the signed-in staff member.
-- ----------------------------------------------------------------------------
create or replace function public.visa_queue_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  perform public._visa_require('visa.applications.read');
  select jsonb_build_object(
    'needs_action', count(*) filter (where q.attention is not null),
    'mine', count(*) filter (where q.assigned_to = auth.uid() and q.status not in ('approved', 'rejected', 'issued', 'cancelled')),
    'unassigned', count(*) filter (where q.assigned_to is null and q.status not in ('approved', 'rejected', 'issued', 'cancelled')),
    'sla_at_risk', count(*) filter (
      where q.sla_due_at < now() + interval '24 hours'
        and q.status in ('submitted', 'in_review', 'ready_for_processing')
        and q.payment_state in ('paid', 'partially_paid')),
    'payment_pending', count(*) filter (where q.status = 'submitted' and q.payment_state not in ('paid', 'partially_paid')),
    'new', count(*) filter (where q.status = 'submitted' and q.payment_state in ('paid', 'partially_paid')),
    'document_review', count(*) filter (where q.status = 'in_review'),
    'customer_action', count(*) filter (where q.status = 'additional_info_required'),
    'appointment_pending', count(*) filter (
      where q.requires_appointment and not coalesce(q.appointment_attended, false)
        and q.status in ('in_review', 'additional_info_required', 'ready_for_processing')),
    'ready_for_submission', count(*) filter (where q.status = 'ready_for_processing'),
    'processing', count(*) filter (where q.status = 'processing'),
    'approved', count(*) filter (where q.status = 'approved'),
    'refused', count(*) filter (where q.status = 'rejected'),
    'passport_return', count(*) filter (
      where q.requires_passport and q.status in ('approved', 'rejected', 'cancelled')
        and q.passports_outstanding > 0),
    'issued', count(*) filter (where q.status = 'issued'),
    'cancelled', count(*) filter (where q.status = 'cancelled'),
    'all', count(*)
  )
  into v
  from public.visa_case_queue q;
  return v;
end;
$$;

revoke execute on function public.visa_queue_counts() from public, anon;
grant execute on function public.visa_queue_counts() to authenticated;

-- ----------------------------------------------------------------------------
-- Ownership
-- ----------------------------------------------------------------------------
create or replace function public.visa_assign_case(p_application_id uuid, p_assignee uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
  v_prev uuid;
  v_name text;
begin
  perform public._visa_require('visa.assign');
  select * into app from public.visa_applications where id = p_application_id;
  if not found or app.status = 'draft' then
    raise exception 'visa application not found';
  end if;
  if p_assignee is not null and not exists (
       select 1 from public.profiles where id = p_assignee and is_platform_admin
     ) then
    raise exception 'cases can only be assigned to STS staff';
  end if;

  select assigned_to into v_prev from public.visa_case_ops where application_id = app.id;
  if v_prev is not distinct from p_assignee then
    return;
  end if;

  insert into public.visa_case_ops (application_id, assigned_to)
  values (app.id, p_assignee)
  on conflict (application_id) do update set assigned_to = excluded.assigned_to, updated_at = now();

  select full_name into v_name from public.profiles where id = p_assignee;
  perform public._visa_log_event(
    app.id, 'case.assigned',
    case when p_assignee is null then 'Unassigned' else 'Assigned to ' || coalesce(v_name, 'staff member') end,
    null, false, p_assignee is not null and p_assignee is distinct from auth.uid(), 'visa.assign',
    null, null, null, jsonb_build_object('assignee', p_assignee, 'previous', v_prev)
  );
end;
$$;

create or replace function public.visa_claim_case(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
  v_prev uuid;
  v_name text;
begin
  perform public._visa_require('visa.applications.edit');
  select * into app from public.visa_applications where id = p_application_id;
  if not found or app.status = 'draft' then
    raise exception 'visa application not found';
  end if;
  select assigned_to into v_prev from public.visa_case_ops where application_id = app.id;
  if v_prev = auth.uid() then
    return;
  end if;

  insert into public.visa_case_ops (application_id, assigned_to)
  values (app.id, auth.uid())
  on conflict (application_id) do update set assigned_to = excluded.assigned_to, updated_at = now();

  select full_name into v_name from public.profiles where id = auth.uid();
  perform public._visa_log_event(
    app.id, 'case.assigned', 'Claimed by ' || coalesce(v_name, 'staff member'),
    null, false, false, 'visa.applications.edit',
    null, null, null, jsonb_build_object('assignee', auth.uid(), 'previous', v_prev)
  );
end;
$$;

create or replace function public.visa_set_case_priority(p_application_id uuid, p_priority text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev text;
begin
  perform public._visa_require('visa.assign');
  if p_priority not in ('normal', 'urgent') then
    raise exception 'invalid priority';
  end if;
  if not exists (select 1 from public.visa_applications where id = p_application_id and status <> 'draft') then
    raise exception 'visa application not found';
  end if;
  select priority into v_prev from public.visa_case_ops where application_id = p_application_id;
  if v_prev = p_priority then
    return;
  end if;

  insert into public.visa_case_ops (application_id, priority)
  values (p_application_id, p_priority)
  on conflict (application_id) do update set priority = excluded.priority, updated_at = now();

  perform public._visa_log_event(
    p_application_id, 'case.priority',
    case when p_priority = 'urgent' then 'Marked urgent' else 'Priority back to normal' end,
    null, false, false, 'visa.assign',
    null, null, null, jsonb_build_object('priority', p_priority)
  );
end;
$$;

revoke execute on function public.visa_assign_case(uuid, uuid) from public, anon;
revoke execute on function public.visa_claim_case(uuid) from public, anon;
revoke execute on function public.visa_set_case_priority(uuid, text) from public, anon;
grant execute on function public.visa_assign_case(uuid, uuid) to authenticated;
grant execute on function public.visa_claim_case(uuid) to authenticated;
grant execute on function public.visa_set_case_priority(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Sidebar badge: cases waiting on STS, not merely "submitted".
-- ----------------------------------------------------------------------------
create or replace function public.admin_nav_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  return jsonb_build_object(
    'queue',
      (select count(*) from public.hotel_bookings where status in ('pending', 'waitlisted'))
      + (select count(*) from public.hall_bookings where status = 'pending')
      + (select count(*) from public.umrah_bookings where booking_kind = 'private' and status = 'pending'),
    'refunds',
      (select count(*) from public.agency_refund_requests where status = 'pending'),
    'visa',
      (select count(*) from public.visa_applications a
        where a.status <> 'draft' and public.visa_case_attention(a) is not null),
    'visa_appointments',
      (select count(*) from public.visa_appointments
        where status = 'booked' and scheduled_at < date_trunc('day', now()) + interval '1 day'),
    'umrah_requests',
      (select count(*) from public.umrah_bookings where booking_kind = 'private' and status = 'pending'),
    'partner_applications',
      (select count(*) from public.agency_applications where status in ('pending', 'under_review'))
      + (select count(*) from public.hotel_partner_applications where status in ('pending', 'under_review'))
      + (select count(*) from public.affiliate_applications where status in ('pending', 'under_review'))
      + (select count(*) from public.venue_partner_applications where status in ('pending', 'under_review')),
    'markup_requests',
      (select count(*) from public.agency_markup_requests where status = 'pending'),
    'earnings_reviews',
      (select count(*) from public.agency_commission_entries where status = 'pending'),
    'payout_requests',
      (select count(*) from public.agency_payout_requests where status in ('pending', 'approved')),
    'topup_requests',
      (select count(*) from public.agency_topup_requests where status = 'pending' and rail = 'offline')
  );
end;
$$;
