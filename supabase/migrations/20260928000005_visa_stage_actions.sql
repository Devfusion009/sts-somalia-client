-- Visa case management, milestone 2 of 5: context-aware case actions.
--
-- Each staff action is its own RPC: it checks one named permission, performs
-- one operation, moves the stage only where that operation implies it, and
-- writes one event. The admin console renders these as buttons derived from
-- the case's stage (modules/visa/workflow.ts), replacing the status dropdown.
--
-- Also: additional_info_required may now return to processing when the
-- request came in while the case was already lodged (info_return_stage), so
-- a document chase during processing no longer rewinds the case to review.

-- ----------------------------------------------------------------------------
-- Stage map: additional_info_required -> processing
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
      when 'in_review' then p_to in ('additional_info_required', 'ready_for_processing', 'rejected', 'cancelled')
      when 'additional_info_required' then p_to in ('in_review', 'processing', 'cancelled')
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

-- Loads the case for a staff action; refuses drafts and closed cases.
create or replace function public._visa_open_case(p_application_id uuid)
returns public.visa_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
begin
  select * into app from public.visa_applications where id = p_application_id for update;
  if not found or app.status = 'draft' then
    raise exception 'visa application not found';
  end if;
  if app.status in ('approved', 'rejected', 'issued', 'cancelled') then
    raise exception 'this application is closed';
  end if;
  return app;
end;
$$;

revoke execute on function public._visa_open_case(uuid) from public, anon, authenticated;

