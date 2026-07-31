-- ============================================================================
-- Visa Management
-- Visa processing is handled in-house by STS staff (admin role), unlike
-- hotels/agencies which have their own partner portals. Applicants (or the
-- agent submitting on their behalf) create + track applications; admins
-- move them through the workflow.
-- ============================================================================

create type public.visa_status as enum (
  'draft',
  'submitted',
  'in_review',
  'additional_info_required',
  'approved',
  'rejected',
  'issued',
  'cancelled'
);

create table public.visa_types (
  id uuid primary key default gen_random_uuid(),
  destination_country_code text not null,
  name text not null,
  description text,
  processing_days_min smallint,
  processing_days_max smallint,
  price numeric(10,2) not null check (price >= 0),
  currency text not null default 'USD',
  required_documents jsonb not null default '[]'::jsonb,
  status public.listing_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index visa_types_country_idx on public.visa_types (destination_country_code);

create trigger set_visa_types_updated_at
  before update on public.visa_types
  for each row execute function public.set_updated_at();

create table public.visa_applications (
  id uuid primary key default gen_random_uuid(),
  visa_type_id uuid not null references public.visa_types (id),
  applicant_profile_id uuid references public.profiles (id), -- traveler, if they have an account
  submitted_by uuid not null references public.profiles (id),
  agency_id uuid references public.agencies (id),
  traveler_details jsonb not null default '{}'::jsonb, -- name, dob, passport no/expiry, nationality
  status public.visa_status not null default 'draft',
  price numeric(10,2) not null,
  currency text not null default 'USD',
  applicant_notes text,
  admin_notes text,
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index visa_applications_submitted_by_idx on public.visa_applications (submitted_by);
create index visa_applications_agency_idx on public.visa_applications (agency_id);
create index visa_applications_status_idx on public.visa_applications (status);

create trigger set_visa_applications_updated_at
  before update on public.visa_applications
  for each row execute function public.set_updated_at();

create table public.visa_application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.visa_applications (id) on delete cascade,
  status public.visa_status not null,
  changed_by uuid references public.profiles (id),
  note text,
  created_at timestamptz not null default now()
);

create or replace function public.log_visa_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.visa_application_status_history (application_id, status, changed_by)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger visa_applications_status_log
  after insert or update of status on public.visa_applications
  for each row execute function public.log_visa_status_change();

create table public.visa_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.visa_applications (id) on delete cascade,
  document_type text not null,
  storage_path text not null,
  uploaded_by uuid not null references public.profiles (id),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index visa_documents_application_idx on public.visa_documents (application_id);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.visa_types enable row level security;
alter table public.visa_applications enable row level security;
alter table public.visa_application_status_history enable row level security;
alter table public.visa_documents enable row level security;

create policy "visa_types: public reads published"
  on public.visa_types for select to anon, authenticated
  using (status = 'published');

create policy "visa_types: admin manage"
  on public.visa_types for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "visa_applications: submitter reads own"
  on public.visa_applications for select to authenticated
  using (submitted_by = auth.uid() or applicant_profile_id = auth.uid());

create policy "visa_applications: agency reads its applications"
  on public.visa_applications for select to authenticated
  using (agency_id is not null and public.is_agency_member(agency_id));

create policy "visa_applications: admin manage"
  on public.visa_applications for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "visa_applications: submitter creates own"
  on public.visa_applications for insert to authenticated
  with check (submitted_by = auth.uid() and (agency_id is null or public.is_agency_member(agency_id)));

create policy "visa_applications: submitter edits own draft"
  on public.visa_applications for update to authenticated
  using (submitted_by = auth.uid() and status = 'draft')
  with check (status in ('draft', 'submitted'));

create policy "visa_application_status_history: read via parent application"
  on public.visa_application_status_history for select to authenticated
  using (exists (
    select 1 from public.visa_applications a
    where a.id = application_id
      and (a.submitted_by = auth.uid() or a.applicant_profile_id = auth.uid()
           or (a.agency_id is not null and public.is_agency_member(a.agency_id))
           or public.is_admin())
  ));

create policy "visa_documents: read via parent application"
  on public.visa_documents for select to authenticated
  using (exists (
    select 1 from public.visa_applications a
    where a.id = application_id
      and (a.submitted_by = auth.uid() or a.applicant_profile_id = auth.uid()
           or (a.agency_id is not null and public.is_agency_member(a.agency_id))
           or public.is_admin())
  ));

create policy "visa_documents: submitter uploads to own application"
  on public.visa_documents for insert to authenticated
  with check (uploaded_by = auth.uid() and exists (
    select 1 from public.visa_applications a
    where a.id = application_id and a.submitted_by = auth.uid()
  ));

create policy "visa_documents: admin manage"
  on public.visa_documents for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
