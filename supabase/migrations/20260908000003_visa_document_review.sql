-- Per-document review for visa applications.
--
-- Until now a visa document was either present or absent. `verified` was a bare
-- boolean written in exactly one place (the result-PDF upload) and read nowhere,
-- so an admin who received a blurry passport scan had no way to say so: the only
-- tool was visa_document_requests, which asks for an *additional* named document.
-- That is why "your passport photo is unreadable" is currently a WhatsApp
-- message. This gives a document a review state, a reason when it is rejected,
-- and a route back to the applicant.

alter table public.visa_documents
  add column review_status text not null default 'pending'
    check (review_status in ('pending', 'accepted', 'rejected')),
  add column rejection_reason text,
  add column reviewed_by uuid references public.profiles (id),
  add column reviewed_at timestamptz;

-- Result PDFs are staff-uploaded and were the only rows ever marked verified.
update public.visa_documents
   set review_status = 'accepted', reviewed_at = created_at
 where verified;

-- One source of truth: nothing reads `verified`, and review_status now says
-- everything it said.
alter table public.visa_documents drop column verified;

-- A rejection the applicant cannot act on is worse than no rejection.
alter table public.visa_documents
  add constraint visa_documents_rejection_needs_reason
  check (review_status <> 'rejected' or nullif(btrim(coalesce(rejection_reason, '')), '') is not null);

comment on column public.visa_documents.review_status is
  'pending until STS reviews it; rejected requires rejection_reason and blocks ready_for_processing.';

-- ----------------------------------------------------------------------------
-- What is still standing between this application and being lodged.
-- Returns null when nothing is; otherwise a line fit to show staff.
-- ----------------------------------------------------------------------------
create or replace function public.visa_application_outstanding_items(p_application_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
  v_missing text;
  v_rejected integer;
  v_requests integer;
begin
  select * into app from public.visa_applications where id = p_application_id;
  if not found then
    return 'application not found';
  end if;

  -- A required slot counts as filled only by a document that has not been
  -- rejected — a rejected upload leaves the slot as empty as it started.
  select string_agg(coalesce(nullif(btrim(slot->>'label'), ''), slot->>'key'), ', ')
    into v_missing
  from public.visa_types vt
  cross join lateral jsonb_array_elements(coalesce(vt.required_documents, '[]'::jsonb)) as slot
  where vt.id = app.visa_type_id
    and coalesce((slot->>'required')::boolean, false)
    and not exists (
      select 1
        from public.visa_documents d
       where d.application_id = p_application_id
         and d.document_type = slot->>'key'
         and d.review_status <> 'rejected'
    );
  if v_missing is not null then
    return 'missing documents: ' || v_missing;
  end if;

  select count(*) into v_rejected
    from public.visa_documents
   where application_id = p_application_id
     and review_status = 'rejected';
  if v_rejected > 0 then
    return v_rejected || ' rejected document(s) awaiting replacement';
  end if;

  select count(*) into v_requests
    from public.visa_document_requests
   where application_id = p_application_id
     and requirement = 'required'
     and status in ('requested', 'uploaded');
  if v_requests > 0 then
    return v_requests || ' outstanding document request(s)';
  end if;

  return null;
end;
$$;

-- ----------------------------------------------------------------------------
-- Clearing an application for processing is a claim that its paperwork is
-- complete. Enforced as a trigger rather than inside the transition function so
-- it holds for every caller, including the partner routes added in M4.
-- ----------------------------------------------------------------------------
create or replace function public.guard_visa_ready_for_processing()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_outstanding text;
begin
  if new.status = 'ready_for_processing' and old.status is distinct from new.status then
    v_outstanding := public.visa_application_outstanding_items(new.id);
    if v_outstanding is not null then
      raise exception 'cannot clear % for processing — %', new.application_ref, v_outstanding;
    end if;
  end if;
  return new;
end;
$$;

create trigger visa_applications_guard_ready_for_processing
  before update of status on public.visa_applications
  for each row execute function public.guard_visa_ready_for_processing();

-- ----------------------------------------------------------------------------
-- The applicant's half of the loop: replace a rejected document.
--
-- SECURITY DEFINER because visa_documents has no update policy for the
-- submitter, and widening RLS to allow one would also allow an applicant to
-- edit review fields on their own documents. The file itself is uploaded to the
-- visa-documents bucket by the caller first (storage policy already scopes that
-- to the application's owner); this swaps the row over and, when nothing is
-- outstanding any more, hands the application back to STS.
-- ----------------------------------------------------------------------------
create or replace function public.replace_rejected_visa_document(
  p_document_id uuid,
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
  doc public.visa_documents;
  app public.visa_applications;
begin
  select * into doc from public.visa_documents where id = p_document_id;
  if not found then
    raise exception 'document not found';
  end if;

  select * into app from public.visa_applications where id = doc.application_id;

  if not public.is_admin() and app.submitted_by is distinct from auth.uid()
     and app.applicant_profile_id is distinct from auth.uid() then
    raise exception 'not authorized to replace this document';
  end if;

  if doc.review_status <> 'rejected' then
    raise exception 'only a rejected document can be replaced';
  end if;

  update public.visa_documents
     set storage_path = p_storage_path,
         file_name = coalesce(p_file_name, file_name),
         file_size = coalesce(p_file_size, file_size),
         content_type = coalesce(p_content_type, content_type),
         review_status = 'pending',
         rejection_reason = null,
         reviewed_by = null,
         reviewed_at = null,
         uploaded_by = coalesce(auth.uid(), uploaded_by)
   where id = p_document_id;

  -- Nothing left outstanding means it is STS's turn again.
  if app.status = 'additional_info_required'
     and public.visa_application_outstanding_items(app.id) is null then
    perform public.apply_visa_status_transition_internal(app.id, 'in_review', auth.uid());
  end if;

  return p_document_id;
end;
$$;
