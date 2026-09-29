-- Visa case management, milestone 3 of 5: passport custody.
--
-- For programs that need the physical passport, each traveller's passport is
-- tracked from the applicant, through STS and the centre, back to the
-- applicant (collected or couriered). Every move is an append-only event.
-- An approved physical-passport case is issued once every passport is back.

create table public.visa_passports (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.visa_applications (id) on delete cascade,
  member_id uuid references public.visa_members (id),
  holder_name text,
  status text not null default 'with_applicant'
    check (status in ('with_applicant', 'with_sts', 'with_centre', 'in_transit',
                      'ready_for_collection', 'out_for_delivery', 'delivered', 'collected')),
  delivery_mode text check (delivery_mode in ('counter', 'courier', 'third_party')),
  courier_name text,
  tracking_reference text,
  collector_name text,
  authorization_document_id uuid references public.visa_documents (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index visa_passports_one_per_traveller
  on public.visa_passports (application_id, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table public.visa_passport_events (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references public.visa_passports (id) on delete cascade,
  application_id uuid not null references public.visa_applications (id) on delete cascade,
  from_status text,
  to_status text not null,
  delivery_mode text,
  reference text,
  note text,
  actor_id uuid default auth.uid(),
  created_at timestamptz not null default clock_timestamp()
);

create index visa_passport_events_passport_idx on public.visa_passport_events (passport_id, created_at);

create trigger visa_passport_events_append_only
  before update or delete on public.visa_passport_events
  for each row execute function public.guard_visa_child_append_only();

create or replace function public.guard_visa_passports()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.visa_applications where id = old.application_id) then
      return old;
    end if;
    raise exception 'passport records are never deleted';
  end if;
  if coalesce(current_setting('role', true), 'none') in ('authenticated', 'anon')
     and coalesce(current_setting('sts.visa_rpc', true), '') <> old.application_id::text then
    raise exception 'passport changes go through visa_record_passport_event()';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.guard_visa_passports() from public, anon, authenticated;

create trigger visa_passports_guard
  before update or delete on public.visa_passports
  for each row execute function public.guard_visa_passports();

alter table public.visa_passports enable row level security;
alter table public.visa_passport_events enable row level security;

create policy "visa_passports: staff read"
  on public.visa_passports for select
  using ((select public.visa_staff_can('visa.applications.read')));
create policy "visa_passports: party read"
  on public.visa_passports for select
  using (
    exists (
      select 1 from public.visa_applications a
       where a.id = visa_passports.application_id
         and (a.submitted_by = auth.uid() or a.applicant_profile_id = auth.uid()
              or (a.agency_id is not null and public.is_agency_member(a.agency_id)))
    )
  );
create policy "visa_passport_events: staff read"
  on public.visa_passport_events for select
  using ((select public.visa_staff_can('visa.applications.read')));

revoke insert, update, delete, truncate on public.visa_passports from anon, authenticated;
revoke insert, update, delete, truncate on public.visa_passport_events from anon, authenticated;

create or replace function public._visa_create_passports(app public.visa_applications)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce((app.workflow->>'requires_physical_passport')::boolean, false) then
    return;
  end if;
  insert into public.visa_passports (application_id, member_id, holder_name)
  select app.id, m.id, m.full_name
    from public.visa_members m
   where m.application_id = app.id
      and (app.applicant_type <> 'single' or m.is_primary)
  on conflict do nothing;
  if not exists (select 1 from public.visa_passports where application_id = app.id) then
    insert into public.visa_passports (application_id, holder_name)
    values (app.id, app.traveler_details->>'full_name');
  end if;
end;
$$;

revoke execute on function public._visa_create_passports(public.visa_applications) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Submit now opens passport records when the program needs them.
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

revoke execute on function public.submit_visa_application(uuid) from public, anon;
grant execute on function public.submit_visa_application(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Submission needs every passport in STS's or the centre's hands.
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
  v_out integer;
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

  if coalesce((app.workflow->>'requires_physical_passport')::boolean, false) then
    select count(*) into v_out from public.visa_passports
     where application_id = app.id and status not in ('with_sts', 'with_centre');
    if v_out > 0 then
      return v_out || ' passport(s) not yet received';
    end if;
  end if;

  return null;
end;
$$;

-- Submitting hands the passports STS holds to the centre.
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
  p record;
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

  perform set_config('sts.visa_rpc', app.id::text, true);
  for p in select * from public.visa_passports where application_id = app.id and status = 'with_sts' loop
    update public.visa_passports set status = 'with_centre' where id = p.id;
    insert into public.visa_passport_events (passport_id, application_id, from_status, to_status, reference, note)
    values (p.id, app.id, 'with_sts', 'with_centre', v_ref, 'Lodged with ' || v_with);
  end loop;
  perform set_config('sts.visa_rpc', '', true);

  return v_job;
end;
$$;

-- ----------------------------------------------------------------------------
-- Issue guard: a physical-passport case is issued when every passport is back.
-- ----------------------------------------------------------------------------
create or replace function public.guard_visa_decision_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.visa_decisions;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status in ('approved', 'rejected') then
    d := public.visa_current_decision(new.id);
    if d.id is null or d.outcome <> (case new.status when 'approved' then 'approved' else 'refused' end) then
      raise exception 'record the authority''s decision before moving % to %', new.application_ref, new.status;
    end if;
  end if;

  if new.status = 'issued' then
    d := public.visa_current_decision(new.id);
    if d.id is null or d.outcome <> 'approved' then
      raise exception 'only an approved application can be issued';
    end if;
    if coalesce((new.workflow->>'requires_physical_passport')::boolean, false) then
      if exists (
        select 1 from public.visa_passports
         where application_id = new.id and status not in ('delivered', 'collected')
      ) then
        raise exception 'return every passport before marking % issued', new.application_ref;
      end if;
    elsif not exists (
      select 1 from public.visa_documents
       where application_id = new.id and document_type = 'visa_result' and is_current
    ) then
      raise exception 'attach the visa document before marking % issued', new.application_ref;
    end if;
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Passport movements
-- ----------------------------------------------------------------------------
create or replace function public.visa_record_passport_event(
  p_passport_id uuid,
  p_to_status text,
  p_delivery_mode text default null,
  p_reference text default null,
  p_collector_name text default null,
  p_authorization_document_id uuid default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pp public.visa_passports;
  app public.visa_applications;
  v_mode text;
  v_ref text := nullif(btrim(coalesce(p_reference, '')), '');
  v_collector text := nullif(btrim(coalesce(p_collector_name, '')), '');
  v_label text;
  v_holder text;
  v_customer text;
  v_notify boolean := false;
  v_modes text[];
begin
  perform public._visa_require('visa.passport.manage');
  select * into pp from public.visa_passports where id = p_passport_id for update;
  if not found then
    raise exception 'passport record not found';
  end if;
  select * into app from public.visa_applications where id = pp.application_id for update;

  if not (
    case pp.status
      when 'with_applicant' then p_to_status in ('with_sts', 'with_centre')
      when 'with_sts' then p_to_status in ('with_centre', 'ready_for_collection', 'with_applicant')
      when 'with_centre' then p_to_status in ('in_transit', 'ready_for_collection', 'with_sts')
      when 'in_transit' then p_to_status in ('with_sts', 'ready_for_collection')
      when 'ready_for_collection' then p_to_status in ('collected', 'out_for_delivery')
      when 'out_for_delivery' then p_to_status in ('delivered', 'ready_for_collection')
      else false
    end
  ) then
    raise exception 'a passport cannot move from % to %', replace(pp.status, '_', ' '), replace(p_to_status, '_', ' ');
  end if;

  v_mode := coalesce(p_delivery_mode, pp.delivery_mode);
  if p_to_status = 'out_for_delivery' then
    v_mode := 'courier';
    if coalesce(v_ref, pp.tracking_reference) is null then
      raise exception 'enter the courier tracking reference';
    end if;
  end if;
  if p_to_status = 'delivered' and coalesce(v_ref, pp.tracking_reference) is null then
    raise exception 'enter the courier tracking reference';
  end if;
  if p_to_status = 'collected' then
    if v_mode not in ('counter', 'third_party') or v_mode is null then
      v_mode := 'counter';
    end if;
    if v_mode = 'third_party' and (v_collector is null or coalesce(p_authorization_document_id, pp.authorization_document_id) is null) then
      raise exception 'a third-party collection needs the collector''s name and the signed authorisation';
    end if;
  end if;
  if p_to_status in ('out_for_delivery', 'delivered', 'collected') then
    v_modes := array(select jsonb_array_elements_text(coalesce(app.workflow->'passport_delivery_modes', '[]'::jsonb)));
    if cardinality(v_modes) = 0 then
      v_modes := array['counter', 'courier', 'third_party'];
    end if;
    if not (v_mode = any (v_modes)) then
      raise exception '% returns are not offered for this visa', replace(v_mode, '_', ' ');
    end if;
  end if;
  if p_authorization_document_id is not null
     and not exists (select 1 from public.visa_documents where id = p_authorization_document_id and application_id = app.id) then
    raise exception 'authorisation not found on this application';
  end if;

  perform set_config('sts.visa_rpc', app.id::text, true);
  update public.visa_passports
     set status = p_to_status,
         delivery_mode = case when p_to_status in ('out_for_delivery', 'delivered', 'collected') then v_mode else delivery_mode end,
         tracking_reference = case when p_to_status in ('out_for_delivery', 'delivered') then coalesce(v_ref, tracking_reference) else tracking_reference end,
         collector_name = case when p_to_status = 'collected' then coalesce(v_collector, collector_name) else collector_name end,
         authorization_document_id = coalesce(p_authorization_document_id, authorization_document_id)
   where id = pp.id;
  perform set_config('sts.visa_rpc', '', true);

  insert into public.visa_passport_events (passport_id, application_id, from_status, to_status, delivery_mode, reference, note)
  values (pp.id, app.id, pp.status, p_to_status, v_mode, v_ref, nullif(btrim(coalesce(p_note, '')), ''));

  v_holder := coalesce(pp.holder_name, 'Passport');
  v_label := case p_to_status
    when 'with_sts' then 'received by STS'
    when 'with_centre' then 'with the visa centre'
    when 'in_transit' then 'in transit from the centre'
    when 'ready_for_collection' then 'ready for collection'
    when 'out_for_delivery' then 'out for delivery'
    when 'delivered' then 'delivered'
    when 'collected' then 'collected'
    when 'with_applicant' then 'returned to applicant'
  end;
  v_notify := p_to_status in ('ready_for_collection', 'out_for_delivery', 'delivered');
  v_customer := case
    when p_to_status = 'ready_for_collection' then 'Your passport (' || v_holder || ') is ready for collection.'
    when p_to_status = 'out_for_delivery' then 'Your passport (' || v_holder || ') is out for delivery'
      || case when coalesce(v_ref, pp.tracking_reference) is not null then ' — tracking ' || coalesce(v_ref, pp.tracking_reference) else '' end || '.'
    when p_to_status in ('with_sts', 'with_centre', 'delivered', 'collected') then 'Passport (' || v_holder || ') ' || v_label || '.'
  end;

  perform public._visa_log_event(
    app.id, 'passport.' || p_to_status,
    v_holder || ' — ' || v_label
      || case when v_ref is not null then ' (' || v_ref || ')' else '' end
      || case when v_collector is not null then ' by ' || v_collector else '' end,
    v_customer, v_notify, false, 'visa.passport.manage',
    nullif(btrim(coalesce(p_note, '')), ''), null, null,
    jsonb_build_object('passportId', pp.id, 'from', pp.status, 'to', p_to_status), pp.member_id
  );

  if app.status = 'approved'
     and not exists (
       select 1 from public.visa_passports
        where application_id = app.id and status not in ('delivered', 'collected')
     ) then
    perform public._visa_set_stage(app.id, 'issued', null, 'visa.passport.manage', null, true);
  end if;
end;
$$;

revoke execute on function public.visa_record_passport_event(uuid, text, text, text, text, uuid, text) from public, anon;
grant execute on function public.visa_record_passport_event(uuid, text, text, text, text, uuid, text) to authenticated;

-- Readiness: passports.
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
  v_out integer;
begin
  perform public._visa_require('visa.applications.read');
  select * into app from public.visa_applications where id = p_application_id;
  v_payment := public.visa_payment_state(p_application_id);
  v_customer := public._visa_customer_blockers(p_application_id);
  v_outstanding := public.visa_application_outstanding_items(p_application_id);
  v_appt := exists (select 1 from public.visa_appointments where application_id = app.id and status = 'attended');
  v_bio := exists (select 1 from public.visa_appointments where application_id = app.id and status = 'attended' and biometrics_completed);
  select count(*) into v_out from public.visa_passports
   where application_id = app.id and status not in ('with_sts', 'with_centre');

  return query values
    ('payment', 'Payment received', true, v_payment in ('paid', 'partially_paid'), v_payment),
    ('documents_complete', 'Documents complete', true, v_customer is null, v_customer),
    ('documents_reviewed', 'Documents reviewed', true, v_outstanding is null,
       case when v_customer is null then v_outstanding end),
    ('appointment', 'Appointment attended', coalesce((app.workflow->>'requires_appointment')::boolean, false), v_appt,
       case when exists (select 1 from public.visa_appointments where application_id = app.id and status = 'booked')
            then 'booked' else null end),
    ('biometrics', 'Biometrics taken', coalesce((app.workflow->>'requires_biometrics')::boolean, false), v_bio, null::text),
    ('passport', 'Passport received',
       coalesce((app.workflow->>'requires_physical_passport')::boolean, false)
         and app.status in ('submitted', 'in_review', 'additional_info_required', 'ready_for_processing'),
       v_out = 0, case when v_out > 0 then v_out || ' outstanding' end),
    ('lodgement', 'Submitted to centre', app.status in ('ready_for_processing', 'processing'),
       exists (select 1 from public.visa_processing_jobs where application_id = app.id and status = 'active'), null::text);
end;
$$;
