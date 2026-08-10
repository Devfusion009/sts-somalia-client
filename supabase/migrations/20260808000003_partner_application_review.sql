-- ============================================================================
-- Partner application review upgrade (part 2 — see 20260808000002 for why
-- the enum additions are a separate, prior migration file)
-- 1) Richer application lifecycle: draft -> pending -> under_review ->
--    (more_info_requested <-> pending) -> approved | rejected.
-- 2) Reference numbers, assigned reviewer, admin-only internal notes.
-- 3) affiliate_applications gains the business_details/document_refs parity
--    the other two application tables already had.
-- 4) A real audit trail for free: attach the existing generic
--    audit_log_row_change trigger (already renders in /admin/audit-log)
--    rather than build a bespoke history table.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Shared new columns across all 3 application tables.
-- review_notes (pre-existing) becomes the applicant-visible reason/message
-- (rejection reason, or what's needed for more-info) — it was captured by
-- reject_agency_application() from day one but never actually shown to the
-- applicant; the app layer now surfaces it. internal_notes is new and never
-- shown to the applicant, matching this codebase's existing precedent
-- (visa admin notes) of keeping staff-only commentary in a distinct column
-- rather than overloading one field with an ad-hoc visibility rule.
-- ----------------------------------------------------------------------------
alter table public.agency_applications
  add column reference_number text unique,
  add column assigned_reviewer uuid references public.profiles (id),
  add column internal_notes text,
  add column submitted_at timestamptz;

alter table public.hotel_partner_applications
  add column reference_number text unique,
  add column assigned_reviewer uuid references public.profiles (id),
  add column internal_notes text,
  add column submitted_at timestamptz;

alter table public.affiliate_applications
  add column reference_number text unique,
  add column assigned_reviewer uuid references public.profiles (id),
  add column internal_notes text,
  add column submitted_at timestamptz,
  add column business_details jsonb not null default '{}'::jsonb,
  add column document_refs jsonb not null default '[]'::jsonb;

-- Existing rows are all already-submitted (this table had no draft concept
-- before today) — backfill submitted_at from created_at so nothing shows a
-- blank submission date.
update public.agency_applications set submitted_at = created_at where submitted_at is null;
update public.hotel_partner_applications set submitted_at = created_at where submitted_at is null;
update public.affiliate_applications set submitted_at = created_at where submitted_at is null;

-- ----------------------------------------------------------------------------
-- Reference numbers: one sequence per applicant type, human-readable format
-- matching this codebase's existing convention (generate_hall_booking_ref,
-- generate_invoice_number) — "STS-TA-2026-000142" etc.
-- ----------------------------------------------------------------------------
create sequence public.agency_application_ref_seq;
create sequence public.hotel_partner_application_ref_seq;
create sequence public.affiliate_application_ref_seq;

create or replace function public.generate_agency_application_ref()
returns text language sql as $$
  select 'STS-TA-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.agency_application_ref_seq')::text, 6, '0');
$$;

create or replace function public.generate_hotel_partner_application_ref()
returns text language sql as $$
  select 'STS-HP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.hotel_partner_application_ref_seq')::text, 6, '0');
$$;

create or replace function public.generate_affiliate_application_ref()
returns text language sql as $$
  select 'STS-AF-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.affiliate_application_ref_seq')::text, 6, '0');
$$;

-- Backfill existing rows so reference_number is never blank going forward.
update public.agency_applications set reference_number = public.generate_agency_application_ref() where reference_number is null;
update public.hotel_partner_applications set reference_number = public.generate_hotel_partner_application_ref() where reference_number is null;
update public.affiliate_applications set reference_number = public.generate_affiliate_application_ref() where reference_number is null;

-- New submissions get one automatically; draft rows (created before the
-- applicant is done) stay null until they actually submit — the app sets
-- submitted_at + reference_number together at that moment, not at draft
-- creation, so a reference number always means "this was actually sent."

-- ----------------------------------------------------------------------------
-- 2) Real audit trail — reuse the existing generic trigger + admin UI
-- (/admin/audit-log, built earlier) instead of a bespoke status-history
-- table. audit_log_row_change already existed and already fires on 7 other
-- tables; these 3 were simply never wired to it.
-- ----------------------------------------------------------------------------
create trigger agency_applications_audit
  after insert or update on public.agency_applications
  for each row execute function public.audit_log_row_change();

create trigger hotel_partner_applications_audit
  after insert or update on public.hotel_partner_applications
  for each row execute function public.audit_log_row_change();

create trigger affiliate_applications_audit
  after insert or update on public.affiliate_applications
  for each row execute function public.audit_log_row_change();

-- ----------------------------------------------------------------------------
-- 3) Draft applications must stay invisible to admin (only the applicant
-- can see their own draft) — extend the existing "admin manage" policies'
-- read scope is already "for all" so admins already see drafts too; add an
-- explicit filter helper the queries layer uses instead of relying on RLS
-- to hide drafts (RLS still correctly lets admin READ everything — hiding
-- drafts from the admin QUEUE is a query-level concern, not an access-level
-- one, since an admin being able to see a draft isn't a security problem).
-- No RLS change needed here; noted for the query-layer implementation.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 4) Applicant can update their own draft/more-info-requested application
-- (not just insert once). Existing policies only ever granted INSERT to the
-- applicant; a real "save draft, come back, edit, resubmit" flow needs
-- UPDATE too, scoped to the applicant's own row and only pre-decision
-- states (never after approved/rejected/pending/under_review — those are
-- locked to the admin side once submitted for real review).
-- ----------------------------------------------------------------------------
create policy "agency_applications: applicant edits own draft or more-info"
  on public.agency_applications for update to authenticated
  using (applicant_id = auth.uid() and status in ('draft', 'more_info_requested'))
  with check (applicant_id = auth.uid() and status in ('draft', 'pending', 'more_info_requested'));

create policy "hotel_partner_applications: applicant edits own draft or more-info"
  on public.hotel_partner_applications for update to authenticated
  using (applicant_id = auth.uid() and status in ('draft', 'more_info_requested'))
  with check (applicant_id = auth.uid() and status in ('draft', 'pending', 'more_info_requested'));

create policy "affiliate_applications: applicant edits own draft or more-info"
  on public.affiliate_applications for update to authenticated
  using (applicant_id = auth.uid() and status in ('draft', 'more_info_requested'))
  with check (applicant_id = auth.uid() and status in ('draft', 'pending', 'more_info_requested'));
