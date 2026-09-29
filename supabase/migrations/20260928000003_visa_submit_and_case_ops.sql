-- Visa case management, milestone 1 of 5: server-side submit, workflow
-- config snapshot, staff-only case ops.
--
-- * visa_types gains per-program workflow flags (appointment, biometrics,
--   physical passport, delivery modes, internal SLA). They are copied onto
--   the application at submit (visa_applications.workflow) so a later
--   catalog edit never changes a case already in flight.
-- * submit_visa_application() replaces the customer-side
--   "update price, then set status" sequence: price, fee, and completeness are
--   decided in SQL, never from values the browser sent.
-- * visa_case_ops holds staff-only fields (owner, priority, SLA). Customers can
--   read every column of their own visa_applications row, so these cannot
--   live there.

alter table public.visa_types
  add column if not exists requires_appointment boolean not null default false,
  add column if not exists requires_biometrics boolean not null default false,
  add column if not exists requires_physical_passport boolean not null default false,
  add column if not exists passport_delivery_modes text[] not null default '{counter}',
  add column if not exists internal_sla_days smallint not null default 2
    check (internal_sla_days between 0 and 60);

alter table public.visa_types
  add constraint visa_types_passport_delivery_modes_valid
  check (passport_delivery_modes <@ array['counter', 'courier', 'third_party']::text[]
         and cardinality(passport_delivery_modes) > 0);

alter table public.visa_applications
  add column if not exists workflow jsonb not null default '{}'::jsonb,
  add column if not exists info_return_stage public.visa_status,
  add column if not exists submitted_at timestamptz;

update public.visa_applications a
   set workflow = jsonb_build_object(
         'requires_appointment', false,
         'requires_biometrics', false,
         'requires_physical_passport', false,
         'passport_delivery_modes', jsonb_build_array('counter'),
         'internal_sla_days', 2,
         'backfilled', true
       ),
       submitted_at = (
         select min(h.created_at) from public.visa_application_status_history h
          where h.application_id = a.id and h.status = 'submitted'
       )
 where a.status <> 'draft';

-- The draft-integrity trigger must also protect the new staff-owned columns.
create or replace function public.visa_applications_draft_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nat text;
  vt public.visa_types;
  r public.visa_nationality_rules;
begin
  if public._visa_trusted_writer(new.id) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'a new visa application must start as a draft';
    end if;
    if new.application_ref !~ '^STS-VISA-[0-9]{4}-[0-9]{6}$' then
      raise exception 'invalid application reference';
    end if;
    new.admin_notes := null;
    new.decided_by := null;
    new.decided_at := null;
    new.partner_provider_key := null;
    new.partner_ref := null;
    new.partner_status := null;
    new.partner_last_synced_at := null;
    new.partner_raw_payload := null;
    new.workflow := '{}'::jsonb;
    new.info_return_stage := null;
    new.submitted_at := null;
  else
    if new.visa_type_id is distinct from old.visa_type_id
       or new.submitted_by is distinct from old.submitted_by
       or new.applicant_profile_id is distinct from old.applicant_profile_id
       or new.agency_id is distinct from old.agency_id
       or new.agency_customer_id is distinct from old.agency_customer_id
       or new.application_ref is distinct from old.application_ref
       or new.admin_notes is distinct from old.admin_notes
       or new.decided_by is distinct from old.decided_by
       or new.decided_at is distinct from old.decided_at
       or new.partner_provider_key is distinct from old.partner_provider_key
       or new.partner_ref is distinct from old.partner_ref
       or new.partner_status is distinct from old.partner_status
       or new.partner_last_synced_at is distinct from old.partner_last_synced_at
       or new.partner_raw_payload is distinct from old.partner_raw_payload
       or new.workflow is distinct from old.workflow
       or new.info_return_stage is distinct from old.info_return_stage
       or new.submitted_at is distinct from old.submitted_at then
      raise exception 'this field can only be changed by STS';
    end if;
  end if;

  select * into vt from public.visa_types where id = new.visa_type_id;
  if not found then
    raise exception 'visa type not found';
  end if;

  v_nat := upper(nullif(btrim(coalesce(new.traveler_details->>'nationality', '')), ''));
  if v_nat is not null then
    select * into r from public.visa_nationality_rules
     where visa_type_id = vt.id and nationality_code = v_nat;
  end if;

  new.currency := vt.currency;
  new.price := coalesce(r.price, vt.price);
  new.fee_amount := 0;
  if v_nat is null then
    new.resolved_price := null;
    new.resolved_processing_fee := null;
    new.resolved_processing_days_min := null;
    new.resolved_processing_days_max := null;
    new.resolved_documents := null;
    new.resolved_eligibility_requirements := null;
  else
    new.resolved_price := coalesce(r.price, vt.price);
    new.resolved_processing_fee := coalesce(r.processing_fee, vt.processing_fee);
    new.resolved_processing_days_min := coalesce(r.processing_days_min, vt.processing_days_min);
    new.resolved_processing_days_max := coalesce(r.processing_days_max, vt.processing_days_max);
    new.resolved_documents := coalesce(r.required_documents, vt.required_documents);
    new.resolved_eligibility_requirements := coalesce(r.eligibility_requirements, vt.eligibility_requirements);
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Staff-only case operations
-- ----------------------------------------------------------------------------
create table public.visa_case_ops (
  application_id uuid primary key references public.visa_applications (id) on delete cascade,
  assigned_to uuid references public.profiles (id) on delete set null,
  priority text not null default 'normal' check (priority in ('normal', 'urgent')),
  sla_due_at timestamptz,
  updated_at timestamptz not null default now()
);

