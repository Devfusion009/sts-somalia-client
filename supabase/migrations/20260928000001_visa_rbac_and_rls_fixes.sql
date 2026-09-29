-- Visa case management, milestone 1 of 5: permission plumbing + RLS holes.
--
-- 1. visa_staff_can(perm) / _visa_require(perm): the ONE place a visa staff
--    permission is decided. Today every platform admin holds every visa.*
--    permission; a future staff-roles table changes only these two bodies
--    (and modules/visa/permissions.ts on the app side).
-- 2. Customer-side holes found in review:
--    a) visa_documents insert had no column restriction — a submitter could
--       insert a row already marked review_status='accepted'.
--    b) the submitter could rewrite price / fee_amount / resolved_* on a
--       draft, and submit billed from resolved_price.
--    c) the submitter could point a document request at any document_id.
--    d) visa_applications insert had no status restriction.
-- 3. No DELETE policy for the submitter, so draft re-uploads and removals
--    silently left orphaned rows and files.
-- 4. The payment gate only covered submitted -> in_review; the later
--    submitted -> additional_info_required edge walked around it.

-- ----------------------------------------------------------------------------
-- Permission helpers
-- ----------------------------------------------------------------------------
create or replace function public.visa_staff_can(p_perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p_perm, '') like 'visa.%' and public.is_admin();
$$;

revoke execute on function public.visa_staff_can(text) from public, anon;
grant execute on function public.visa_staff_can(text) to authenticated;

