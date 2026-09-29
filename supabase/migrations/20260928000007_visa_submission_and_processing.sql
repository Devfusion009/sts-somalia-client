-- Visa case management, milestone 3 of 5: submission + processing.
--
-- visa_processing_jobs is the submission record: where the case was lodged
-- (centre / consulate / partner), its reference, whether the centre accepted
-- it, and how far processing has got (centre → authority → awaiting
-- decision). All writes go through RPCs; the job table is staff-read only.
--
-- A case can only be submitted once the program's own requirements are met
-- (appointment attended, biometrics taken — from the workflow snapshot), and a
-- centre returning a case for correction sends it back to "ready" instead of
-- leaving it stuck in processing.

alter table public.visa_processing_jobs
  add column if not exists centre_id uuid references public.visa_application_centres (id),
  add column if not exists appointment_id uuid references public.visa_appointments (id),
  add column if not exists receipt_document_id uuid references public.visa_documents (id),
  add column if not exists submitted_at timestamptz,
  add column if not exists centre_status text not null default 'submitted'
    check (centre_status in ('submitted', 'accepted', 'returned_for_correction')),
  add column if not exists centre_status_at timestamptz,
  add column if not exists returned_reason text,
  add column if not exists processing_stage text not null default 'in_centre'
    check (processing_stage in ('in_centre', 'in_authority', 'awaiting_decision'));

update public.visa_processing_jobs
   set submitted_at = coalesce(submitted_at, lodgement_date::timestamptz, created_at)
 where submitted_at is null;

drop policy if exists "visa_processing_jobs: admin manage" on public.visa_processing_jobs;
create policy "visa_processing_jobs: staff read"
  on public.visa_processing_jobs for select
  using ((select public.visa_staff_can('visa.applications.read')));
