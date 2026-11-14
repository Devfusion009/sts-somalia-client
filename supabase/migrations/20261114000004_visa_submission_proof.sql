-- Filing proof and an expected decision date.
--
-- Recording a submission now needs the authority's receipt (the proof that
-- STS filed, which also ends the full-refund window), and the lodgement
-- gets an expected decision date from the visa type's maximum processing
-- time. The applicant sees that date; staff see cases that pass it.

alter table public.visa_processing_jobs add column expected_decision_on date;

comment on column public.visa_processing_jobs.expected_decision_on is
  'Lodgement date + the visa type''s maximum processing days; null when the type has no maximum.';

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
  v_days integer;
  v_expected date;
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
  if p_receipt_document_id is null then
    raise exception 'attach the submission receipt';
  end if;
  if not exists (select 1 from public.visa_documents where id = p_receipt_document_id and application_id = app.id) then
    raise exception 'receipt not found on this application';
  end if;

  select coalesce(app.resolved_processing_days_max, vt.processing_days_max) into v_days
    from public.visa_types vt where vt.id = app.visa_type_id;
  v_expected := case when v_days is not null and v_days > 0 then p_submitted_on + v_days end;

  update public.visa_processing_jobs set status = 'superseded'
   where application_id = app.id and status = 'active';

  insert into public.visa_processing_jobs (
    application_id, route, lodged_with, lodgement_reference, lodgement_date, submitted_at,
    centre_id, appointment_id, receipt_document_id, created_by, expected_decision_on
  ) values (
    app.id, 'manual', v_with, v_ref, p_submitted_on, p_submitted_on::timestamptz,
    p_centre_id, p_appointment_id, p_receipt_document_id, auth.uid(), v_expected
  )
  returning id into v_job;

  perform public._visa_set_stage(
    app.id, 'processing', null, 'visa.submission.record',
    app.application_ref || ' was submitted to ' || v_with || ' (ref ' || v_ref || ').'
      || case when v_expected is not null
              then ' Expected decision by ' || to_char(v_expected, 'FMDD Mon YYYY') || '.'
              else '' end,
    true
  );

  return v_job;
end;
$$;
