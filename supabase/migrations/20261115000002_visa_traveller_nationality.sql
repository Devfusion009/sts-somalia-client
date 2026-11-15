-- Resolve each draft traveller independently; preserve the exact submitted quote.
create or replace function public.visa_traveller_requirements(p_application_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare app public.visa_applications; result jsonb; vt public.visa_types;
begin
 select * into app from visa_applications where id=p_application_id;
 if not found or not (public.visa_staff_can('visa.applications.read') or public._visa_trusted_writer(app.id) or public._visa_is_case_party(app)) then raise exception 'Application not found.'; end if;
 if app.status<>'draft' and app.workflow ? 'traveller_requirements' then return app.workflow->'traveller_requirements'; end if;
 select * into vt from visa_types where id=app.visa_type_id;
 if app.status<>'draft' then
   select coalesce(jsonb_object_agg(m.id::text,jsonb_build_object('price',coalesce(app.resolved_price,vt.price),'processing_fee',coalesce(app.resolved_processing_fee,vt.processing_fee),'required_documents',coalesce(app.resolved_documents,vt.required_documents),'eligibility_requirements',app.resolved_eligibility_requirements)),'{}') into result from visa_members m where m.application_id=app.id;
 else
   select coalesce(jsonb_object_agg(m.id::text,to_jsonb(r)),'{}') into result from visa_members m cross join lateral public.resolve_visa_pricing(app.visa_type_id,m.nationality) r where m.application_id=app.id;
 end if;
 return result;
end; $$;
revoke all on function public.visa_traveller_requirements(uuid) from public,anon;
grant execute on function public.visa_traveller_requirements(uuid) to authenticated;

create or replace function public._visa_required_slots(p_application_id uuid)
returns table(slot_key text,slot_label text) language sql stable security definer set search_path=public as $$
 with app as (
   select a.*,vt.required_documents,vt.application_sections from public.visa_applications a join public.visa_types vt on vt.id=a.visa_type_id
   where a.id=p_application_id and (public._visa_trusted_writer(a.id) or public.visa_staff_can('visa.applications.read') or a.submitted_by=auth.uid() or a.applicant_profile_id=auth.uid() or public.is_agency_member(a.agency_id))
 ), slots as (
   select coalesce(s->>'key',s #>> '{}') as type, coalesce(s->>'label',s->>'key',s #>> '{}') as label,m.id as member_id,m.full_name
   from app a left join public.visa_members m on m.application_id=a.id
   cross join lateral jsonb_array_elements(coalesce(public.visa_traveller_requirements(a.id)->m.id::text->'required_documents',a.resolved_documents,a.required_documents,'[]'::jsonb)) s
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
  v_requirements jsonb;
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

  if exists(select 1 from visa_members where application_id=app.id and (nationality is null or nationality=vt.destination_country_code)) then raise exception 'Check each traveller passport nationality.'; end if;
  if exists(select 1 from visa_members where application_id=app.id group by nationality,upper(regexp_replace(passport_number,'\s','','g')) having count(*)>1) then raise exception 'A passport is assigned to more than one traveller.'; end if;

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
  v_requirements := public.visa_traveller_requirements(app.id);
  select sum((value->>'price')::numeric),sum(coalesce((value->>'processing_fee')::numeric,0)) into v_total,v_fee from jsonb_each(v_requirements);
  if v_total is null then raise exception 'Traveller pricing is unavailable.'; end if;

  perform set_config('sts.visa_rpc', app.id::text, true);
  update public.visa_applications
     set price = v_total,
         fee_amount = v_fee,
         currency = vt.currency,
         current_step = 6,
         submitted_at = now(),
         workflow = jsonb_build_object(
           'traveller_requirements', v_requirements,
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

create or replace function public.visa_save_draft_document(p_application_id uuid,p_member_id uuid,p_document_type text,p_storage_path text,p_file_name text,p_file_size integer,p_content_type text)
returns uuid language plpgsql security definer set search_path=public as $$
declare app public.visa_applications; vt public.visa_types; previous public.visa_documents; result uuid;
begin
 select * into app from public.visa_applications where id=p_application_id for update;
 if not found or app.status<>'draft' or app.submitted_by is distinct from auth.uid() then raise exception 'This application can no longer be edited.'; end if;
 select * into vt from public.visa_types where id=app.visa_type_id;
 if p_member_id is not null and not exists(select 1 from public.visa_members where id=p_member_id and application_id=app.id) then raise exception 'Traveller does not belong to this application.'; end if;
 if not (
   (p_member_id is not null and exists(select 1 from jsonb_array_elements(coalesce(public.visa_traveller_requirements(app.id)->p_member_id::text->'required_documents',app.resolved_documents,vt.required_documents,'[]')) s where coalesce(s->>'key',s #>> '{}')=p_document_type))
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
