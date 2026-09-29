-- Visa case management, milestone 3 of 5: application centres + appointments.
--
-- Centres are configuration (address, provider, hours, timezone). An
-- appointment is its own record with history: rescheduling marks the old row
-- "rescheduled" and inserts a new one pointing back at it, so the original
-- slot is never lost. Outcomes (attended / no-show, biometrics taken) are
-- recorded on the row that was booked.

create table public.visa_application_centres (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  city text not null check (btrim(city) <> ''),
  address text,
  provider text,
  phone text,
  email text,
  website_url text,
  appointment_url text,
  submission_hours text,
  collection_hours text,
  timezone text not null default 'Africa/Mogadishu',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_visa_application_centres_updated_at
  before update on public.visa_application_centres
  for each row execute function public.set_updated_at();

create table public.visa_type_centres (
  visa_type_id uuid not null references public.visa_types (id) on delete cascade,
  centre_id uuid not null references public.visa_application_centres (id) on delete cascade,
  primary key (visa_type_id, centre_id)
);

alter table public.visa_application_centres enable row level security;
alter table public.visa_type_centres enable row level security;

create policy "visa_application_centres: read active"
  on public.visa_application_centres for select
  using (is_active or (select public.visa_staff_can('visa.applications.read')));
create policy "visa_application_centres: config manage"
  on public.visa_application_centres for all
  using ((select public.visa_staff_can('visa.config.manage')))
  with check ((select public.visa_staff_can('visa.config.manage')));

create policy "visa_type_centres: read"
  on public.visa_type_centres for select
  using (true);
create policy "visa_type_centres: config manage"
  on public.visa_type_centres for all
  using ((select public.visa_staff_can('visa.config.manage')))
  with check ((select public.visa_staff_can('visa.config.manage')));

-- Configuration changes are audited (requirement / fee / centre edits).
drop trigger if exists visa_application_centres_audit on public.visa_application_centres;
create trigger visa_application_centres_audit
  after insert or update or delete on public.visa_application_centres
  for each row execute function public.audit_log_row_change();

drop trigger if exists visa_types_audit on public.visa_types;
create trigger visa_types_audit
  after insert or update or delete on public.visa_types
  for each row execute function public.audit_log_row_change();

drop trigger if exists visa_nationality_rules_audit on public.visa_nationality_rules;
create trigger visa_nationality_rules_audit
  after insert or update or delete on public.visa_nationality_rules
  for each row execute function public.audit_log_row_change();

-- ----------------------------------------------------------------------------
-- Appointments
-- ----------------------------------------------------------------------------
create table public.visa_appointments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.visa_applications (id) on delete cascade,
  member_id uuid references public.visa_members (id),
  centre_id uuid not null references public.visa_application_centres (id),
  appointment_type text not null check (appointment_type in ('submission', 'biometrics', 'interview', 'collection')),
  scheduled_at timestamptz not null,
  confirmation_number text,
  biometrics_required boolean not null default false,
  biometrics_completed boolean not null default false,
  status text not null default 'booked'
    check (status in ('booked', 'attended', 'no_show', 'cancelled', 'rescheduled')),
  supersedes_id uuid references public.visa_appointments (id),
  status_reason text,
  created_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  status_changed_at timestamptz,
  constraint visa_appointments_biometrics_only_when_attended
    check (not biometrics_completed or status = 'attended')
);

create index visa_appointments_application_idx on public.visa_appointments (application_id, scheduled_at);
create index visa_appointments_upcoming_idx on public.visa_appointments (scheduled_at) where status = 'booked';
create unique index visa_appointments_one_booked
  on public.visa_appointments (
    application_id,
    coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid),
    appointment_type
  )
  where status = 'booked';

create or replace function public.guard_visa_appointments()
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
    raise exception 'appointments are never deleted — cancel instead';
  end if;

  if coalesce(current_setting('role', true), 'none') in ('authenticated', 'anon')
     and coalesce(current_setting('sts.visa_rpc', true), '') <> old.application_id::text then
    raise exception 'appointments change through the appointment actions';
  end if;

  if new.application_id is distinct from old.application_id
     or new.member_id is distinct from old.member_id
     or new.centre_id is distinct from old.centre_id
     or new.appointment_type is distinct from old.appointment_type
     or new.scheduled_at is distinct from old.scheduled_at
     or new.confirmation_number is distinct from old.confirmation_number
     or new.biometrics_required is distinct from old.biometrics_required
     or new.supersedes_id is distinct from old.supersedes_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'a booked appointment cannot be edited — reschedule it';
  end if;

  if old.status <> 'booked' then
    raise exception 'this appointment is already %', old.status;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_visa_appointments() from public, anon, authenticated;

create trigger visa_appointments_guard
  before update or delete on public.visa_appointments
  for each row execute function public.guard_visa_appointments();

alter table public.visa_appointments enable row level security;

create policy "visa_appointments: staff read"
  on public.visa_appointments for select
  using ((select public.visa_staff_can('visa.applications.read')));