revoke insert, update, delete, truncate on public.visa_processing_jobs from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Program requirements that must be met before lodgement (passports are added
-- in the passports migration).
-- ----------------------------------------------------------------------------
create or replace function public._visa_submission_blocker(p_application_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
  v_members integer;
begin
  select * into app from public.visa_applications where id = p_application_id;

  if coalesce((app.workflow->>'requires_appointment')::boolean, false) then
    if not exists (
         select 1 from public.visa_appointments
          where application_id = app.id and status = 'attended' and member_id is null
       ) then
      select count(*) into v_members from public.visa_members m
       where m.application_id = app.id
         and not exists (
           select 1 from public.visa_appointments a
            where a.application_id = app.id and a.member_id = m.id and a.status = 'attended'
         );
      if v_members > 0 or not exists (select 1 from public.visa_members where application_id = app.id) then
        return 'appointment not attended yet';
      end if;
    end if;
  end if;

  if coalesce((app.workflow->>'requires_biometrics')::boolean, false)
     and not exists (
       select 1 from public.visa_appointments
        where application_id = app.id and status = 'attended' and biometrics_completed
     ) then
    return 'biometrics not recorded yet';
  end if;

  return null;
end;
$$;

revoke execute on function public._visa_submission_blocker(uuid) from public, anon, authenticated;

create or replace function public.guard_visa_processing_requires_job()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_blocker text;
begin
  if new.status = 'processing' and old.status is distinct from new.status then
    if not exists (
      select 1 from public.visa_processing_jobs j
       where j.application_id = new.id
         and j.status = 'active'
         and (
           (j.route = 'manual' and nullif(btrim(j.lodged_with), '') is not null and nullif(btrim(j.lodgement_reference), '') is not null)
           or (j.route = 'partner' and nullif(btrim(j.partner_ref), '') is not null)
         )
    ) then
      raise exception 'record where % was lodged before moving it to processing', new.application_ref;
    end if;
    if old.status = 'ready_for_processing' then
      v_blocker := public._visa_submission_blocker(new.id);
      if v_blocker is not null then
        raise exception 'cannot submit % — %', new.application_ref, v_blocker;
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Readiness now includes appointment / biometrics / lodgement.
-- ----------------------------------------------------------------------------
create or replace function public.visa_case_readiness(p_application_id uuid)
returns table (key text, label text, applies boolean, ok boolean, detail text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
  v_payment text;
  v_customer text;
  v_outstanding text;
  v_appt boolean;
  v_bio boolean;
begin
  perform public._visa_require('visa.applications.read');
  select * into app from public.visa_applications where id = p_application_id;
  v_payment := public.visa_payment_state(p_application_id);
  v_customer := public._visa_customer_blockers(p_application_id);
  v_outstanding := public.visa_application_outstanding_items(p_application_id);
  v_appt := exists (select 1 from public.visa_appointments where application_id = app.id and status = 'attended');
  v_bio := exists (select 1 from public.visa_appointments where application_id = app.id and status = 'attended' and biometrics_completed);

  return query values
    ('payment', 'Payment received', true, v_payment in ('paid', 'partially_paid'), v_payment),
    ('documents_complete', 'Documents complete', true, v_customer is null, v_customer),
    ('documents_reviewed', 'Documents reviewed', true, v_outstanding is null,
       case when v_customer is null then v_outstanding end),
    ('appointment', 'Appointment attended', coalesce((app.workflow->>'requires_appointment')::boolean, false), v_appt,
       case when exists (select 1 from public.visa_appointments where application_id = app.id and status = 'booked')
            then 'booked' else null end),
    ('biometrics', 'Biometrics taken', coalesce((app.workflow->>'requires_biometrics')::boolean, false), v_bio, null::text),
    ('lodgement', 'Submitted to centre', app.status in ('ready_for_processing', 'processing'),
       exists (select 1 from public.visa_processing_jobs where application_id = app.id and status = 'active'), null::text);
end;
$$;

-- ----------------------------------------------------------------------------
-- Submission
-- ----------------------------------------------------------------------------
create or replace function public.visa_record_submission(
  p_application_id uuid,
  p_lodged_with text,
  p_reference text,
  p_submitted_on date default current_date,
  p_centre_id uuid default null,
  p_appointment_id uuid default null,
  p_receipt_document_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
  v_with text := nullif(btrim(coalesce(p_lodged_with, '')), '');
  v_ref text := nullif(btrim(coalesce(p_reference, '')), '');
  v_job uuid;
begin
  perform public._visa_require('visa.submission.record');
  app := public._visa_open_case(p_application_id);
  if app.status <> 'ready_for_processing' then
    raise exception 'mark the application ready for submission first';
  end if;
  if p_centre_id is not null then
    select coalesce(v_with, name) into v_with from public.visa_application_centres where id = p_centre_id;
  end if;
  if v_with is null then
    raise exception 'enter where the application was lodged';
  end if;
  if v_ref is null then
    raise exception 'enter the submission reference';
  end if;
  if p_submitted_on is null or p_submitted_on > current_date then
    raise exception 'the submission date cannot be in the future';
  end if;
  if p_appointment_id is not null
     and not exists (select 1 from public.visa_appointments where id = p_appointment_id and application_id = app.id) then
    raise exception 'appointment not found on this application';
  end if;
  if p_receipt_document_id is not null
     and not exists (select 1 from public.visa_documents where id = p_receipt_document_id and application_id = app.id) then
    raise exception 'receipt not found on this application';
  end if;

  update public.visa_processing_jobs set status = 'superseded'
   where application_id = app.id and status = 'active';

  insert into public.visa_processing_jobs (
    application_id, route, lodged_with, lodgement_reference, lodgement_date, submitted_at,
    centre_id, appointment_id, receipt_document_id, created_by
  ) values (
    app.id, 'manual', v_with, v_ref, p_submitted_on, p_submitted_on::timestamptz,
    p_centre_id, p_appointment_id, p_receipt_document_id, auth.uid()
  )
  returning id into v_job;

  perform public._visa_set_stage(
    app.id, 'processing', null, 'visa.submission.record',
    app.application_ref || ' was submitted to ' || v_with || ' (ref ' || v_ref || ').', true
  );

  return v_job;
end;
$$;

create or replace function public.visa_record_partner_submission(
  p_application_id uuid,
  p_provider_key text,
  p_partner_ref text,
  p_partner_status text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
  v_job uuid;
begin
  perform public._visa_require('visa.submission.record');
  app := public._visa_open_case(p_application_id);
  if app.status <> 'ready_for_processing' then
    raise exception 'mark the application ready for submission first';
  end if;
  if nullif(btrim(coalesce(p_partner_ref, '')), '') is null then
    raise exception 'the partner returned no reference';
  end if;

  update public.visa_processing_jobs set status = 'superseded'
   where application_id = app.id and status = 'active';

  insert into public.visa_processing_jobs (
    application_id, route, provider_key, partner_ref, partner_status, partner_last_synced_at,
    submitted_at, created_by
  ) values (
    app.id, 'partner', p_provider_key, p_partner_ref, p_partner_status, now(), now(), auth.uid()
  )
  returning id into v_job;

  perform set_config('sts.visa_rpc', app.id::text, true);
  update public.visa_applications
     set partner_provider_key = p_provider_key, partner_ref = p_partner_ref,
         partner_status = p_partner_status, partner_last_synced_at = now()
   where id = app.id;
  perform set_config('sts.visa_rpc', '', true);

  perform public._visa_set_stage(
    app.id, 'processing', null, 'visa.submission.record',
    app.application_ref || ' was submitted for processing.', true
  );

  return v_job;
end;
$$;

create or replace function public.visa_record_partner_failure(
  p_application_id uuid,
  p_provider_key text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
begin
  perform public._visa_require('visa.submission.record');
  app := public._visa_open_case(p_application_id);

  insert into public.visa_processing_jobs (
    application_id, route, provider_key, status, failure_reason, created_by
  ) values (
    app.id, 'partner', p_provider_key, 'failed', p_reason, auth.uid()
  );

  perform public._visa_log_event(
    app.id, 'submission.partner_failed',
    'Partner submission (' || p_provider_key || ') failed: ' || coalesce(p_reason, 'unknown error'),
    null, false, false, 'visa.submission.record',
    p_reason, null, null, jsonb_build_object('provider', p_provider_key)
  );
end;
$$;

create or replace function public.visa_update_submission(
  p_application_id uuid,
  p_centre_status text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
  job public.visa_processing_jobs;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform public._visa_require('visa.submission.record');
  if p_centre_status not in ('accepted', 'returned_for_correction') then
    raise exception 'invalid centre status';
  end if;
  app := public._visa_open_case(p_application_id);
  if app.status <> 'processing' then
    raise exception 'this application has not been submitted';
  end if;
  select * into job from public.visa_processing_jobs
   where application_id = app.id and status = 'active' for update;
  if not found then
    raise exception 'no active submission';
  end if;

  if p_centre_status = 'accepted' then
    if job.centre_status = 'accepted' then
      raise exception 'already accepted';
    end if;
    update public.visa_processing_jobs
       set centre_status = 'accepted', centre_status_at = now()
     where id = job.id;
    perform public._visa_log_event(
      app.id, 'submission.accepted',
      'Accepted by ' || coalesce(job.lodged_with, job.provider_key, 'the centre'),
      app.application_ref || ' was accepted by ' || coalesce(job.lodged_with, 'the visa centre') || '.',
      true, false, 'visa.submission.record',
      null, null, null, jsonb_build_object('jobId', job.id)
    );
    return;
  end if;

  if v_reason is null then
    raise exception 'enter what the centre asked to correct';
  end if;
  update public.visa_processing_jobs
     set centre_status = 'returned_for_correction', centre_status_at = now(),
         returned_reason = v_reason, failure_reason = v_reason, status = 'failed', completed_at = now()
   where id = job.id;

  perform public._visa_set_stage(
    app.id, 'ready_for_processing', 'Returned by centre: ' || v_reason, 'visa.submission.record',
    app.application_ref || ' was returned by the visa centre for a correction. STS is handling it.', true
  );
end;
$$;

create or replace function public.visa_record_processing_update(
  p_application_id uuid,
  p_processing_stage text,
  p_note text default null,
  p_customer_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
  job public.visa_processing_jobs;
  v_label text;
  v_customer text := nullif(btrim(coalesce(p_customer_note, '')), '');
begin
  perform public._visa_require('visa.processing.update');
  if p_processing_stage not in ('in_centre', 'in_authority', 'awaiting_decision') then
    raise exception 'invalid processing stage';
  end if;
  app := public._visa_open_case(p_application_id);
  if app.status <> 'processing' then
    raise exception 'this application is not in processing';
  end if;
  select * into job from public.visa_processing_jobs
   where application_id = app.id and status = 'active' for update;
  if not found then
    raise exception 'no active submission';
  end if;

  update public.visa_processing_jobs set processing_stage = p_processing_stage where id = job.id;

  v_label := case p_processing_stage
    when 'in_centre' then 'At the visa centre'
    when 'in_authority' then 'With the authority'
    else 'Awaiting decision'
  end;

  perform public._visa_log_event(
    app.id, 'processing.updated',
    v_label || case when nullif(btrim(coalesce(p_note, '')), '') is not null then ': ' || btrim(p_note) else '' end,
    case when v_customer is not null then v_customer end,
    v_customer is not null, false, 'visa.processing.update',
    p_note, null, null, jsonb_build_object('stage', p_processing_stage, 'jobId', job.id)
  );
end;
$$;

revoke execute on function public.visa_record_submission(uuid, text, text, date, uuid, uuid, uuid) from public, anon;
revoke execute on function public.visa_record_partner_submission(uuid, text, text, text) from public, anon;
revoke execute on function public.visa_record_partner_failure(uuid, text, text) from public, anon;
revoke execute on function public.visa_update_submission(uuid, text, text) from public, anon;
revoke execute on function public.visa_record_processing_update(uuid, text, text, text) from public, anon;
grant execute on function public.visa_record_submission(uuid, text, text, date, uuid, uuid, uuid) to authenticated;
grant execute on function public.visa_record_partner_submission(uuid, text, text, text) to authenticated;
grant execute on function public.visa_record_partner_failure(uuid, text, text) to authenticated;
grant execute on function public.visa_update_submission(uuid, text, text) to authenticated;
grant execute on function public.visa_record_processing_update(uuid, text, text, text) to authenticated;
