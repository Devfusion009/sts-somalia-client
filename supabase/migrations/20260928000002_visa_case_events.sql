-- Visa case management, milestone 1 of 5: the immutable case timeline.
--
-- visa_case_events is both the case timeline (what the customer and staff see
-- happened, in order) and the privileged-action audit trail. Rows are written
-- only by _visa_log_event() and can never be updated or deleted by anyone,
-- including the service role. Notifications are fanned out from events, so
-- each RPC decides which single event is the one a customer hears about.
--
-- The stage transition body moves into _visa_set_stage(). The old
-- apply_visa_status_transition_internal() keeps its exact signature as a thin
-- wrapper because _apply_order_cancellation, replace_rejected_visa_document
-- and apply_visa_partner_status_update all call it.
--
-- visa_application_status_history becomes append-only too: the transition
-- note is now written at insert time (passed through a transaction-local
-- setting) instead of patched onto the row afterwards.

create table public.visa_case_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.visa_applications (id) on delete restrict,
  member_id uuid,
  event_type text not null,
  from_stage public.visa_status,
  to_stage public.visa_status,
  summary text not null,
  customer_summary text,
  customer_visible boolean not null default false,
  notify_customer boolean not null default false,
  notify_staff boolean not null default false,
  actor_id uuid,
  actor_kind text not null check (actor_kind in ('customer', 'agent', 'staff', 'system', 'partner')),
  actor_name text,
  actor_permission text,
  reason text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  constraint visa_case_events_visibility check (customer_visible = (customer_summary is not null)),
  constraint visa_case_events_no_sensitive_data
    check (not (data ?| array['passport_number', 'traveler_details', 'storage_path']))
);

create index visa_case_events_application_idx on public.visa_case_events (application_id, created_at desc);
create index visa_case_events_type_idx on public.visa_case_events (event_type);

create or replace function public.guard_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = 'insufficient_privilege';
end;
$$;

create trigger visa_case_events_immutable
  before update or delete on public.visa_case_events
  for each row execute function public.guard_append_only();

create trigger visa_case_events_no_truncate
  before truncate on public.visa_case_events
  for each statement execute function public.guard_append_only();

revoke insert, update, delete, truncate on public.visa_case_events from anon, authenticated;

alter table public.visa_case_events enable row level security;

create policy "visa_case_events: staff read"
  on public.visa_case_events for select
  using ((select public.visa_staff_can('visa.applications.read')));

create policy "visa_case_events: customer reads visible"
  on public.visa_case_events for select
  using (
    customer_visible
    and exists (
      select 1 from public.visa_applications a
       where a.id = visa_case_events.application_id
         and (
           a.submitted_by = auth.uid()
           or a.applicant_profile_id = auth.uid()
           or (a.agency_id is not null and public.is_agency_member(a.agency_id))
         )
    )
  );

