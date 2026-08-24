-- ============================================================================
-- Lets an applicant replace a document an admin marked 'rejected' — even on
-- an already-approved partner application. Table-level RLS
-- (applicant_edit_pending_applications.sql) only lets the applicant UPDATE
-- their application row before a final decision, deliberately, so an
-- approved application's business_details/status can't be rewritten by the
-- applicant afterwards. This function is the one narrow exception: it only
-- ever touches document_refs, and only for a doc_key currently marked
-- 'rejected' in partner_document_reviews, so re-review always starts from a
-- clean 'pending' state instead of a stale rejection reason.
-- ============================================================================

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
  new_ref jsonb;
  filtered jsonb;
begin
  if p_kind not in ('agency', 'hotel_partner', 'affiliate') then
    raise exception 'unsupported application kind';
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

  if p_kind = 'agency' then
    if not exists (select 1 from public.agency_applications where id = p_application_id and applicant_id = auth.uid()) then
      raise exception 'application not found or not owned';
    end if;
    select jsonb_agg(elem) into filtered
      from public.agency_applications a, jsonb_array_elements(coalesce(a.document_refs, '[]'::jsonb)) elem
      where a.id = p_application_id and elem->>'key' <> p_doc_key;
    update public.agency_applications
      set document_refs = coalesce(filtered, '[]'::jsonb) || jsonb_build_array(new_ref)
      where id = p_application_id;

  elsif p_kind = 'hotel_partner' then
    if not exists (select 1 from public.hotel_partner_applications where id = p_application_id and applicant_id = auth.uid()) then
      raise exception 'application not found or not owned';
    end if;
    select jsonb_agg(elem) into filtered
      from public.hotel_partner_applications a, jsonb_array_elements(coalesce(a.document_refs, '[]'::jsonb)) elem
      where a.id = p_application_id and elem->>'key' <> p_doc_key;
    update public.hotel_partner_applications
      set document_refs = coalesce(filtered, '[]'::jsonb) || jsonb_build_array(new_ref)
      where id = p_application_id;

  elsif p_kind = 'affiliate' then
    if not exists (select 1 from public.affiliate_applications where id = p_application_id and applicant_id = auth.uid()) then
      raise exception 'application not found or not owned';
    end if;
    select jsonb_agg(elem) into filtered
      from public.affiliate_applications a, jsonb_array_elements(coalesce(a.document_refs, '[]'::jsonb)) elem
      where a.id = p_application_id and elem->>'key' <> p_doc_key;
    update public.affiliate_applications
      set document_refs = coalesce(filtered, '[]'::jsonb) || jsonb_build_array(new_ref)
      where id = p_application_id;
  end if;

  update public.partner_document_reviews
    set status = 'pending', note = null, reviewed_by = null, reviewed_at = null
    where application_type = p_kind and application_id = p_application_id and doc_key = p_doc_key;
end;
$$;