create policy "visa_appointments: party read"
  on public.visa_appointments for select
  using (
    exists (
      select 1 from public.visa_applications a
       where a.id = visa_appointments.application_id
         and (a.submitted_by = auth.uid() or a.applicant_profile_id = auth.uid()
              or (a.agency_id is not null and public.is_agency_member(a.agency_id)))
    )
  );

revoke insert, update, delete, truncate on public.visa_appointments from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------
create or replace function public._visa_appointment_label(p_type text)
returns text
language sql
immutable
as $$
  select case p_type
    when 'submission' then 'Submission appointment'
    when 'biometrics' then 'Biometrics appointment'
    when 'interview' then 'Interview'
    when 'collection' then 'Passport collection'
    else 'Appointment'
  end;
$$;

create or replace function public._visa_appointment_when(p_at timestamptz, p_centre uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select to_char(p_at at time zone coalesce(c.timezone, 'Africa/Mogadishu'), 'DD Mon YYYY, HH24:MI')
    from public.visa_application_centres c
   where c.id = p_centre;
$$;

revoke execute on function public._visa_appointment_when(timestamptz, uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Actions
-- ----------------------------------------------------------------------------
create or replace function public.visa_book_appointment(
  p_application_id uuid,
  p_centre_id uuid,
  p_type text,
  p_scheduled_at timestamptz,
  p_confirmation text default null,
  p_biometrics_required boolean default false,
  p_member_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
  centre public.visa_application_centres;
  v_id uuid;
  v_label text;
begin
  perform public._visa_require('visa.appointments.manage');
  app := public._visa_open_case(p_application_id);
  if app.status not in ('in_review', 'additional_info_required', 'ready_for_processing', 'processing') then
    raise exception 'appointments are booked once document review has started';
  end if;
  if public.visa_payment_state(app.id) not in ('paid', 'partially_paid') then
    raise exception 'this application has not been paid for yet';
  end if;
  select * into centre from public.visa_application_centres where id = p_centre_id and is_active;
  if not found then
    raise exception 'choose an active application centre';
  end if;
  if p_type not in ('submission', 'biometrics', 'interview', 'collection') then
    raise exception 'invalid appointment type';
  end if;
  if p_scheduled_at is null or p_scheduled_at < date_trunc('day', now()) then
    raise exception 'the appointment date is in the past';
  end if;
  if p_member_id is not null
     and not exists (select 1 from public.visa_members where id = p_member_id and application_id = app.id) then
    raise exception 'traveller not found on this application';
  end if;

  insert into public.visa_appointments (
    application_id, member_id, centre_id, appointment_type, scheduled_at,
    confirmation_number, biometrics_required
  ) values (
    app.id, p_member_id, centre.id, p_type, p_scheduled_at,
    nullif(btrim(coalesce(p_confirmation, '')), ''), coalesce(p_biometrics_required, false)
  )
  returning id into v_id;

  v_label := public._visa_appointment_label(p_type);
  perform public._visa_log_event(
    app.id, 'appointment.booked',
    v_label || ' booked — ' || centre.name || ', ' || public._visa_appointment_when(p_scheduled_at, centre.id),
    v_label || ': ' || centre.name || ', ' || centre.city || ' — ' || public._visa_appointment_when(p_scheduled_at, centre.id)
      || case when nullif(btrim(coalesce(p_confirmation, '')), '') is not null then ' (ref ' || btrim(p_confirmation) || ')' else '' end
      || '.',
    true, false, 'visa.appointments.manage',
    null, null, null, jsonb_build_object('appointmentId', v_id), p_member_id
  );

  return v_id;
end;
$$;

create or replace function public.visa_reschedule_appointment(
  p_appointment_id uuid,
  p_scheduled_at timestamptz,
  p_reason text,
  p_confirmation text default null,
  p_centre_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  appt public.visa_appointments;
  app public.visa_applications;
  centre public.visa_application_centres;
  v_id uuid;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_label text;
begin
  perform public._visa_require('visa.appointments.manage');
  select * into appt from public.visa_appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'appointment not found';
  end if;
  if appt.status <> 'booked' then
    raise exception 'only a booked appointment can be rescheduled';
  end if;
  if v_reason is null then
    raise exception 'enter a reason for rescheduling';
  end if;
  if p_scheduled_at is null or p_scheduled_at < date_trunc('day', now()) then
    raise exception 'the new date is in the past';
  end if;
  app := public._visa_open_case(appt.application_id);
  select * into centre from public.visa_application_centres
   where id = coalesce(p_centre_id, appt.centre_id) and (is_active or id = appt.centre_id);
  if not found then
    raise exception 'choose an active application centre';
  end if;

  perform set_config('sts.visa_rpc', app.id::text, true);
  update public.visa_appointments
     set status = 'rescheduled', status_reason = v_reason, status_changed_at = now()
   where id = appt.id;
  perform set_config('sts.visa_rpc', '', true);

  insert into public.visa_appointments (
    application_id, member_id, centre_id, appointment_type, scheduled_at,
    confirmation_number, biometrics_required, supersedes_id
  ) values (
    app.id, appt.member_id, centre.id, appt.appointment_type, p_scheduled_at,
    coalesce(nullif(btrim(coalesce(p_confirmation, '')), ''), appt.confirmation_number),
    appt.biometrics_required, appt.id
  )
  returning id into v_id;

  v_label := public._visa_appointment_label(appt.appointment_type);
  perform public._visa_log_event(
    app.id, 'appointment.rescheduled',
    v_label || ' moved to ' || public._visa_appointment_when(p_scheduled_at, centre.id) || ': ' || v_reason,
    v_label || ' rescheduled: ' || centre.name || ', ' || centre.city || ' — '
      || public._visa_appointment_when(p_scheduled_at, centre.id) || '.',
    true, false, 'visa.appointments.manage',
    v_reason, null, null, jsonb_build_object('appointmentId', v_id, 'supersedes', appt.id), appt.member_id
  );

  return v_id;
end;
$$;

create or replace function public.visa_cancel_appointment(p_appointment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  appt public.visa_appointments;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_label text;
begin
  perform public._visa_require('visa.appointments.manage');
  select * into appt from public.visa_appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'appointment not found';
  end if;
  if appt.status <> 'booked' then
    raise exception 'only a booked appointment can be cancelled';
  end if;
  if v_reason is null then
    raise exception 'enter a reason for cancelling';
  end if;

  perform set_config('sts.visa_rpc', appt.application_id::text, true);
  update public.visa_appointments
     set status = 'cancelled', status_reason = v_reason, status_changed_at = now()
   where id = appt.id;
  perform set_config('sts.visa_rpc', '', true);

  v_label := public._visa_appointment_label(appt.appointment_type);
  perform public._visa_log_event(
    appt.application_id, 'appointment.cancelled', v_label || ' cancelled: ' || v_reason,
    v_label || ' on ' || public._visa_appointment_when(appt.scheduled_at, appt.centre_id) || ' was cancelled.',
    true, false, 'visa.appointments.manage',
    v_reason, null, null, jsonb_build_object('appointmentId', appt.id), appt.member_id
  );
end;
$$;

create or replace function public.visa_record_appointment_outcome(
  p_appointment_id uuid,
  p_outcome text,
  p_biometrics_completed boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  appt public.visa_appointments;
  v_label text;
begin
  perform public._visa_require('visa.appointments.manage');
  if p_outcome not in ('attended', 'no_show') then
    raise exception 'invalid appointment outcome';
  end if;
  select * into appt from public.visa_appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'appointment not found';
  end if;
  if appt.status <> 'booked' then
    raise exception 'this appointment is already %', appt.status;
  end if;
  if appt.scheduled_at > now() + interval '12 hours' then
    raise exception 'this appointment has not happened yet';
  end if;

  perform set_config('sts.visa_rpc', appt.application_id::text, true);
  update public.visa_appointments
     set status = p_outcome,
         biometrics_completed = (p_outcome = 'attended' and coalesce(p_biometrics_completed, false)),
         status_changed_at = now()
   where id = appt.id;
  perform set_config('sts.visa_rpc', '', true);

  v_label := public._visa_appointment_label(appt.appointment_type);
  if p_outcome = 'attended' then
    perform public._visa_log_event(
      appt.application_id, 'appointment.attended',
      v_label || ' attended' || case when p_biometrics_completed then ' — biometrics taken' else '' end,
      v_label || ' completed' || case when p_biometrics_completed then ', biometrics taken' else '' end || '.',
      false, false, 'visa.appointments.manage',
      null, null, null, jsonb_build_object('appointmentId', appt.id, 'biometrics', coalesce(p_biometrics_completed, false)),
      appt.member_id
    );
  else
    perform public._visa_log_event(
      appt.application_id, 'appointment.no_show', v_label || ' missed',
      v_label || ' on ' || public._visa_appointment_when(appt.scheduled_at, appt.centre_id)
        || ' was missed. STS will contact you to rebook.',
      true, true, 'visa.appointments.manage',
      null, null, null, jsonb_build_object('appointmentId', appt.id), appt.member_id
    );
  end if;
end;
$$;

revoke execute on function public.visa_book_appointment(uuid, uuid, text, timestamptz, text, boolean, uuid) from public, anon;
revoke execute on function public.visa_reschedule_appointment(uuid, timestamptz, text, text, uuid) from public, anon;
revoke execute on function public.visa_cancel_appointment(uuid, text) from public, anon;
revoke execute on function public.visa_record_appointment_outcome(uuid, text, boolean) from public, anon;
grant execute on function public.visa_book_appointment(uuid, uuid, text, timestamptz, text, boolean, uuid) to authenticated;
grant execute on function public.visa_reschedule_appointment(uuid, timestamptz, text, text, uuid) to authenticated;
grant execute on function public.visa_cancel_appointment(uuid, text) to authenticated;
grant execute on function public.visa_record_appointment_outcome(uuid, text, boolean) to authenticated;