-- ----------------------------------------------------------------------------
-- Writer
-- ----------------------------------------------------------------------------
create or replace function public._visa_log_event(
  p_application_id uuid,
  p_type text,
  p_summary text,
  p_customer_summary text default null,
  p_notify_customer boolean default false,
  p_notify_staff boolean default false,
  p_permission text default null,
  p_reason text default null,
  p_from public.visa_status default null,
  p_to public.visa_status default null,
  p_data jsonb default '{}'::jsonb,
  p_member uuid default null,
  p_actor_kind text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_kind text := p_actor_kind;
  v_name text;
  v_agency uuid;
  v_id uuid;
begin
  if v_kind is null then
    if v_actor is null then
      v_kind := 'system';
    elsif public.is_admin() then
      v_kind := 'staff';
    else
      select agency_id into v_agency from public.visa_applications where id = p_application_id;
      v_kind := case when v_agency is not null and public.is_agency_member(v_agency) then 'agent' else 'customer' end;
    end if;
  end if;

  if v_actor is not null then
    select full_name into v_name from public.profiles where id = v_actor;
  end if;

  insert into public.visa_case_events (
    application_id, member_id, event_type, from_stage, to_stage, summary,
    customer_summary, customer_visible, notify_customer, notify_staff,
    actor_id, actor_kind, actor_name, actor_permission, reason, data
  ) values (
    p_application_id, p_member, p_type, p_from, p_to, p_summary,
    nullif(btrim(coalesce(p_customer_summary, '')), ''),
    nullif(btrim(coalesce(p_customer_summary, '')), '') is not null,
    p_notify_customer and nullif(btrim(coalesce(p_customer_summary, '')), '') is not null,
    p_notify_staff,
    v_actor, v_kind, v_name, p_permission, nullif(btrim(coalesce(p_reason, '')), ''),
    coalesce(p_data, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public._visa_log_event(
  uuid, text, text, text, boolean, boolean, text, text, public.visa_status, public.visa_status, jsonb, uuid, text
) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Notification fan-out
-- ----------------------------------------------------------------------------
create or replace function public.visa_case_events_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
  v_title text;
  v_data jsonb;
  v_assignee uuid;
begin
  if not new.notify_customer and not new.notify_staff then
    return new;
  end if;

  select * into app from public.visa_applications where id = new.application_id;

  v_data := jsonb_build_object(
    'applicationId', app.id,
    'applicationRef', app.application_ref,
    'status', app.status::text,
    'agencyId', app.agency_id,
    'event', new.event_type
  );

  v_title := case
    when new.event_type = 'application.submitted' then 'Visa application submitted'
    when new.event_type like 'document.%' or new.event_type like 'request.%' then 'Documents needed'
    when new.event_type like 'appointment.%' then 'Visa appointment update'
    when new.event_type like 'decision.%' then 'Visa decision'
    when new.event_type like 'passport.%' then 'Passport update'
    when new.event_type like 'message.%' then 'New message from STS'
    else case new.to_stage
      when 'submitted' then 'Visa application submitted'
      when 'in_review' then 'Visa application under review'
      when 'additional_info_required' then 'Documents needed'
      when 'ready_for_processing' then 'Ready for submission'
      when 'processing' then 'Visa processing started'
      when 'approved' then 'Visa approved'
      when 'rejected' then 'Visa refused'
      when 'issued' then 'Visa issued'
      when 'cancelled' then 'Visa application cancelled'
      else 'Visa application update'
    end
  end;

  if new.notify_customer then
    insert into public.notifications (profile_id, type, title, body, data)
    select distinct r.profile_id, 'visa_status_changed', v_title, new.customer_summary, v_data
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
  end if;

  if new.notify_staff then
    if to_regclass('public.visa_case_ops') is not null then
      execute 'select assigned_to from public.visa_case_ops where application_id = $1'
        into v_assignee using app.id;
    end if;

    insert into public.notifications (profile_id, type, title, body, data)
    select p.id,
           case when new.event_type = 'application.submitted' then 'visa_application_submitted' else 'visa_case_attention' end,
           case when new.event_type = 'application.submitted' then 'New visa application'
                else app.application_ref || ' needs attention' end,
           new.summary,
           v_data
      from public.profiles p
     where p.is_platform_admin
       and (v_assignee is null or p.id = v_assignee)
       and p.id is distinct from new.actor_id;
  end if;

  return new;
end;
$$;

revoke execute on function public.visa_case_events_notify() from public, anon, authenticated;

create trigger visa_case_events_notify
  after insert on public.visa_case_events
  for each row execute function public.visa_case_events_notify();

-- ----------------------------------------------------------------------------
-- Stage transitions
-- ----------------------------------------------------------------------------
create or replace function public.visa_stage_label(p_status public.visa_status)
returns text
language sql
immutable
as $$
  select case p_status
    when 'draft' then 'Draft'
    when 'submitted' then 'Submitted'
    when 'in_review' then 'Document review'
    when 'additional_info_required' then 'Action required'
    when 'ready_for_processing' then 'Ready for submission'
    when 'processing' then 'Submitted / processing'
    when 'approved' then 'Approved'
    when 'rejected' then 'Refused'
    when 'issued' then 'Visa issued'
    when 'cancelled' then 'Cancelled'
  end;
$$;

create or replace function public._visa_set_stage(
  p_application_id uuid,
  p_to public.visa_status,
  p_note text default null,
  p_permission text default null,
  p_customer_summary text default null,
  p_notify boolean default true,
  p_bypass_map boolean default false
)
returns public.visa_status
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_visa_name text;
  v_body text;
begin
  select * into app from public.visa_applications where id = p_application_id for update;
  if not found then
    raise exception 'visa application not found';
  end if;

  if app.status = p_to then
    return app.status;
  end if;

  if not p_bypass_map and not (
    case app.status
      when 'draft' then p_to in ('submitted')
      when 'submitted' then p_to in ('in_review', 'additional_info_required', 'cancelled')
      when 'in_review' then p_to in ('additional_info_required', 'ready_for_processing', 'rejected', 'cancelled')
      when 'additional_info_required' then p_to in ('in_review', 'cancelled')
      when 'ready_for_processing' then p_to in ('additional_info_required', 'processing', 'cancelled')
      when 'processing' then p_to in ('additional_info_required', 'approved', 'rejected', 'cancelled')
      when 'approved' then p_to in ('issued')
      else false
    end
  ) then
    raise exception 'a visa application cannot move from % to %', app.status, p_to;
  end if;

  perform set_config('sts.visa_transition', p_application_id::text, true);
  perform set_config('sts.visa_rpc', p_application_id::text, true);
  perform set_config('sts.visa_transition_note', coalesce(v_note, ''), true);

  update public.visa_applications
     set status = p_to,
         decided_by = case when p_to in ('approved', 'rejected', 'issued')
                           then coalesce(auth.uid(), decided_by) else decided_by end,
         decided_at = case when p_to in ('approved', 'rejected', 'issued')
                           then now() else decided_at end,
         updated_at = now()
   where id = p_application_id;

  perform set_config('sts.visa_transition', '', true);
  perform set_config('sts.visa_rpc', '', true);
  perform set_config('sts.visa_transition_note', '', true);

  select name into v_visa_name from public.visa_types where id = app.visa_type_id;

  v_body := coalesce(
    nullif(btrim(coalesce(p_customer_summary, '')), ''),
    case p_to
      when 'submitted' then coalesce(v_visa_name, 'Visa') || ' — ' || app.application_ref || ' was submitted.'
      when 'in_review' then 'STS is reviewing ' || app.application_ref || '.'
      when 'additional_info_required' then 'More documents are needed for ' || app.application_ref || '.'
      when 'ready_for_processing' then app.application_ref || ' is ready for submission.'
      when 'processing' then app.application_ref || ' is with the visa authority.'
      when 'approved' then app.application_ref || ' was approved.'
      when 'rejected' then app.application_ref || ' was refused.'
      when 'issued' then 'The visa for ' || app.application_ref || ' is ready.'
      when 'cancelled' then app.application_ref || ' was cancelled.'
      else app.application_ref || ' was updated.'
    end || case when v_note is not null then ' ' || v_note else '' end
  );

  perform public._visa_log_event(
    p_application_id,
    'stage.changed',
    public.visa_stage_label(app.status) || ' → ' || public.visa_stage_label(p_to)
      || case when v_note is not null then ': ' || v_note else '' end,
    v_body,
    p_notify,
    false,
    p_permission,
    v_note,
    app.status,
    p_to
  );

  return p_to;
end;
$$;

revoke execute on function public._visa_set_stage(
  uuid, public.visa_status, text, text, text, boolean, boolean
) from public, anon, authenticated;

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
begin
  return public._visa_set_stage(p_application_id, p_status, p_note, null, null, true, false);
end;
$$;

revoke execute on function public.apply_visa_status_transition_internal(uuid, public.visa_status, uuid, text)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Status history: note at insert time, append-only afterwards.
-- ----------------------------------------------------------------------------
create or replace function public.log_visa_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.visa_application_status_history (application_id, status, changed_by, note)
    values (
      new.id,
      new.status,
      auth.uid(),
      nullif(current_setting('sts.visa_transition_note', true), '')
    );
  end if;
  return new;
end;
$$;

-- History rows go away only with their application (draft cleanup cascade).
create or replace function public.guard_visa_status_history_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE'
     and not exists (select 1 from public.visa_applications where id = old.application_id) then
    return old;
  end if;
  raise exception 'visa_application_status_history is append-only' using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists visa_status_history_immutable on public.visa_application_status_history;
create trigger visa_status_history_immutable
  before update or delete on public.visa_application_status_history
  for each row execute function public.guard_visa_status_history_immutable();

revoke update, delete, truncate on public.visa_application_status_history from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Backfill: one stage event per existing history row of every non-draft case.
-- ----------------------------------------------------------------------------
insert into public.visa_case_events (
  application_id, event_type, to_stage, summary, customer_summary, customer_visible,
  actor_id, actor_kind, actor_name, reason, data, created_at
)
select h.application_id,
       'stage.changed',
       h.status,
       'Stage set to ' || public.visa_stage_label(h.status)
         || case when nullif(btrim(coalesce(h.note, '')), '') is not null then ': ' || h.note else '' end,
       a.application_ref || ' — ' || public.visa_stage_label(h.status) || '.'
         || case when nullif(btrim(coalesce(h.note, '')), '') is not null then ' ' || h.note else '' end,
       true,
       h.changed_by,
       case when h.changed_by is null then 'system'
            when p.is_platform_admin then 'staff'
            else 'customer' end,
       p.full_name,
       nullif(btrim(coalesce(h.note, '')), ''),
       jsonb_build_object('backfilled', true),
       h.created_at
  from public.visa_application_status_history h
  join public.visa_applications a on a.id = h.application_id
  left join public.profiles p on p.id = h.changed_by
 where a.status <> 'draft'
   and h.status <> 'draft'
 order by h.created_at;