-- Puts a case in front of the applicant again, remembering where to resume.
create or replace function public._visa_request_customer_action(
  app public.visa_applications,
  p_note text,
  p_permission text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if app.status not in ('submitted', 'in_review', 'ready_for_processing', 'processing') then
    return;
  end if;

  perform set_config('sts.visa_rpc', app.id::text, true);
  update public.visa_applications
     set info_return_stage = case when app.status = 'processing' then 'processing'::public.visa_status
                                  else 'in_review'::public.visa_status end
   where id = app.id;
  perform set_config('sts.visa_rpc', '', true);

  -- The document event carries the customer-facing message; the stage change
  -- itself is logged without a second notification.
  perform public._visa_set_stage(app.id, 'additional_info_required', p_note, p_permission, null, false);
end;
$$;

revoke execute on function public._visa_request_customer_action(public.visa_applications, text, text)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Stage actions
-- ----------------------------------------------------------------------------
create or replace function public.visa_start_review(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
begin
  perform public._visa_require('visa.documents.review');
  app := public._visa_open_case(p_application_id);
  if app.status <> 'submitted' then
    raise exception 'review has already started';
  end if;
  perform public._visa_set_stage(app.id, 'in_review', null, 'visa.documents.review', null, true);
end;
$$;

create or replace function public.visa_resume_case(p_application_id uuid, p_note text default null)
returns public.visa_status
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
  v_blocker text;
  v_target public.visa_status;
begin
  perform public._visa_require('visa.documents.review');
  app := public._visa_open_case(p_application_id);
  if app.status <> 'additional_info_required' then
    raise exception 'this application is not waiting on the applicant';
  end if;
  v_blocker := public._visa_customer_blockers(app.id);
  if v_blocker is not null then
    raise exception 'still waiting on the applicant — %', v_blocker;
  end if;
  v_target := coalesce(app.info_return_stage, 'in_review');
  return public._visa_set_stage(app.id, v_target, p_note, 'visa.documents.review', null, true);
end;
$$;

create or replace function public.visa_mark_ready(p_application_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
begin
  perform public._visa_require('visa.documents.review');
  app := public._visa_open_case(p_application_id);
  if app.status <> 'in_review' then
    raise exception 'only an application in document review can be marked ready';
  end if;
  perform public._visa_set_stage(app.id, 'ready_for_processing', p_note, 'visa.documents.review', null, true);
end;
$$;

create or replace function public.visa_cancel_case(p_application_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform public._visa_require('visa.case.cancel');
  if v_reason is null or length(v_reason) < 5 then
    raise exception 'enter a reason for cancelling';
  end if;
  app := public._visa_open_case(p_application_id);

  perform public._visa_set_stage(
    app.id, 'cancelled', v_reason, 'visa.case.cancel',
    app.application_ref || ' was cancelled. ' || v_reason, true
  );

  -- An unpaid order for a cancelled case must not stay payable.
  perform public._apply_order_cancellation(o.id, 'Visa application cancelled: ' || v_reason)
     from public.order_items oi
     join public.orders o on o.id = oi.order_id
    where oi.visa_application_id = app.id
      and o.status in ('pending_payment', 'held');
end;
$$;

-- ----------------------------------------------------------------------------
-- Document review
-- ----------------------------------------------------------------------------
create or replace function public.visa_review_document(
  p_document_id uuid,
  p_decision text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  doc public.visa_documents;
  app public.visa_applications;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_label text;
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

  perform set_config('sts.visa_rpc', app.id::text, true);

  if p_decision = 'accept' then
    if doc.review_status <> 'pending' then
      raise exception 'only a document awaiting review can be accepted';
    end if;
    update public.visa_documents
       set review_status = 'accepted', rejection_reason = null,
           reviewed_by = auth.uid(), reviewed_at = now()
     where id = doc.id;
    perform set_config('sts.visa_rpc', '', true);

    perform public._visa_log_event(
      app.id, 'document.verified', v_label || ' verified',
      v_label || ' verified.', false, false, 'visa.documents.review',
      null, null, null, jsonb_build_object('documentId', doc.id, 'version', doc.version), doc.member_id
    );
    return;
  end if;

  if v_reason is null or length(v_reason) < 3 then
    raise exception 'enter what is wrong with this document';
  end if;
  if doc.review_status = 'rejected' then
    raise exception 'this document is already rejected';
  end if;

  update public.visa_documents
     set review_status = 'rejected', rejection_reason = v_reason,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = doc.id;
  perform set_config('sts.visa_rpc', '', true);

  perform public._visa_log_event(
    app.id, 'document.rejected', v_label || ' rejected: ' || v_reason,
    v_label || ' needs to be replaced: ' || v_reason, true, false, 'visa.documents.review',
    v_reason, null, null, jsonb_build_object('documentId', doc.id, 'version', doc.version), doc.member_id
  );

  perform public._visa_request_customer_action(app, v_label || ' rejected', 'visa.documents.review');
end;
$$;

create or replace function public.visa_request_document(
  p_application_id uuid,
  p_title text,
  p_description text default null,
  p_requirement text default 'required',
  p_due_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_id uuid;
begin
  perform public._visa_require('visa.documents.request');
  if v_title is null or length(v_title) < 2 then
    raise exception 'enter a document name';
  end if;
  if p_requirement not in ('required', 'optional') then
    raise exception 'invalid requirement';
  end if;
  if p_due_date is not null and p_due_date < current_date then
    raise exception 'the due date is in the past';
  end if;
  app := public._visa_open_case(p_application_id);

  insert into public.visa_document_requests (
    application_id, title, description, requirement, due_date, requested_by
  ) values (
    app.id, v_title, nullif(btrim(coalesce(p_description, '')), ''), p_requirement, p_due_date, auth.uid()
  )
  returning id into v_id;

  perform public._visa_log_event(
    app.id, 'request.created',
    'Requested "' || v_title || '"' || case when p_requirement = 'optional' then ' (optional)' else '' end,
    'Please upload: ' || v_title
      || case when p_due_date is not null then ' by ' || to_char(p_due_date, 'DD Mon YYYY') else '' end || '.',
    true, false, 'visa.documents.request',
    null, null, null, jsonb_build_object('requestId', v_id)
  );

  if p_requirement = 'required' then
    perform public._visa_request_customer_action(app, 'Requested: ' || v_title, 'visa.documents.request');
  end if;

  return v_id;
end;
$$;

create or replace function public.visa_resolve_document_request(
  p_request_id uuid,
  p_resolution text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.visa_document_requests;
  app public.visa_applications;
begin
  perform public._visa_require('visa.documents.review');
  if p_resolution not in ('received', 'waived') then
    raise exception 'invalid resolution';
  end if;

  select * into req from public.visa_document_requests where id = p_request_id for update;
  if not found then
    raise exception 'document request not found';
  end if;
  if req.status not in ('requested', 'uploaded') then
    raise exception 'this request is already resolved';
  end if;
  app := public._visa_open_case(req.application_id);

  perform set_config('sts.visa_rpc', app.id::text, true);
  update public.visa_document_requests
     set status = p_resolution, resolved_by = auth.uid(), resolved_at = now(), updated_at = now()
   where id = req.id;

  -- Marking an uploaded request received is the review of its file.
  if p_resolution = 'received' then
    update public.visa_documents
       set review_status = 'accepted', reviewed_by = auth.uid(), reviewed_at = now()
     where request_id = req.id and is_current and review_status = 'pending';
  end if;
  perform set_config('sts.visa_rpc', '', true);

  perform public._visa_log_event(
    app.id, 'request.' || p_resolution,
    '"' || req.title || '" ' || p_resolution
      || case when nullif(btrim(coalesce(p_reason, '')), '') is not null then ': ' || btrim(p_reason) else '' end,
    '"' || req.title || '" ' || case when p_resolution = 'received' then 'received.' else 'is no longer needed.' end,
    false, false, 'visa.documents.review',
    p_reason, null, null, jsonb_build_object('requestId', req.id)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- Customer-side uploads
-- ----------------------------------------------------------------------------
create or replace function public._visa_assert_uploaded(app public.visa_applications, p_storage_path text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if split_part(p_storage_path, '/', 1) <> app.id::text
     or not exists (
       select 1 from storage.objects o
        where o.bucket_id = 'visa-documents' and o.name = p_storage_path
     ) then
    raise exception 'upload not found';
  end if;
end;
$$;

revoke execute on function public._visa_assert_uploaded(public.visa_applications, text) from public, anon, authenticated;

create or replace function public._visa_is_case_party(app public.visa_applications)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app.submitted_by = auth.uid()
      or app.applicant_profile_id = auth.uid()
      or (app.agency_id is not null and public.is_agency_member(app.agency_id));
$$;

revoke execute on function public._visa_is_case_party(public.visa_applications) from public, anon, authenticated;

create or replace function public.visa_replace_document(
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
  v_id uuid;
  v_label text;
begin
  select * into doc from public.visa_documents where id = p_document_id for update;
  if not found then
    raise exception 'document not found';
  end if;
  select * into app from public.visa_applications where id = doc.application_id for update;
  if not public._visa_is_case_party(app) then
    raise exception 'document not found';
  end if;
  if app.status in ('draft', 'approved', 'rejected', 'issued', 'cancelled') then
    raise exception 'this application is closed';
  end if;
  if not doc.is_current or doc.review_status <> 'rejected' then
    raise exception 'only a rejected document can be replaced';
  end if;
  perform public._visa_assert_uploaded(app, p_storage_path);

  perform set_config('sts.visa_rpc', app.id::text, true);
  update public.visa_documents set is_current = false where id = doc.id;
  perform set_config('sts.visa_rpc', '', true);

  insert into public.visa_documents (
    application_id, document_type, storage_path, uploaded_by, file_name, file_size, content_type,
    version, supersedes_id, member_id, request_id
  ) values (
    app.id, doc.document_type, p_storage_path, auth.uid(), p_file_name, p_file_size, p_content_type,
    doc.version + 1, doc.id, doc.member_id, doc.request_id
  )
  returning id into v_id;

  v_label := public._visa_document_label(app.id, doc.document_type);
  perform public._visa_log_event(
    app.id, 'document.replaced', v_label || ' replaced (v' || (doc.version + 1) || ')',
    'You uploaded a new ' || v_label || '.', false, true, null,
    null, null, null, jsonb_build_object('documentId', v_id, 'supersedes', doc.id, 'version', doc.version + 1), doc.member_id
  );

  if app.status = 'additional_info_required'
     and coalesce(app.info_return_stage, 'in_review') = 'in_review'
     and public._visa_customer_blockers(app.id) is null then
    perform public._visa_set_stage(app.id, 'in_review', null, null, null, true);
  end if;

  return v_id;
end;
$$;

drop function if exists public.replace_rejected_visa_document(uuid, text, text, integer, text);

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
  select * into app from public.visa_applications where id = req.application_id for update;
  if not public._visa_is_case_party(app) then
    raise exception 'document request not found';
  end if;
  if req.status <> 'requested' then
    raise exception 'this document was already provided';
  end if;
  if app.status in ('draft', 'approved', 'rejected', 'issued', 'cancelled') then
    raise exception 'this application is closed';
  end if;
  perform public._visa_assert_uploaded(app, p_storage_path);

  insert into public.visa_documents (
    application_id, document_type, storage_path, uploaded_by, file_name, file_size, content_type, request_id
  ) values (
    app.id, 'request:' || req.title, p_storage_path, auth.uid(), p_file_name, p_file_size, p_content_type, req.id
  )
  returning id into v_doc;

  perform set_config('sts.visa_rpc', app.id::text, true);
  update public.visa_document_requests
     set status = 'uploaded', document_id = v_doc, updated_at = now()
   where id = req.id;
  perform set_config('sts.visa_rpc', '', true);

  perform public._visa_log_event(
    app.id, 'request.fulfilled', 'Applicant uploaded "' || req.title || '"',
    'You uploaded "' || req.title || '".', false, true, null,
    null, null, null, jsonb_build_object('requestId', req.id, 'documentId', v_doc)
  );

  if app.status = 'additional_info_required'
     and coalesce(app.info_return_stage, 'in_review') = 'in_review'
     and public._visa_customer_blockers(app.id) is null then
    perform public._visa_set_stage(app.id, 'in_review', null, null, null, true);
  end if;

  return v_doc;
end;
$$;

-- ----------------------------------------------------------------------------
-- Issued visa file (moves the stage in milestone 3)
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

  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Download audit: returns the storage path for a signed URL.
-- ----------------------------------------------------------------------------
create or replace function public.visa_log_document_access(p_document_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  doc public.visa_documents;
  app public.visa_applications;
  v_label text;
begin
  select * into doc from public.visa_documents where id = p_document_id;
  if not found then
    raise exception 'document not found';
  end if;
  select * into app from public.visa_applications where id = doc.application_id;

  if public.visa_staff_can('visa.applications.read') then
    v_label := public._visa_document_label(app.id, doc.document_type);
    perform public._visa_log_event(
      app.id, 'document.accessed', v_label || ' v' || doc.version || ' opened',
      null, false, false, 'visa.applications.read',
      null, null, null, jsonb_build_object('documentId', doc.id)
    );
    return doc.storage_path;
  end if;

  if public._visa_is_case_party(app) then
    return doc.storage_path;
  end if;

  raise exception 'document not found';
end;
$$;

-- ----------------------------------------------------------------------------
-- Readiness checklist (milestone 3 adds appointment/biometrics/passport rows).
-- ----------------------------------------------------------------------------
create or replace function public.visa_case_readiness(p_application_id uuid)
returns table (key text, label text, applies boolean, ok boolean, detail text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_payment text;
  v_customer text;
  v_outstanding text;
begin
  perform public._visa_require('visa.applications.read');
  v_payment := public.visa_payment_state(p_application_id);
  v_customer := public._visa_customer_blockers(p_application_id);
  v_outstanding := public.visa_application_outstanding_items(p_application_id);

  return query values
    ('payment', 'Payment received', true, v_payment in ('paid', 'partially_paid'), v_payment),
    ('documents_complete', 'Documents complete', true, v_customer is null, v_customer),
    ('documents_reviewed', 'Documents reviewed', true, v_outstanding is null,
       case when v_customer is null then v_outstanding end);
end;
$$;

-- ----------------------------------------------------------------------------
-- Grants
-- ----------------------------------------------------------------------------
revoke execute on function public.visa_start_review(uuid) from public, anon;
revoke execute on function public.visa_resume_case(uuid, text) from public, anon;
revoke execute on function public.visa_mark_ready(uuid, text) from public, anon;
revoke execute on function public.visa_cancel_case(uuid, text) from public, anon;
revoke execute on function public.visa_review_document(uuid, text, text) from public, anon;
revoke execute on function public.visa_request_document(uuid, text, text, text, date) from public, anon;
revoke execute on function public.visa_resolve_document_request(uuid, text, text) from public, anon;
revoke execute on function public.visa_replace_document(uuid, text, text, integer, text) from public, anon;
revoke execute on function public.visa_fulfil_document_request(uuid, text, text, integer, text) from public, anon;
revoke execute on function public.visa_attach_result_document(uuid, text, text, integer, text) from public, anon;
revoke execute on function public.visa_log_document_access(uuid) from public, anon;
revoke execute on function public.visa_case_readiness(uuid) from public, anon;

grant execute on function public.visa_start_review(uuid) to authenticated;
grant execute on function public.visa_resume_case(uuid, text) to authenticated;
grant execute on function public.visa_mark_ready(uuid, text) to authenticated;
grant execute on function public.visa_cancel_case(uuid, text) to authenticated;
grant execute on function public.visa_review_document(uuid, text, text) to authenticated;
grant execute on function public.visa_request_document(uuid, text, text, text, date) to authenticated;
grant execute on function public.visa_resolve_document_request(uuid, text, text) to authenticated;
grant execute on function public.visa_replace_document(uuid, text, text, integer, text) to authenticated;
grant execute on function public.visa_fulfil_document_request(uuid, text, text, integer, text) to authenticated;
grant execute on function public.visa_attach_result_document(uuid, text, text, integer, text) to authenticated;
grant execute on function public.visa_log_document_access(uuid) to authenticated;
grant execute on function public.visa_case_readiness(uuid) to authenticated;
