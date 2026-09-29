-- Visa case management, milestone 2 of 5: document lifecycle.
--
-- A document row is never rewritten. Replacing a rejected file inserts a new
-- version that supersedes the old one; the old row keeps its file and its
-- rejection reason. Review fields change only inside the review RPCs (next
-- migration), never through a direct table write — including by staff.
--
-- Internal processing notes become staff-only and append-only.

alter table public.visa_documents
  add column if not exists version integer not null default 1 check (version >= 1),
  add column if not exists supersedes_id uuid references public.visa_documents (id),
  add column if not exists is_current boolean not null default true,
  add column if not exists member_id uuid references public.visa_members (id) on delete cascade,
  add column if not exists request_id uuid references public.visa_document_requests (id),
  add column if not exists expires_at date;

update public.visa_documents d
   set request_id = r.id
  from public.visa_document_requests r
 where r.document_id = d.id
   and d.request_id is null;

-- Only the newest row per slot stays current (none are duplicated today, but
-- the index below must not fail on data written before this migration).
update public.visa_documents d
   set is_current = false
 where exists (
   select 1 from public.visa_documents n
    where n.application_id = d.application_id
      and n.document_type = d.document_type
      and n.member_id is not distinct from d.member_id
      and n.request_id is not distinct from d.request_id
      and n.created_at > d.created_at
 );

create unique index if not exists visa_documents_one_current_per_slot
  on public.visa_documents (
    application_id,
    document_type,
    coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(request_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where is_current;

alter table public.visa_document_requests
  add column if not exists due_date date,
  add column if not exists resolved_by uuid references public.profiles (id),
  add column if not exists resolved_at timestamptz;

-- ----------------------------------------------------------------------------
-- Integrity: file fields are immutable; review fields only via the review
-- RPCs (sts.visa_rpc) or a non-request session (service role, migrations);
-- rows are deleted only while the application is a draft.
-- ----------------------------------------------------------------------------
create or replace function public.guard_visa_documents_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.visa_status;
  v_trusted boolean;
begin
  v_trusted := coalesce(current_setting('role', true), 'none') not in ('authenticated', 'anon')
            or coalesce(current_setting('sts.visa_rpc', true), '') = old.application_id::text;

  if tg_op = 'DELETE' then
    select status into v_status from public.visa_applications where id = old.application_id;
    if not found or v_status = 'draft' then
      return old;
    end if;
    raise exception 'documents on a submitted application cannot be deleted';
  end if;

  if new.storage_path is distinct from old.storage_path
     or new.file_name is distinct from old.file_name
     or new.file_size is distinct from old.file_size
     or new.content_type is distinct from old.content_type
     or new.uploaded_by is distinct from old.uploaded_by
     or new.application_id is distinct from old.application_id
     or new.document_type is distinct from old.document_type
     or new.version is distinct from old.version
     or new.supersedes_id is distinct from old.supersedes_id
     or new.member_id is distinct from old.member_id
     or new.request_id is distinct from old.request_id
     or new.created_at is distinct from old.created_at then
    raise exception 'an uploaded document cannot be changed — upload a new version';
  end if;

  if not v_trusted and (
       new.review_status is distinct from old.review_status
       or new.rejection_reason is distinct from old.rejection_reason
       or new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at
       or new.is_current is distinct from old.is_current
       or new.expires_at is distinct from old.expires_at
     ) then
    raise exception 'document review changes go through visa_review_document()';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_visa_documents_integrity() from public, anon, authenticated;

drop trigger if exists visa_documents_integrity on public.visa_documents;
create trigger visa_documents_integrity
  before update or delete on public.visa_documents
  for each row execute function public.guard_visa_documents_integrity();

drop policy if exists "visa_documents: admin manage" on public.visa_documents;
create policy "visa_documents: staff read"
  on public.visa_documents for select
  using ((select public.visa_staff_can('visa.applications.read')));

drop policy if exists "visa_document_requests: admin manage" on public.visa_document_requests;
create policy "visa_document_requests: staff read"
  on public.visa_document_requests for select
  using ((select public.visa_staff_can('visa.applications.read')));

revoke insert, update, delete on public.visa_document_requests from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Labels for events and blockers
-- ----------------------------------------------------------------------------
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

revoke execute on function public._visa_document_label(uuid, text) from public, anon, authenticated;

-- What the applicant still owes: missing required files, rejected files, and
-- required requests they have not answered. Resuming a case needs this clear.
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
        and d.document_type = rs.slot_key
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

revoke execute on function public._visa_customer_blockers(uuid) from public, anon, authenticated;

-- Everything that stops a case being ready for submission: the customer's
-- blockers plus anything STS itself has not reviewed yet.
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
     and document_type <> 'visa_result';
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

revoke execute on function public.visa_application_outstanding_items(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Internal notes: staff-only, append-only.
-- ----------------------------------------------------------------------------
alter table public.visa_processing_notes alter column created_by set default auth.uid();

drop policy if exists "visa_processing_notes: admin manage" on public.visa_processing_notes;
create policy "visa_processing_notes: staff read"
  on public.visa_processing_notes for select
  using ((select public.visa_staff_can('visa.notes.read')));
create policy "visa_processing_notes: staff write"
  on public.visa_processing_notes for insert
  with check (
    (select public.visa_staff_can('visa.notes.write'))
    and created_by = auth.uid()
  );

create or replace function public.guard_visa_child_append_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE'
     and not exists (select 1 from public.visa_applications where id = old.application_id) then
    return old;
  end if;
  raise exception '% is append-only', tg_table_name using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists visa_processing_notes_append_only on public.visa_processing_notes;
create trigger visa_processing_notes_append_only
  before update or delete on public.visa_processing_notes
  for each row execute function public.guard_visa_child_append_only();

revoke update, delete, truncate on public.visa_processing_notes from anon, authenticated;