create or replace function public._visa_require(p_perm text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.visa_staff_can(p_perm) then
    raise exception 'not permitted: %', p_perm using errcode = 'insufficient_privilege';
  end if;
end;
$$;

revoke execute on function public._visa_require(text) from public, anon, authenticated;

-- A write that did not come from a signed-in customer/agent request: staff,
-- the service role (partner webhook), or a direct database session
-- (migrations, psql). Customer/agent requests arrive as role authenticated.
create or replace function public._visa_trusted_writer(p_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(current_setting('role', true), 'none') not in ('authenticated', 'anon')
      or public.is_admin()
      or coalesce(current_setting('sts.visa_rpc', true), '') = p_application_id::text;
$$;

revoke execute on function public._visa_trusted_writer(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Payment is derived from the linked order, never stored on the application.
-- ----------------------------------------------------------------------------
create or replace function public.visa_payment_state(p_application_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
           when o.status is null then 'not_billed'
           when o.status in ('paid', 'processing', 'completed') then 'paid'
           when o.status = 'partially_paid' then 'partially_paid'
           when o.status = 'cancelled' then 'cancelled'
           when o.status = 'refunded' then 'refunded'
           else 'pending'
         end
    from public.visa_applications a
    left join lateral (
      select o.status
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
       where oi.visa_application_id = a.id
       order by o.created_at desc
       limit 1
    ) o on true
   where a.id = p_application_id
     and (
       public._visa_trusted_writer(a.id)
       or public.visa_staff_can('visa.applications.read')
       or a.submitted_by = auth.uid()
       or a.applicant_profile_id = auth.uid()
       or (a.agency_id is not null and public.is_agency_member(a.agency_id))
     );
$$;

revoke execute on function public.visa_payment_state(uuid) from public, anon;
grant execute on function public.visa_payment_state(uuid) to authenticated;

create or replace function public.guard_visa_requires_payment_to_review()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'submitted'
     and new.status is distinct from old.status
     and new.status <> 'cancelled'
     and coalesce(public.visa_payment_state(new.id), 'not_billed') not in ('paid', 'partially_paid') then
    raise exception 'this application has not been paid for yet — nothing to review until the order settles';
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- (b) + (d) Draft integrity: a customer/agent write can never set what the
-- application costs or any staff-owned column. Pricing is recomputed from the
-- catalog (nationality rule over visa type) on every customer write.
-- ----------------------------------------------------------------------------
create or replace function public.visa_applications_draft_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nat text;
  vt public.visa_types;
  r public.visa_nationality_rules;
begin
  if public._visa_trusted_writer(new.id) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'a new visa application must start as a draft';
    end if;
    if new.application_ref !~ '^STS-VISA-[0-9]{4}-[0-9]{6}$' then
      raise exception 'invalid application reference';
    end if;
    new.admin_notes := null;
    new.decided_by := null;
    new.decided_at := null;
    new.partner_provider_key := null;
    new.partner_ref := null;
    new.partner_status := null;
    new.partner_last_synced_at := null;
    new.partner_raw_payload := null;
  else
    if new.visa_type_id is distinct from old.visa_type_id
       or new.submitted_by is distinct from old.submitted_by
       or new.applicant_profile_id is distinct from old.applicant_profile_id
       or new.agency_id is distinct from old.agency_id
       or new.agency_customer_id is distinct from old.agency_customer_id
       or new.application_ref is distinct from old.application_ref
       or new.admin_notes is distinct from old.admin_notes
       or new.decided_by is distinct from old.decided_by
       or new.decided_at is distinct from old.decided_at
       or new.partner_provider_key is distinct from old.partner_provider_key
       or new.partner_ref is distinct from old.partner_ref
       or new.partner_status is distinct from old.partner_status
       or new.partner_last_synced_at is distinct from old.partner_last_synced_at
       or new.partner_raw_payload is distinct from old.partner_raw_payload then
      raise exception 'this field can only be changed by STS';
    end if;
  end if;

  select * into vt from public.visa_types where id = new.visa_type_id;
  if not found then
    raise exception 'visa type not found';
  end if;

  v_nat := upper(nullif(btrim(coalesce(new.traveler_details->>'nationality', '')), ''));
  if v_nat is not null then
    select * into r from public.visa_nationality_rules
     where visa_type_id = vt.id and nationality_code = v_nat;
  end if;

  new.currency := vt.currency;
  new.price := coalesce(r.price, vt.price);
  new.fee_amount := 0;
  if v_nat is null then
    new.resolved_price := null;
    new.resolved_processing_fee := null;
    new.resolved_processing_days_min := null;
    new.resolved_processing_days_max := null;
    new.resolved_documents := null;
    new.resolved_eligibility_requirements := null;
  else
    new.resolved_price := coalesce(r.price, vt.price);
    new.resolved_processing_fee := coalesce(r.processing_fee, vt.processing_fee);
    new.resolved_processing_days_min := coalesce(r.processing_days_min, vt.processing_days_min);
    new.resolved_processing_days_max := coalesce(r.processing_days_max, vt.processing_days_max);
    new.resolved_documents := coalesce(r.required_documents, vt.required_documents);
    new.resolved_eligibility_requirements := coalesce(r.eligibility_requirements, vt.eligibility_requirements);
  end if;

  return new;
end;
$$;

revoke execute on function public.visa_applications_draft_integrity() from public, anon, authenticated;

drop trigger if exists visa_applications_draft_integrity on public.visa_applications;
create trigger visa_applications_draft_integrity
  before insert or update on public.visa_applications
  for each row execute function public.visa_applications_draft_integrity();

drop policy if exists "visa_applications: submitter edits own draft" on public.visa_applications;
create policy "visa_applications: submitter edits own draft"
  on public.visa_applications for update
  using (submitted_by = auth.uid() and status = 'draft')
  with check (submitted_by = auth.uid() and status = 'draft');

drop policy if exists "visa_applications: submitter creates own" on public.visa_applications;
create policy "visa_applications: submitter creates own"
  on public.visa_applications for insert
  with check (
    submitted_by = auth.uid()
    and status = 'draft'
    and (agency_id is null or public.is_agency_member(agency_id))
  );

-- ----------------------------------------------------------------------------
-- (a) Documents: a customer inserts only an unreviewed row, only while the
-- application is still a draft. Uploads after submission go through RPCs.
-- ----------------------------------------------------------------------------
drop policy if exists "visa_documents: submitter uploads to own application" on public.visa_documents;
create policy "visa_documents: submitter uploads to own draft"
  on public.visa_documents for insert
  with check (
    uploaded_by = auth.uid()
    and review_status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and rejection_reason is null
    and exists (
      select 1 from public.visa_applications a
       where a.id = visa_documents.application_id
         and a.submitted_by = auth.uid()
         and a.status = 'draft'
    )
  );

create policy "visa_documents: submitter deletes while draft"
  on public.visa_documents for delete
  using (
    exists (
      select 1 from public.visa_applications a
       where a.id = visa_documents.application_id
         and a.submitted_by = auth.uid()
         and a.status = 'draft'
    )
  );

drop policy if exists "visa_documents_bucket: submitter deletes own draft files" on storage.objects;
create policy "visa_documents_bucket: submitter deletes own draft files"
  on storage.objects for delete
  using (
    bucket_id = 'visa-documents'
    and exists (
      select 1 from public.visa_applications a
       where a.id::text = (storage.foldername(objects.name))[1]
         and a.submitted_by = auth.uid()
         and a.status = 'draft'
    )
  );

-- ----------------------------------------------------------------------------
-- (c) Requests: the customer no longer updates request rows directly —
-- visa_fulfil_document_request() (next migration) links the upload.
-- ----------------------------------------------------------------------------
drop policy if exists "visa_document_requests: submitter attaches upload" on public.visa_document_requests;
