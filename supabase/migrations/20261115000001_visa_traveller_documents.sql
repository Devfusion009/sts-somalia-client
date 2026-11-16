-- Every standard visa document belongs to one traveller. Legacy unassigned files count only for the primary traveller.
create or replace function public._visa_document_slot_key(p_application_id uuid,p_type text,p_member_id uuid)
returns text language sql stable security definer set search_path=public as $$
 select p_type || '|' || coalesce(p_member_id::text,
   case when exists(select 1 from public.visa_applications a join public.visa_types vt on vt.id=a.visa_type_id,
     lateral jsonb_array_elements(coalesce(a.resolved_documents,vt.required_documents,'[]'::jsonb)) s
     where a.id=p_application_id and coalesce(s->>'key',s #>> '{}')=p_type)
   then (select id::text from public.visa_members where application_id=p_application_id order by is_primary desc,sort_order,id limit 1) end, '')
 where public.visa_staff_can('visa.applications.read') or public._visa_trusted_writer(p_application_id)
   or exists(select 1 from public.visa_applications a where a.id=p_application_id and (a.submitted_by=auth.uid() or a.applicant_profile_id=auth.uid() or public.is_agency_member(a.agency_id)));
$$;
revoke all on function public._visa_document_slot_key(uuid,text,uuid) from public,anon;
grant execute on function public._visa_document_slot_key(uuid,text,uuid) to authenticated;

create or replace function public._visa_required_slots(p_application_id uuid)
returns table(slot_key text,slot_label text) language sql stable security definer set search_path=public as $$
 with app as (
   select a.*,vt.required_documents,vt.application_sections from public.visa_applications a join public.visa_types vt on vt.id=a.visa_type_id
   where a.id=p_application_id and (public._visa_trusted_writer(a.id) or public.visa_staff_can('visa.applications.read') or a.submitted_by=auth.uid() or a.applicant_profile_id=auth.uid() or public.is_agency_member(a.agency_id))
 ), slots as (
   select coalesce(s->>'key',s #>> '{}') as type, coalesce(s->>'label',s->>'key',s #>> '{}') as label,m.id as member_id,m.full_name
   from app a cross join lateral jsonb_array_elements(coalesce(a.resolved_documents,a.required_documents,'[]'::jsonb)) s
   left join public.visa_members m on m.application_id=a.id
   where jsonb_typeof(s)='string' or coalesce((s->>'required')::boolean,true)
   union all
   select (section->>'key')||'.'||(field->>'key'),(section->>'title')||': '||(field->>'label'),m.id,m.full_name
   from app a cross join lateral jsonb_array_elements(a.application_sections) section
   cross join lateral jsonb_array_elements(section->'fields') field
   left join public.visa_members m on m.application_id=a.id and section->>'scope'='traveller'
   where field->>'type'='file' and coalesce((field->>'required')::boolean,false)
 )
 select type||'|'||coalesce(member_id::text,''), label||case when full_name is null then '' else ' ('||full_name||')' end from slots;
$$;
grant execute on function public._visa_required_slots(uuid) to authenticated;

create or replace function public.submit_visa_application(p_application_id uuid)
returns table (price numeric, fee_amount numeric, currency text)
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
  vt public.visa_types;
  v_missing text;
  v_count integer;
  v_unit numeric;
  v_unit_fee numeric;
  v_total numeric;
  v_fee numeric;
begin
  select * into app from public.visa_applications where id = p_application_id for update;
  if not found or app.submitted_by is distinct from auth.uid() then
    raise exception 'visa application not found';
  end if;
  if app.status <> 'draft' then
    raise exception 'this application was already submitted';
  end if;

  select * into vt from public.visa_types where id = app.visa_type_id;
  if vt.status <> 'published' then
    raise exception 'this visa service is no longer available';
  end if;

  if (select count(*) from public.visa_members where application_id=app.id and is_primary) <> 1 then raise exception 'Add the primary traveller before submitting.'; end if;
  if app.applicant_type = 'single' and (select count(*) from public.visa_members where application_id=app.id)<>1 then raise exception 'A single application must contain exactly one traveller.'; end if;
  if app.applicant_type <> 'single' and (select count(*) from public.visa_members where application_id=app.id)<2 then raise exception 'Add at least two travellers for a family or group application.'; end if;
  if exists(select 1 from public.visa_members where application_id=app.id and (passport_expiry is null or passport_expiry <= (app.travel_details->>'departure_date')::date)) then raise exception 'Every traveller passport must be valid after departure.'; end if;

  select string_agg(rs.slot_label, ', ')
    into v_missing
    from public._visa_required_slots(app.id) rs
   where not exists (
     select 1 from public.visa_documents d
      where d.application_id = app.id
        and public._visa_document_slot_key(d.application_id,d.document_type,d.member_id) = rs.slot_key
        and d.is_current and d.review_status <> 'rejected'
   );
  if v_missing is not null then
    raise exception 'missing documents: %', v_missing;
  end if;

  if app.applicant_type = 'single' then
    v_count := 1;
  else
    select greatest(count(*), 1) into v_count from public.visa_members where application_id = app.id;
  end if;

  v_unit := coalesce(app.resolved_price, app.price, vt.price);
  v_unit_fee := coalesce(app.resolved_processing_fee, vt.processing_fee, 0);
  v_total := v_unit * v_count;
  v_fee := v_unit_fee * v_count;

  perform set_config('sts.visa_rpc', app.id::text, true);
  update public.visa_applications
     set price = v_total,
         fee_amount = v_fee,
         currency = vt.currency,
         current_step = 6,
         submitted_at = now(),
         workflow = jsonb_build_object(
           'requires_appointment', vt.requires_appointment,
           'requires_biometrics', vt.requires_biometrics,
           'requires_physical_passport', vt.requires_physical_passport,
           'passport_delivery_modes', to_jsonb(vt.passport_delivery_modes),
           'internal_sla_days', vt.internal_sla_days,
           'visa_type_updated_at', vt.updated_at
         )
   where id = app.id
   returning * into app;
  perform set_config('sts.visa_rpc', '', true);

  perform public._visa_create_passports(app);

  insert into public.visa_case_ops (application_id, sla_due_at)
  values (app.id, now() + make_interval(days => vt.internal_sla_days))
  on conflict (application_id) do update set sla_due_at = excluded.sla_due_at, updated_at = now();

  perform public._visa_set_stage(app.id, 'submitted', null, null, null, false, false);

  perform public._visa_log_event(
    app.id,
    'application.submitted',
    'Application submitted — ' || v_count || ' applicant' || case when v_count = 1 then '' else 's' end,
    coalesce(vt.name, 'Visa') || ' — ' || app.application_ref || ' was submitted.',
    true,
    true,
    null,
    null,
    null,
    null,
    jsonb_build_object('applicants', v_count, 'total', v_total, 'fee', v_fee, 'currency', vt.currency)
  );

  return query select v_total, v_fee, vt.currency;
end;
$$;

create or replace function public._visa_customer_blockers(p_application_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_missing text;
  v_rejected integer;
  v_requests integer;
begin
  select string_agg(rs.slot_label, ', ')
    into v_missing
    from public._visa_required_slots(p_application_id) rs
   where not exists (
     select 1 from public.visa_documents d
      where d.application_id = p_application_id
        and public._visa_document_slot_key(d.application_id,d.document_type,d.member_id) = rs.slot_key
        and d.is_current
        and d.review_status <> 'rejected'
   );
  if v_missing is not null then
    return 'missing documents: ' || v_missing;
  end if;

  select count(*) into v_rejected
    from public.visa_documents
   where application_id = p_application_id
     and is_current
     and review_status = 'rejected';
  if v_rejected > 0 then
    return v_rejected || ' rejected document(s) awaiting replacement';
  end if;

  select count(*) into v_requests
    from public.visa_document_requests
   where application_id = p_application_id
     and requirement = 'required'
     and status = 'requested';
  if v_requests > 0 then
    return v_requests || ' document request(s) not yet answered';
  end if;

  return null;
end;
$$;

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
        where d.application_id = a.id and public._visa_document_slot_key(d.application_id,d.document_type,d.member_id) = rs.slot_key and d.is_current
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


-- Reject cross-application ownership even through direct database uploads.
create or replace function public.guard_visa_document_member()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.member_id is not null and not exists(select 1 from public.visa_members where id=new.member_id and application_id=new.application_id) then
   raise exception 'Traveller does not belong to this application.';
 end if;
 return new;
end; $$;
create trigger guard_visa_document_member before insert on public.visa_documents for each row execute function public.guard_visa_document_member();

-- A legacy family case can supply newly identified missing per-traveller files without rewriting its existing documents.
create or replace function public.visa_upload_missing_document(p_application_id uuid,p_member_id uuid,p_document_type text,p_storage_path text,p_file_name text,p_file_size integer,p_content_type text)
returns uuid language plpgsql security definer set search_path=public as $$
declare app public.visa_applications; result uuid;
begin
 select * into app from public.visa_applications where id=p_application_id for update;
 if not found or not public._visa_is_case_party(app) or app.status in ('draft','approved','rejected','issued','cancelled') then raise exception 'Application is not available for uploads.'; end if;
 if not exists(select 1 from public.visa_members where id=p_member_id and application_id=app.id) then raise exception 'Traveller does not belong to this application.'; end if;
 if not exists(select 1 from public._visa_required_slots(app.id) where slot_key=p_document_type||'|'||p_member_id::text) then raise exception 'Unknown document requirement.'; end if;
 if exists(select 1 from public.visa_documents d where d.application_id=app.id and public._visa_document_slot_key(d.application_id,d.document_type,d.member_id)=p_document_type||'|'||p_member_id::text and is_current) then raise exception 'A file already exists. Refresh before replacing it.'; end if;
 if p_content_type not in ('image/jpeg','image/png','application/pdf') or p_file_size<=0 or p_file_size>5242880 then raise exception 'Choose JPG, PNG or PDF up to 5MB.'; end if;
 perform public._visa_assert_uploaded(app,p_storage_path);
 insert into public.visa_documents(application_id,document_type,member_id,storage_path,uploaded_by,file_name,file_size,content_type)
 values(app.id,p_document_type,p_member_id,p_storage_path,auth.uid(),p_file_name,p_file_size,p_content_type) returning id into result;
 perform public._visa_log_event(app.id,'document.uploaded','Traveller document uploaded','A document was uploaded.',false,true,null,null,null,null,jsonb_build_object('documentId',result),p_member_id);
 return result;
end; $$;
revoke all on function public.visa_upload_missing_document(uuid,uuid,text,text,text,integer,text) from public,anon;
grant execute on function public.visa_upload_missing_document(uuid,uuid,text,text,text,integer,text) to authenticated;

-- Replace only this traveller's slot, atomically. Keep the previous version if saving fails.
create or replace function public.visa_save_draft_document(p_application_id uuid,p_member_id uuid,p_document_type text,p_storage_path text,p_file_name text,p_file_size integer,p_content_type text)
returns uuid language plpgsql security definer set search_path=public as $$
declare app public.visa_applications; vt public.visa_types; previous public.visa_documents; result uuid;
begin
 select * into app from public.visa_applications where id=p_application_id for update;
 if not found or app.status<>'draft' or app.submitted_by is distinct from auth.uid() then raise exception 'This application can no longer be edited.'; end if;
 select * into vt from public.visa_types where id=app.visa_type_id;
 if p_member_id is not null and not exists(select 1 from public.visa_members where id=p_member_id and application_id=app.id) then raise exception 'Traveller does not belong to this application.'; end if;
 if not (
   (p_member_id is not null and exists(select 1 from jsonb_array_elements(coalesce(app.resolved_documents,vt.required_documents,'[]')) s where coalesce(s->>'key',s #>> '{}')=p_document_type))
   or exists(select 1 from jsonb_array_elements(vt.application_sections) section cross join lateral jsonb_array_elements(section->'fields') field where (section->>'key')||'.'||(field->>'key')=p_document_type and field->>'type'='file' and ((section->>'scope'='traveller' and p_member_id is not null) or (coalesce(section->>'scope','application')='application' and p_member_id is null)))
 ) then raise exception 'Unknown traveller document requirement.'; end if;
 if p_content_type not in ('image/jpeg','image/png','application/pdf') or p_file_size<=0 or p_file_size>5242880 then raise exception 'Choose JPG, PNG or PDF up to 5MB.'; end if;
 perform public._visa_assert_uploaded(app,p_storage_path);
 select * into previous from public.visa_documents d where d.application_id=app.id and public._visa_document_slot_key(d.application_id,d.document_type,d.member_id)=p_document_type||'|'||coalesce(p_member_id::text,'') and d.is_current for update;
 perform set_config('sts.visa_rpc',app.id::text,true);
 if previous.id is not null then update public.visa_documents set is_current=false where id=previous.id; end if;
 insert into public.visa_documents(application_id,document_type,member_id,storage_path,uploaded_by,file_name,file_size,content_type,version,supersedes_id)
 values(app.id,p_document_type,p_member_id,p_storage_path,auth.uid(),p_file_name,p_file_size,p_content_type,coalesce(previous.version,0)+1,previous.id) returning id into result;
 perform set_config('sts.visa_rpc','',true);
 return result;
end; $$;
revoke all on function public.visa_save_draft_document(uuid,uuid,text,text,text,integer,text) from public,anon;
grant execute on function public.visa_save_draft_document(uuid,uuid,text,text,text,integer,text) to authenticated;
