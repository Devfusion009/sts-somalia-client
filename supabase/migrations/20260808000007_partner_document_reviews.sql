-- ============================================================================
-- Per-document verification for partner application documents. document_refs
-- stays applicant-owned (jsonb on the application row); this is a separate
-- admin-only audit table keyed by (application_type, application_id, doc_key)
-- rather than fields bolted onto document_refs, so the applicant's own data
-- and the admin's review decisions never share a write path.
-- ============================================================================

create table public.partner_document_reviews (
  id uuid primary key default gen_random_uuid(),
  application_type text not null check (application_type in ('agency', 'hotel_partner', 'affiliate')),
  application_id uuid not null,
  doc_key text not null,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  note text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_type, application_id, doc_key)
);

create index partner_document_reviews_application_idx
  on public.partner_document_reviews (application_type, application_id);

alter table public.partner_document_reviews enable row level security;

create policy "partner_document_reviews: admin manage"
  on public.partner_document_reviews for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Applicants can see the verification status of their own documents (not who
-- reviewed them) — read-only, keyed off ownership of the underlying application.
create policy "partner_document_reviews: applicant reads own"
  on public.partner_document_reviews for select to authenticated
  using (
    (application_type = 'agency' and exists (
      select 1 from public.agency_applications a where a.id = application_id and a.applicant_id = auth.uid()
    ))
    or (application_type = 'hotel_partner' and exists (
      select 1 from public.hotel_partner_applications a where a.id = application_id and a.applicant_id = auth.uid()
    ))
    or (application_type = 'affiliate' and exists (
      select 1 from public.affiliate_applications a where a.id = application_id and a.applicant_id = auth.uid()
    ))
  );

create trigger set_partner_document_reviews_updated_at
  before update on public.partner_document_reviews
  for each row execute function public.set_updated_at();

create trigger partner_document_reviews_audit
  after insert or update or delete on public.partner_document_reviews
  for each row execute function public.audit_log_row_change();
