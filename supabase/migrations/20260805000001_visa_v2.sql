-- ============================================================================
-- Visa v2 — full application-wizard support
-- The public visa flow is a multi-step wizard (applicant type → members →
-- personal → travel → documents → review → payment → tracking), so
-- applications need: a human-readable reference, family/group members,
-- structured travel details, resumable draft progress, and an admin-driven
-- "additional documents" request loop that powers the tracking timeline.
-- ============================================================================

-- 'processing' sits between documents-received and the final decision on the
-- customer-facing tracking timeline ("Under Processing" in the product spec).
-- NOTE: intentionally not referenced elsewhere in this migration — a new enum
-- value cannot be used in the same transaction that adds it.
alter type public.visa_status add value if not exists 'processing' before 'approved';

-- ----------------------------------------------------------------------------
-- Catalog: richer visa-type facts shown on cards, detail pages, and the
-- wizard's sticky summary (validity / stay / entries / category).
-- ----------------------------------------------------------------------------
alter table public.visa_types
  add column validity_days integer,
  add column stay_days integer,
  add column entry_type text not null default 'single'
    check (entry_type in ('single', 'multiple')),
  add column visa_category text not null default 'tourist'
    check (visa_category in ('tourist', 'business', 'transit', 'umrah', 'work', 'student', 'family_visit')),
  add column overview text,
  add column is_featured boolean not null default false;

-- ----------------------------------------------------------------------------
-- Applications: reference numbers, wizard state, applicant grouping
-- ----------------------------------------------------------------------------
create sequence public.visa_application_ref_seq;

create or replace function public.generate_visa_application_ref()
returns text
language sql
as $$
  select 'STS-VISA-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.visa_application_ref_seq')::text, 6, '0');
$$;

alter table public.visa_applications
  add column application_ref text not null unique default public.generate_visa_application_ref(),
  add column applicant_type text not null default 'single'
    check (applicant_type in ('single', 'family', 'group')),
  add column travel_details jsonb not null default '{}'::jsonb,
  add column contact_details jsonb not null default '{}'::jsonb,
  add column current_step smallint not null default 1;

-- ----------------------------------------------------------------------------
-- Family / group members travelling under one application. The primary
-- applicant also gets a row (is_primary) so the member list is the single
-- source of truth for "who is on this application".
-- ----------------------------------------------------------------------------
create table public.visa_members (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.visa_applications (id) on delete cascade,
  is_primary boolean not null default false,
  full_name text not null,
  relationship text not null default 'self',
  date_of_birth date,
  nationality text,
  passport_number text,
  passport_expiry date,
  details jsonb not null default '{}'::jsonb,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create index visa_members_application_idx on public.visa_members (application_id, sort_order);

-- ----------------------------------------------------------------------------
-- Admin-requested additional documents ("Additional Documents" stage on the
-- tracking timeline + the upload table on the result page).
-- ----------------------------------------------------------------------------
create table public.visa_document_requests (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.visa_applications (id) on delete cascade,
  title text not null,
  description text,
  requirement text not null default 'required'
    check (requirement in ('required', 'optional')),
  status text not null default 'requested'
    check (status in ('requested', 'uploaded', 'received', 'waived')),
  document_id uuid references public.visa_documents (id) on delete set null,
  requested_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index visa_document_requests_application_idx on public.visa_document_requests (application_id);

create trigger set_visa_document_requests_updated_at
  before update on public.visa_document_requests
  for each row execute function public.set_updated_at();

-- File metadata so document lists can show name/size without a storage call.
alter table public.visa_documents
  add column file_name text,
  add column file_size integer,
  add column content_type text;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.visa_members enable row level security;
alter table public.visa_document_requests enable row level security;

create policy "visa_members: read via parent application"
  on public.visa_members for select to authenticated
  using (exists (
    select 1 from public.visa_applications a
    where a.id = application_id
      and (a.submitted_by = auth.uid() or a.applicant_profile_id = auth.uid()
           or (a.agency_id is not null and public.is_agency_member(a.agency_id))
           or public.is_admin())
  ));

create policy "visa_members: submitter manages while draft"
  on public.visa_members for all to authenticated
  using (exists (
    select 1 from public.visa_applications a
    where a.id = application_id and a.submitted_by = auth.uid() and a.status = 'draft'
  ))
  with check (exists (
    select 1 from public.visa_applications a
    where a.id = application_id and a.submitted_by = auth.uid() and a.status = 'draft'
  ));

create policy "visa_members: admin manage"
  on public.visa_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "visa_document_requests: read via parent application"
  on public.visa_document_requests for select to authenticated
  using (exists (
    select 1 from public.visa_applications a
    where a.id = application_id
      and (a.submitted_by = auth.uid() or a.applicant_profile_id = auth.uid()
           or (a.agency_id is not null and public.is_agency_member(a.agency_id))
           or public.is_admin())
  ));

-- Submitter may only move a request from 'requested' to 'uploaded' (attaching
-- their document); accepting it as 'received' (or waiving) stays admin-only.
create policy "visa_document_requests: submitter attaches upload"
  on public.visa_document_requests for update to authenticated
  using (
    status = 'requested'
    and exists (
      select 1 from public.visa_applications a
      where a.id = application_id and a.submitted_by = auth.uid()
    )
  )
  with check (status = 'uploaded');

create policy "visa_document_requests: admin manage"
  on public.visa_document_requests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
