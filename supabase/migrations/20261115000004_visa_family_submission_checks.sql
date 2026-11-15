-- Attendance and biometrics are per traveller, or an explicitly shared appointment.
create or replace function public._visa_attendance_complete(p_application_id uuid,p_biometrics boolean)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from visa_appointments a where a.application_id=p_application_id and a.member_id is null and a.status='attended' and (not p_biometrics or a.biometrics_completed))
 or (exists(select 1 from visa_members where application_id=p_application_id) and not exists(select 1 from visa_members m where m.application_id=p_application_id and not exists(select 1 from visa_appointments a where a.application_id=p_application_id and a.member_id=m.id and a.status='attended' and (not p_biometrics or a.biometrics_completed))));
$$;
revoke all on function public._visa_attendance_complete(uuid,boolean) from public,anon,authenticated;

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
  v_out integer;
begin
  select * into app from public.visa_applications where id = p_application_id;

  if coalesce((app.workflow->>'requires_appointment')::boolean,false) and not public._visa_attendance_complete(app.id,false) then return 'appointment not attended by every traveller'; end if;
  if coalesce((app.workflow->>'requires_biometrics')::boolean,false) and not public._visa_attendance_complete(app.id,true) then return 'biometrics not recorded for every traveller'; end if;

  if coalesce((app.workflow->>'requires_physical_passport')::boolean, false) then
    select count(*) into v_out from public.visa_passports
     where application_id = app.id and status not in ('with_sts', 'with_centre');
    select greatest(v_out, count(*)) into v_out from visa_members m where m.application_id=app.id and not exists(select 1 from visa_passports p where p.application_id=app.id and p.status in ('with_sts','with_centre') and (p.member_id=m.id or (p.member_id is null and app.applicant_type='single'))) ;
    if not exists(select 1 from visa_passports where application_id=app.id) then return 'Passports have not been received.'; end if;
    if v_out > 0 then
      return v_out || ' passport(s) not yet received';
    end if;
  end if;

  return null;
end;
$$;

revoke all on function public._visa_submission_blocker(uuid) from public,anon,authenticated;

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
  v_appt := public._visa_attendance_complete(app.id,false);
  v_bio := public._visa_attendance_complete(app.id,true);

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