create index visa_case_ops_assigned_idx on public.visa_case_ops (assigned_to);

alter table public.visa_case_ops enable row level security;

create policy "visa_case_ops: staff read"
  on public.visa_case_ops for select
  using ((select public.visa_staff_can('visa.applications.read')));

revoke insert, update, delete, truncate on public.visa_case_ops from anon, authenticated;

insert into public.visa_case_ops (application_id, sla_due_at)
select a.id,
       case when a.status in ('approved', 'rejected', 'issued', 'cancelled') then null
            else coalesce(a.submitted_at, a.created_at) + interval '2 days' end
  from public.visa_applications a
 where a.status <> 'draft'
on conflict (application_id) do nothing;

-- ----------------------------------------------------------------------------
-- Slot helpers shared by submit and the outstanding-items check.
-- Mirrors parseDocumentSlots(): bare-string slots are required; object slots
-- are required unless "required": false.
-- ----------------------------------------------------------------------------
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
     and (jsonb_typeof(s) = 'string' or coalesce((s->>'required')::boolean, true));
$$;

revoke execute on function public._visa_required_slots(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Submit
-- ----------------------------------------------------------------------------
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

  select string_agg(rs.slot_label, ', ')
    into v_missing
    from public._visa_required_slots(app.id) rs
   where not exists (
     select 1 from public.visa_documents d
      where d.application_id = app.id
        and d.document_type = rs.slot_key
        and d.review_status <> 'rejected'
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
   where id = app.id;
  perform set_config('sts.visa_rpc', '', true);

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

revoke execute on function public.submit_visa_application(uuid) from public, anon;
grant execute on function public.submit_visa_application(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Customer fulfils a staff document request with a file already uploaded to
-- visa-documents/<application id>/...
-- ----------------------------------------------------------------------------
create or replace function public.visa_fulfil_document_request(
  p_request_id uuid,
  p_storage_path text,
  p_file_name text default null,
  p_file_size integer default null,
  p_content_type text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.visa_document_requests;
  app public.visa_applications;
  v_doc uuid;
begin
  select * into req from public.visa_document_requests where id = p_request_id for update;
  if not found then
    raise exception 'document request not found';
  end if;

  select * into app from public.visa_applications where id = req.application_id;
  if app.submitted_by is distinct from auth.uid()
     and app.applicant_profile_id is distinct from auth.uid()
     and not (app.agency_id is not null and public.is_agency_member(app.agency_id)) then
    raise exception 'document request not found';
  end if;
  if req.status <> 'requested' then
    raise exception 'this document was already provided';
  end if;
  if app.status in ('approved', 'rejected', 'issued', 'cancelled') then
    raise exception 'this application is closed';
  end if;
  if split_part(p_storage_path, '/', 1) <> app.id::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'visa-documents' and o.name = p_storage_path) then
    raise exception 'upload not found';
  end if;

  insert into public.visa_documents (
    application_id, document_type, storage_path, uploaded_by, file_name, file_size, content_type
  ) values (
    app.id, 'request:' || req.title, p_storage_path, auth.uid(), p_file_name, p_file_size, p_content_type
  )
  returning id into v_doc;

  update public.visa_document_requests
     set status = 'uploaded', document_id = v_doc, updated_at = now()
   where id = req.id;

  perform public._visa_log_event(
    app.id,
    'request.fulfilled',
    'Customer uploaded "' || req.title || '"',
    'You uploaded "' || req.title || '".',
    false,
    true,
    null,
    null,
    null,
    null,
    jsonb_build_object('requestId', req.id, 'documentId', v_doc)
  );

  return v_doc;
end;
$$;

revoke execute on function public.visa_fulfil_document_request(uuid, text, text, integer, text) from public, anon;
grant execute on function public.visa_fulfil_document_request(uuid, text, text, integer, text) to authenticated;

-- ----------------------------------------------------------------------------
-- The generic transition RPC is staff-only from here (removed in milestone 3).
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
begin
  perform public._visa_require('visa.applications.edit');
  if p_status = 'submitted' then
    raise exception 'applications are submitted by the applicant';
  end if;
  return public._visa_set_stage(p_application_id, p_status, p_note, 'visa.applications.edit', null, true, false);
end;
$$;

revoke execute on function public.set_visa_application_status(uuid, public.visa_status, text) from public, anon;
grant execute on function public.set_visa_application_status(uuid, public.visa_status, text) to authenticated;
