-- Visa case management, milestone 3 of 5: official decisions.
--
-- A decision is the authority's, not STS's: it needs the authority and either
-- its reference or the decision letter. It is recorded once and never edited;
-- a mistake is corrected by a new row that supersedes the original, with a
-- mandatory reason and its own permission. The case stage can only become
-- approved / refused when a matching current decision exists, so no generic
-- status change can fake one — the generic set_visa_application_status() RPC
-- is removed here.
--
-- Stage map changes: in_review can no longer go to "rejected" (STS declining
-- before lodgement is a cancellation with a reason), and a centre returning a
-- case sends processing back to ready_for_processing.

-- ----------------------------------------------------------------------------
-- Staff-uploaded case files (decision letter, submission receipt, passport
-- collection authorisation) — versioned like every other document.
-- ----------------------------------------------------------------------------
create or replace function public.visa_attach_staff_document(
  p_application_id uuid,
  p_document_type text,
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
  app public.visa_applications;
  prev public.visa_documents;
  v_id uuid;
begin
  if p_document_type not in ('decision_letter', 'submission_receipt', 'passport_authorization') then
    raise exception 'invalid document type';
  end if;
  perform public._visa_require(case p_document_type
    when 'decision_letter' then 'visa.decision.record'
    when 'submission_receipt' then 'visa.submission.record'
    else 'visa.passport.manage' end);

  select * into app from public.visa_applications where id = p_application_id for update;
  if not found or app.status = 'draft' then
    raise exception 'visa application not found';
  end if;
  perform public._visa_assert_uploaded(app, p_storage_path);

  select * into prev from public.visa_documents
   where application_id = app.id and document_type = p_document_type and is_current;
  if prev.id is not null then
    perform set_config('sts.visa_rpc', app.id::text, true);
    update public.visa_documents set is_current = false where id = prev.id;
    perform set_config('sts.visa_rpc', '', true);
  end if;

  insert into public.visa_documents (
    application_id, document_type, storage_path, uploaded_by, file_name, file_size, content_type,
    review_status, reviewed_by, reviewed_at, version, supersedes_id
  ) values (
    app.id, p_document_type, p_storage_path, auth.uid(), p_file_name, p_file_size, p_content_type,
    'accepted', auth.uid(), now(), coalesce(prev.version, 0) + 1, prev.id
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.visa_attach_staff_document(uuid, text, text, text, integer, text) from public, anon;
grant execute on function public.visa_attach_staff_document(uuid, text, text, text, integer, text) to authenticated;

create or replace function public._visa_document_label(p_application_id uuid, p_document_type text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    case
      when p_document_type = 'visa_result' then 'Visa document'
      when p_document_type = 'decision_letter' then 'Decision letter'
      when p_document_type = 'submission_receipt' then 'Submission receipt'
      when p_document_type = 'passport_authorization' then 'Collection authorisation'
      when p_document_type like 'request:%' then substr(p_document_type, 9)
    end,
    (
      select coalesce(nullif(btrim(s->>'label'), ''), s->>'key', s #>> '{}')
        from public.visa_applications a
        join public.visa_types vt on vt.id = a.visa_type_id
       cross join lateral jsonb_array_elements(coalesce(a.resolved_documents, vt.required_documents, '[]'::jsonb)) s
       where a.id = p_application_id
         and coalesce(s->>'key', s #>> '{}') = p_document_type
       limit 1
    ),
    replace(p_document_type, '_', ' ')
  );
$$;

-- Staff files never wait on review.
create or replace function public.visa_application_outstanding_items(p_application_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_blocker text;
  v_pending integer;
  v_open integer;
begin
  if not exists (select 1 from public.visa_applications where id = p_application_id) then
    return 'application not found';
  end if;

  v_blocker := public._visa_customer_blockers(p_application_id);
  if v_blocker is not null then
    return v_blocker;
  end if;

  select count(*) into v_pending
    from public.visa_documents
   where application_id = p_application_id
     and is_current
     and review_status = 'pending'
     and document_type not in ('visa_result', 'decision_letter', 'submission_receipt', 'passport_authorization');
  if v_pending > 0 then
    return v_pending || ' document(s) awaiting review';
  end if;

  select count(*) into v_open
    from public.visa_document_requests
   where application_id = p_application_id
     and requirement = 'required'
     and status = 'uploaded';
  if v_open > 0 then
    return v_open || ' uploaded request(s) not yet resolved';
  end if;

  return null;
end;
$$;

-- ----------------------------------------------------------------------------
-- Decisions
-- ----------------------------------------------------------------------------
create table public.visa_decisions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.visa_applications (id) on delete cascade,
  outcome text not null check (outcome in ('approved', 'refused')),
  authority text not null check (btrim(authority) <> ''),
  authority_reference text,
  decision_date date not null,
  letter_document_id uuid references public.visa_documents (id),
  source text not null default 'staff' check (source in ('staff', 'partner', 'backfill')),
  notes text,
  recorded_by uuid default auth.uid() references public.profiles (id),
  recorded_at timestamptz not null default clock_timestamp(),
  supersedes_id uuid unique references public.visa_decisions (id),
  correction_reason text,
  constraint visa_decisions_needs_evidence
    check (nullif(btrim(coalesce(authority_reference, '')), '') is not null or letter_document_id is not null),
  constraint visa_decisions_correction_reason
    check (supersedes_id is null or length(btrim(coalesce(correction_reason, ''))) >= 10)
);

create unique index visa_decisions_one_chain_root on public.visa_decisions (application_id) where supersedes_id is null;
create index visa_decisions_application_idx on public.visa_decisions (application_id, recorded_at desc);

create trigger visa_decisions_append_only
  before update or delete on public.visa_decisions
  for each row execute function public.guard_visa_child_append_only();

alter table public.visa_decisions enable row level security;
create policy "visa_decisions: staff read"
  on public.visa_decisions for select
  using ((select public.visa_staff_can('visa.applications.read')));
create policy "visa_decisions: party read"
  on public.visa_decisions for select
  using (
    exists (
      select 1 from public.visa_applications a
       where a.id = visa_decisions.application_id
         and (a.submitted_by = auth.uid() or a.applicant_profile_id = auth.uid()
              or (a.agency_id is not null and public.is_agency_member(a.agency_id)))
    )
  );
revoke insert, update, delete, truncate on public.visa_decisions from anon, authenticated;

-- The decision nobody has superseded.
create or replace function public.visa_current_decision(p_application_id uuid)
returns public.visa_decisions
language sql
stable
security definer
set search_path = public
as $$
  select d.* from public.visa_decisions d
   where d.application_id = p_application_id
     and not exists (select 1 from public.visa_decisions n where n.supersedes_id = d.id)
   order by d.recorded_at desc
   limit 1;
$$;

revoke execute on function public.visa_current_decision(uuid) from public, anon, authenticated;

-- Approved / refused / issued stages must be backed by evidence.
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
    if not coalesce((new.workflow->>'requires_physical_passport')::boolean, false)
       and not exists (
         select 1 from public.visa_documents
          where application_id = new.id and document_type = 'visa_result' and is_current
       ) then
      raise exception 'attach the visa document before marking % issued', new.application_ref;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_visa_decision_stage() from public, anon, authenticated;

drop trigger if exists visa_applications_guard_decision on public.visa_applications;
create trigger visa_applications_guard_decision
  before update of status on public.visa_applications
  for each row execute function public.guard_visa_decision_stage();

-- Existing decided cases get a decision row so the guard's invariant holds.
insert into public.visa_decisions (
  application_id, outcome, authority, authority_reference, decision_date, source, recorded_by, notes
)
select a.id,
       case when a.status = 'rejected' then 'refused' else 'approved' end,
       'Recorded before decision tracking',
       coalesce(
         (select j.lodgement_reference from public.visa_processing_jobs j
           where j.application_id = a.id and j.lodgement_reference is not null
           order by j.created_at desc limit 1),
         a.partner_ref,
         a.application_ref
       ),
       coalesce(a.decided_at, a.updated_at)::date,
       'backfill',
       a.decided_by,
       a.admin_notes
  from public.visa_applications a
 where a.status in ('approved', 'rejected', 'issued')
   and not exists (select 1 from public.visa_decisions d where d.application_id = a.id);

-- ----------------------------------------------------------------------------
-- Stage map (final)
-- ----------------------------------------------------------------------------
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
      when 'in_review' then p_to in ('additional_info_required', 'ready_for_processing', 'cancelled')
      when 'additional_info_required' then p_to in ('in_review', 'processing', 'cancelled')
      when 'ready_for_processing' then p_to in ('additional_info_required', 'processing', 'cancelled')
      when 'processing' then p_to in ('additional_info_required', 'ready_for_processing', 'approved', 'rejected', 'cancelled')
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
         info_return_stage = case when p_to = 'additional_info_required' then info_return_stage else null end,
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

-- ----------------------------------------------------------------------------
-- Record / correct
-- ----------------------------------------------------------------------------
create or replace function public._visa_insert_decision(
  app public.visa_applications,
  p_outcome text,
  p_authority text,
  p_reference text,
  p_decision_date date,
  p_letter_document_id uuid,
  p_notes text,
  p_source text,
  p_supersedes uuid default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_outcome not in ('approved', 'refused') then
    raise exception 'invalid decision outcome';
  end if;
  if nullif(btrim(coalesce(p_authority, '')), '') is null then
    raise exception 'enter the issuing authority';
  end if;
  if nullif(btrim(coalesce(p_reference, '')), '') is null and p_letter_document_id is null then
    raise exception 'enter the authority''s reference or attach the decision letter';
  end if;
  if p_decision_date is null or p_decision_date > current_date then
    raise exception 'the decision date cannot be in the future';
  end if;
  if p_letter_document_id is not null
     and not exists (select 1 from public.visa_documents where id = p_letter_document_id and application_id = app.id) then
    raise exception 'decision letter not found on this application';
  end if;

  insert into public.visa_decisions (
    application_id, outcome, authority, authority_reference, decision_date, letter_document_id,
    source, notes, supersedes_id, correction_reason
  ) values (
    app.id, p_outcome, btrim(p_authority), nullif(btrim(coalesce(p_reference, '')), ''), p_decision_date,
    p_letter_document_id, p_source, nullif(btrim(coalesce(p_notes, '')), ''), p_supersedes,
    nullif(btrim(coalesce(p_reason, '')), '')
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public._visa_insert_decision(
  public.visa_applications, text, text, text, date, uuid, text, text, uuid, text
) from public, anon, authenticated;

create or replace function public.visa_record_decision(
  p_application_id uuid,
  p_outcome text,
  p_authority text,
  p_reference text default null,
  p_decision_date date default current_date,
  p_letter_document_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
  v_id uuid;
begin
  perform public._visa_require('visa.decision.record');
  app := public._visa_open_case(p_application_id);
  if app.status <> 'processing' then
    raise exception 'a decision is recorded once the application is with the authority';
  end if;

  v_id := public._visa_insert_decision(
    app, p_outcome, p_authority, p_reference, p_decision_date, p_letter_document_id, p_notes, 'staff'
  );

  perform public._visa_log_event(
    app.id, 'decision.recorded',
    initcap(p_outcome) || ' by ' || btrim(p_authority)
      || case when nullif(btrim(coalesce(p_reference, '')), '') is not null then ' (ref ' || btrim(p_reference) || ')' else '' end,
    null, false, false, 'visa.decision.record',
    null, null, null, jsonb_build_object('decisionId', v_id)
  );

  perform public._visa_set_stage(
    app.id,
    case when p_outcome = 'approved' then 'approved'::public.visa_status else 'rejected'::public.visa_status end,
    null, 'visa.decision.record',
    case when p_outcome = 'approved'
         then 'Good news — ' || app.application_ref || ' was approved by ' || btrim(p_authority) || '.'
         else app.application_ref || ' was refused by ' || btrim(p_authority) || '.' end,
    true
  );

  return v_id;
end;
$$;

create or replace function public.correct_visa_decision(
  p_decision_id uuid,
  p_outcome text,
  p_reason text,
  p_authority text default null,
  p_reference text default null,
  p_decision_date date default null,
  p_letter_document_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  prev public.visa_decisions;
  app public.visa_applications;
  cur public.visa_decisions;
  v_id uuid;
  v_to public.visa_status;
begin
  perform public._visa_require('visa.decision.correct');
  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'explain the correction (at least 10 characters)';
  end if;

  select * into prev from public.visa_decisions where id = p_decision_id;
  if not found then
    raise exception 'decision not found';
  end if;
  cur := public.visa_current_decision(prev.application_id);
  if cur.id is distinct from prev.id then
    raise exception 'this decision was already corrected — correct the latest one';
  end if;

  select * into app from public.visa_applications where id = prev.application_id for update;
  if app.status not in ('approved', 'rejected', 'issued') then
    raise exception 'only a decided application can be corrected';
  end if;

  v_id := public._visa_insert_decision(
    app, p_outcome,
    coalesce(p_authority, prev.authority),
    coalesce(p_reference, prev.authority_reference),
    coalesce(p_decision_date, prev.decision_date),
    coalesce(p_letter_document_id, prev.letter_document_id),
    null, 'staff', prev.id, p_reason
  );

  perform public._visa_log_event(
    app.id, 'decision.corrected',
    'Decision corrected: ' || prev.outcome || ' → ' || p_outcome || ' — ' || btrim(p_reason),
    case when prev.outcome <> p_outcome
         then 'The decision on ' || app.application_ref || ' was corrected: ' || p_outcome || '.' end,
    prev.outcome <> p_outcome, true, 'visa.decision.correct',
    p_reason, null, null, jsonb_build_object('decisionId', v_id, 'supersedes', prev.id)
  );

  if prev.outcome <> p_outcome then
    v_to := case when p_outcome = 'approved' then 'approved'::public.visa_status else 'rejected'::public.visa_status end;
    perform public._visa_set_stage(app.id, v_to, 'Decision corrected', 'visa.decision.correct', null, false, true);
  end if;

  return v_id;
end;
$$;

revoke execute on function public.visa_record_decision(uuid, text, text, text, date, uuid, text) from public, anon;
revoke execute on function public.correct_visa_decision(uuid, text, text, text, text, date, uuid) from public, anon;
grant execute on function public.visa_record_decision(uuid, text, text, text, date, uuid, text) to authenticated;
grant execute on function public.correct_visa_decision(uuid, text, text, text, text, date, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Issued visa file: attaching it to an approved e-visa issues the case.
-- ----------------------------------------------------------------------------
create or replace function public.visa_attach_result_document(
  p_application_id uuid,
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
  app public.visa_applications;
  prev public.visa_documents;
  v_id uuid;
begin
  perform public._visa_require('visa.decision.record');
  select * into app from public.visa_applications where id = p_application_id for update;
  if not found or app.status not in ('approved', 'issued') then
    raise exception 'the visa document can be attached once the application is approved';
  end if;
  perform public._visa_assert_uploaded(app, p_storage_path);

  select * into prev from public.visa_documents
   where application_id = app.id and document_type = 'visa_result' and is_current;
  if prev.id is not null then
    perform set_config('sts.visa_rpc', app.id::text, true);
    update public.visa_documents set is_current = false where id = prev.id;
    perform set_config('sts.visa_rpc', '', true);
  end if;

  insert into public.visa_documents (
    application_id, document_type, storage_path, uploaded_by, file_name, file_size, content_type,
    review_status, reviewed_by, reviewed_at, version, supersedes_id
  ) values (
    app.id, 'visa_result', p_storage_path, auth.uid(), p_file_name, p_file_size, p_content_type,
    'accepted', auth.uid(), now(), coalesce(prev.version, 0) + 1, prev.id
  )
  returning id into v_id;

  perform public._visa_log_event(
    app.id, 'document.result_attached',
    case when prev.id is null then 'Visa document attached' else 'Visa document replaced' end,
    'Your visa document is ready to download.', true, false, 'visa.decision.record',
    null, null, null, jsonb_build_object('documentId', v_id)
  );

  if app.status = 'approved' and not coalesce((app.workflow->>'requires_physical_passport')::boolean, false) then
    perform public._visa_set_stage(app.id, 'issued', null, 'visa.decision.record', null, false);
  end if;

  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Partner status → our stage. Approved / refused become partner-sourced
-- decisions, so the same evidence rule holds for automated updates.
-- ----------------------------------------------------------------------------
create or replace function public._visa_apply_partner_status(p_application_id uuid, p_status public.visa_status)
returns public.visa_status
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
begin
  select * into app from public.visa_applications where id = p_application_id for update;
  if not found then
    raise exception 'visa application not found';
  end if;
  if app.status = p_status then
    return app.status;
  end if;

  if p_status in ('approved', 'rejected') then
    if app.status <> 'processing' then
      raise exception 'a visa application cannot move from % to %', app.status, p_status;
    end if;
    perform public._visa_insert_decision(
      app, case when p_status = 'approved' then 'approved' else 'refused' end,
      coalesce(app.partner_provider_key, 'partner'),
      coalesce(app.partner_ref, app.application_ref),
      current_date, null, null, 'partner'
    );
    return public._visa_set_stage(app.id, p_status, null, null, null, true);
  end if;

  if p_status = 'additional_info_required' then
    perform public._visa_request_customer_action(app, 'Requested by processing partner', null);
    return 'additional_info_required';
  end if;

  if p_status = 'cancelled' then
    return public._visa_set_stage(app.id, 'cancelled', 'Cancelled by processing partner', null, null, true);
  end if;

  return public._visa_set_stage(app.id, p_status, null, null, null, true);
end;
$$;

revoke execute on function public._visa_apply_partner_status(uuid, public.visa_status) from public, anon, authenticated;

-- Webhook entry (service role only).
create or replace function public.apply_visa_partner_status_update(
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
  return public._visa_apply_partner_status(p_application_id, p_status);
end;
$$;

revoke execute on function public.apply_visa_partner_status_update(uuid, public.visa_status, text) from public, anon, authenticated;

-- Staff pull: record what the partner reports, then apply its mapped stage.
create or replace function public.visa_record_partner_status(
  p_application_id uuid,
  p_partner_status text,
  p_raw jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._visa_require('visa.submission.record');
  perform set_config('sts.visa_rpc', p_application_id::text, true);
  update public.visa_applications
     set partner_status = p_partner_status, partner_raw_payload = p_raw, partner_last_synced_at = now()
   where id = p_application_id;
  perform set_config('sts.visa_rpc', '', true);
  update public.visa_processing_jobs
     set partner_status = p_partner_status, partner_raw_payload = p_raw, partner_last_synced_at = now()
   where application_id = p_application_id and status = 'active' and route = 'partner';
end;
$$;

create or replace function public.visa_sync_partner_status(p_application_id uuid, p_status public.visa_status)
returns public.visa_status
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._visa_require('visa.submission.record');
  return public._visa_apply_partner_status(p_application_id, p_status);
end;
$$;

revoke execute on function public.visa_record_partner_status(uuid, text, jsonb) from public, anon;
revoke execute on function public.visa_sync_partner_status(uuid, public.visa_status) from public, anon;
grant execute on function public.visa_record_partner_status(uuid, text, jsonb) to authenticated;
grant execute on function public.visa_sync_partner_status(uuid, public.visa_status) to authenticated;

-- ----------------------------------------------------------------------------
-- The generic status picker is gone. Every stage change now has an owner.
-- ----------------------------------------------------------------------------
drop function if exists public.set_visa_application_status(uuid, public.visa_status, text);

create or replace function public.guard_visa_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('sts.visa_transition', true), '') <> new.id::text then
    raise exception 'visa application stage changes go through the case actions';
  end if;
  return new;
end;
$$;
