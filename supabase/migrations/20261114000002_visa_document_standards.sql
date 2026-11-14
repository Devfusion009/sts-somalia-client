-- Visa document standards: every reviewer checks the same points.
--
-- Each document slot maps to a fixed checklist by what the document is
-- (passport, photo, bank statement, ticket, accommodation, letter, other).
-- Accepting a document now requires every check passed; rejecting records
-- which checks failed, and the failed checks become the reason the
-- applicant sees. The results are kept on the document (review_checks).

alter table public.visa_documents add column review_checks jsonb;

comment on column public.visa_documents.review_checks is
  'Reviewer checklist result: {"<check key>": true|false}. Set only by visa_review_document().';

/** The standard checks for a document slot key. */
create or replace function public.visa_document_checklist(p_document_type text)
returns table (key text, label text)
language sql
immutable
set search_path = public
as $$
  with kind as (
    select case
      when p_document_type ~* 'passport' then 'passport'
      when p_document_type ~* 'photo|picture|selfie' then 'photo'
      when p_document_type ~* 'bank|statement|financ|salary|payslip|fund' then 'financial'
      when p_document_type ~* 'ticket|flight|itinerar' then 'travel'
      when p_document_type ~* 'hotel|accommodation|booking|reservation' then 'stay'
      when p_document_type ~* 'letter|invitation|sponsor|employ|noc|leave' then 'letter'
      else 'other'
    end as k
  )
  select c.key, c.label
    from kind, (values
      ('passport', 1, 'full_page', 'Full photo page visible, all four corners'),
      ('passport', 2, 'mrz', 'Machine-readable lines legible'),
      ('passport', 3, 'validity', 'Valid 6+ months after the return date'),
      ('passport', 4, 'blank_pages', 'At least two blank visa pages'),
      ('passport', 5, 'undamaged', 'No damage, alteration or missing pages'),
      ('photo', 1, 'background', 'Plain white or light background'),
      ('photo', 2, 'recent', 'Taken within the last 6 months'),
      ('photo', 3, 'face', 'Face centred and fully visible, eyes open, neutral expression'),
      ('photo', 4, 'quality', 'Sharp colour image, no shadows or glare'),
      ('financial', 1, 'recent', 'Issued within the last 3 months'),
      ('financial', 2, 'holder', 'Account holder is the applicant or the named sponsor'),
      ('financial', 3, 'verifiable', 'Bank stamp, letterhead or verifiable reference'),
      ('financial', 4, 'sufficient', 'Balance covers the stay'),
      ('travel', 1, 'dates', 'Dates match the application'),
      ('travel', 2, 'names', 'Passenger names match the passports'),
      ('travel', 3, 'reference', 'Booking reference shown'),
      ('stay', 1, 'dates', 'Dates cover the whole stay'),
      ('stay', 2, 'names', 'Guest names match the passports'),
      ('stay', 3, 'address', 'Property name and address shown'),
      ('letter', 1, 'signed', 'Signed and dated'),
      ('letter', 2, 'issuer', 'Issuer name, address and contact shown'),
      ('letter', 3, 'names', 'Names match the passports'),
      ('other', 1, 'relevant', 'Matches the requested document'),
      ('other', 2, 'names', 'Names match the passports'),
      ('any', 98, 'legible', 'Legible and complete, nothing cut off'),
      ('any', 99, 'authentic', 'No signs of editing or forgery')
    ) as c(kind, sort, key, label)
   where c.kind = kind.k or c.kind = 'any'
   order by c.sort;
$$;

grant execute on function public.visa_document_checklist(text) to authenticated;

-- review_checks joins the fields only the review RPC may write.
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
       or new.review_checks is distinct from old.review_checks
     ) then
    raise exception 'document review changes go through visa_review_document()';
  end if;

  return new;
end;
$$;

drop function if exists public.visa_review_document(uuid, text, text);

/**
 * Accept: every standard check for the slot must be passed.
 * Reject: at least one failed check or a written reason; the failed checks
 * are listed first in the reason the applicant sees.
 */
create or replace function public.visa_review_document(
  p_document_id uuid,
  p_decision text,
  p_reason text default null,
  p_checks jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  doc public.visa_documents;
  app public.visa_applications;
  v_note text := nullif(btrim(coalesce(p_reason, '')), '');
  v_reason text;
  v_label text;
  v_checks jsonb := '{}'::jsonb;
  v_failed text;
  v_missing text;
  c record;
begin
  perform public._visa_require('visa.documents.review');
  if p_decision not in ('accept', 'reject') then
    raise exception 'invalid review decision';
  end if;

  select * into doc from public.visa_documents where id = p_document_id for update;
  if not found then
    raise exception 'document not found';
  end if;
  if not doc.is_current then
    raise exception 'this document has been replaced — review the newer version';
  end if;
  if doc.document_type = 'visa_result' then
    raise exception 'the issued visa is not reviewed';
  end if;

  app := public._visa_open_case(doc.application_id);
  v_label := public._visa_document_label(app.id, doc.document_type);

  -- Normalise the submitted checklist against the slot's standard list.
  for c in select * from public.visa_document_checklist(doc.document_type) loop
    if p_checks ? c.key then
      v_checks := v_checks || jsonb_build_object(c.key, (p_checks ->> c.key)::boolean);
      if (p_checks ->> c.key)::boolean is false then
        v_failed := coalesce(v_failed || '; ', '') || c.label;
      end if;
    else
      v_missing := coalesce(v_missing || '; ', '') || c.label;
    end if;
  end loop;

  perform set_config('sts.visa_rpc', app.id::text, true);

  if p_decision = 'accept' then
    if doc.review_status <> 'pending' then
      raise exception 'only a document awaiting review can be accepted';
    end if;
    if v_missing is not null then
      raise exception 'complete every check before accepting: %', v_missing;
    end if;
    if v_failed is not null then
      raise exception 'a failed check cannot be accepted: %', v_failed;
    end if;
    update public.visa_documents
       set review_status = 'accepted', rejection_reason = null, review_checks = v_checks,
           reviewed_by = auth.uid(), reviewed_at = now()
     where id = doc.id;
    perform set_config('sts.visa_rpc', '', true);

    perform public._visa_log_event(
      app.id, 'document.verified', v_label || ' verified',
      v_label || ' verified.', false, false, 'visa.documents.review',
      null, null, null, jsonb_build_object('documentId', doc.id, 'version', doc.version, 'checks', v_checks), doc.member_id
    );
    return;
  end if;

  v_reason := nullif(concat_ws('. ', v_failed, v_note), '');
  if v_reason is null or length(v_reason) < 3 then
    raise exception 'mark the failed checks or enter what is wrong with this document';
  end if;
  if doc.review_status = 'rejected' then
    raise exception 'this document is already rejected';
  end if;

  update public.visa_documents
     set review_status = 'rejected', rejection_reason = v_reason,
         review_checks = case when v_checks = '{}'::jsonb then null else v_checks end,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = doc.id;
  perform set_config('sts.visa_rpc', '', true);

  perform public._visa_log_event(
    app.id, 'document.rejected', v_label || ' rejected: ' || v_reason,
    v_label || ' needs to be replaced: ' || v_reason, true, false, 'visa.documents.review',
    v_reason, null, null, jsonb_build_object('documentId', doc.id, 'version', doc.version, 'checks', v_checks), doc.member_id
  );

  perform public._visa_request_customer_action(app, v_label || ' rejected', 'visa.documents.review');
end;
$$;

revoke execute on function public.visa_review_document(uuid, text, text, jsonb) from public, anon;
grant execute on function public.visa_review_document(uuid, text, text, jsonb) to authenticated;
