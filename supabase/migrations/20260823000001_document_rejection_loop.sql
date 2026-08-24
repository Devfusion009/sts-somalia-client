-- ============================================================================
-- Closes the document rejection loop: admin rejects a document -> applicant is
-- told which one and why -> applicant replaces it -> the review resets to
-- 'pending' and the admins who have to look again are told.
--
-- Before this, only one of the two replacement paths reset the review.
-- resubmit_kyc_document (20260822000001) handles the read-only view page,
-- where table RLS forbids the applicant writing document_refs at all. The
-- wizard is the other path: while an application is still applicant-editable
-- (draft / more_info_requested / inside the post-submit edit window) the
-- applicant writes document_refs directly under normal RLS, and nothing
-- touched partner_document_reviews — so the admin kept seeing "Rejected" with
-- a stale reason against a file that had already been replaced.
--
-- clear_document_rejection is that missing half, and resubmit_kyc_document now
-- delegates to it so both paths cannot drift apart.
-- ============================================================================

-- Resolves an application kind to its table. Every dynamic statement below
-- builds its SQL from this, never from the caller's string, so a bad kind is
-- an exception rather than an injection point.
create or replace function public.partner_application_table(p_kind text)
returns text
language sql
immutable
as $$
  select case p_kind
    when 'agency' then 'agency_applications'
    when 'hotel_partner' then 'hotel_partner_applications'
    when 'affiliate' then 'affiliate_applications'
    when 'venue_partner' then 'venue_partner_applications'
  end;
$$;

-- ----------------------------------------------------------------------------
-- Reset a rejection after the applicant supplies a replacement file.
--
-- SECURITY DEFINER for two reasons, both of which the applicant genuinely
-- cannot do under their own grants: partner_document_reviews is admin-write
-- (the applicant only reads it), and notifications has no client insert policy
-- at all — the same shape as notify_admins_new_order (20260815000002).
--
-- A no-op when the document isn't currently rejected, so the wizard's ordinary
-- upload action can call it unconditionally without first querying the review.
-- ----------------------------------------------------------------------------
create or replace function public.clear_document_rejection(
  p_kind text,
  p_application_id uuid,
  p_doc_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text := public.partner_application_table(p_kind);
  v_applicant uuid;
  v_reference text;
  v_status public.application_status;
  v_docs jsonb;
  v_label text;
begin
  if v_table is null then
    raise exception 'unsupported application kind: %', p_kind;
  end if;

  execute format(
    'select applicant_id, reference_number, status, document_refs from public.%I where id = $1',
    v_table
  ) into v_applicant, v_reference, v_status, v_docs using p_application_id;

  if v_applicant is null or v_applicant <> auth.uid() then
    raise exception 'application not found or not owned';
  end if;

  if not exists (
    select 1 from public.partner_document_reviews
    where application_type = p_kind
      and application_id = p_application_id
      and doc_key = p_doc_key
      and status = 'rejected'
  ) then
    return;
  end if;

  update public.partner_document_reviews
    set status = 'pending', note = null, reviewed_by = null, reviewed_at = null
    where application_type = p_kind
      and application_id = p_application_id
      and doc_key = p_doc_key;

  -- The application was parked waiting on the applicant; once nothing is left
  -- rejected it goes back to STS. Gated on the LAST rejection clearing, not
  -- this one: more_info_requested is what keeps the wizard open past the
  -- 2-hour edit window, so flipping it on the first of three replacements
  -- would lock the applicant out mid-correction. Deliberately narrow in the
  -- other direction too — pending / under_review / approved / rejected keep
  -- the status they had, because a single document is not what put them there.
  if v_status = 'more_info_requested' and not exists (
    select 1 from public.partner_document_reviews
    where application_type = p_kind
      and application_id = p_application_id
      and status = 'rejected'
  ) then
    execute format('update public.%I set status = %L where id = $1', v_table, 'under_review')
      using p_application_id;
  end if;

  -- Label from the applicant's own document_refs entry — doc_key ('trade_license')
  -- is a slug, and an admin reading the bell needs the words they rejected.
  select coalesce(elem->>'label', p_doc_key) into v_label
    from jsonb_array_elements(coalesce(v_docs, '[]'::jsonb)) elem
    where elem->>'key' = p_doc_key
    limit 1;

  insert into public.notifications (profile_id, type, title, body, data)
  select p.id,
         'application_document_resubmitted',
         'A document was re-uploaded',
         'The applicant replaced "' || coalesce(v_label, p_doc_key) || '" on application ' ||
           coalesce(v_reference, p_application_id::text) || '. It is waiting for review again.',
         jsonb_build_object(
           'applicationType', p_kind,
           'applicationId', p_application_id,
           'docKey', p_doc_key
         )
  from public.profiles p
  where p.is_platform_admin;
end;
$$;

-- ----------------------------------------------------------------------------
-- resubmit_kyc_document, rewritten over the same table resolver: adds
-- venue_partner (which had document slots and admin review from
-- 20260815000002, but was refused here), and hands the reset + admin alert to
-- clear_document_rejection instead of keeping a second copy of that logic.
-- ----------------------------------------------------------------------------
create or replace function public.resubmit_kyc_document(
  p_kind text,
  p_application_id uuid,
  p_doc_key text,
  p_label text,
  p_storage_path text,
  p_file_name text,
  p_file_size int,
  p_expiry text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text := public.partner_application_table(p_kind);
  v_applicant uuid;
  new_ref jsonb;
begin
  if v_table is null then
    raise exception 'unsupported application kind: %', p_kind;
  end if;

  execute format('select applicant_id from public.%I where id = $1', v_table)
    into v_applicant using p_application_id;
  if v_applicant is null or v_applicant <> auth.uid() then
    raise exception 'application not found or not owned';
  end if;

  if not exists (
    select 1 from public.partner_document_reviews
    where application_type = p_kind
      and application_id = p_application_id
      and doc_key = p_doc_key
      and status = 'rejected'
  ) then
    raise exception 'only a rejected document can be resubmitted';
  end if;

  new_ref := jsonb_build_object(
    'key', p_doc_key,
    'label', p_label,
    'storage_path', p_storage_path,
    'file_name', p_file_name,
    'file_size', p_file_size,
    'expiry', p_expiry,
    'uploaded_at', now()
  );

  execute format(
    'update public.%I set document_refs = coalesce((
       select jsonb_agg(elem)
         from jsonb_array_elements(coalesce(document_refs, ''[]''::jsonb)) elem
        where elem->>''key'' <> $2
     ), ''[]''::jsonb) || jsonb_build_array($3::jsonb)
     where id = $1',
    v_table
  ) using p_application_id, p_doc_key, new_ref;

  perform public.clear_document_rejection(p_kind, p_application_id, p_doc_key);
end;
$$;
