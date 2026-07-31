-- ============================================================================
-- B2B Agent Portal: agencies, membership, and the application/approval flow
-- ============================================================================

create type public.application_status as enum ('pending', 'approved', 'rejected');
create type public.agency_status as enum ('pending', 'active', 'suspended');
create type public.agency_member_role as enum ('owner', 'staff');
create type public.member_status as enum ('active', 'invited', 'removed');

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  registration_number text,
  contact_email citext not null,
  contact_phone text,
  country_code text,
  status public.agency_status not null default 'pending',
  commission_rate numeric(5,2) not null default 0 check (commission_rate >= 0 and commission_rate <= 100),
  credit_limit numeric(12,2) not null default 0 check (credit_limit >= 0),
  credit_balance numeric(12,2) not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_agencies_updated_at
  before update on public.agencies
  for each row execute function public.set_updated_at();

create table public.agency_members (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role_in_agency public.agency_member_role not null default 'staff',
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (agency_id, profile_id)
);

create index agency_members_profile_idx on public.agency_members (profile_id);

create table public.agency_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  agency_name text not null,
  business_details jsonb not null default '{}'::jsonb,
  document_refs jsonb not null default '[]'::jsonb, -- storage object paths
  status public.application_status not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now()
);

create index agency_applications_status_idx on public.agency_applications (status);

-- ----------------------------------------------------------------------------
-- Helper: is the current user a member (any role) / owner of a given agency?
-- ----------------------------------------------------------------------------
create or replace function public.is_agency_member(target_agency_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.agency_members
    where agency_id = target_agency_id
      and profile_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.is_agency_owner(target_agency_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.agency_members
    where agency_id = target_agency_id
      and profile_id = auth.uid()
      and role_in_agency = 'owner'
      and status = 'active'
  );
$$;

-- ----------------------------------------------------------------------------
-- Admin approval: creates the agency, seats the applicant as owner, and
-- promotes their profile role to 'agent'. Single transaction, admin-only.
-- ----------------------------------------------------------------------------
create or replace function public.approve_agency_application(application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.agency_applications;
  new_agency_id uuid;
begin
  if not public.is_admin() then
    raise exception 'only admins can approve agency applications';
  end if;

  select * into app from public.agency_applications where id = application_id for update;
  if not found then
    raise exception 'application not found';
  end if;
  if app.status <> 'pending' then
    raise exception 'application already processed';
  end if;

  insert into public.agencies (name, contact_email, created_by, status)
  select app.agency_name, p.email, app.applicant_id, 'active'
  from public.profiles p where p.id = app.applicant_id
  returning id into new_agency_id;

  insert into public.agency_members (agency_id, profile_id, role_in_agency, status)
  values (new_agency_id, app.applicant_id, 'owner', 'active');

  update public.agency_applications
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = application_id;

  perform public.promote_user_role(app.applicant_id, 'agent');

  return new_agency_id;
end;
$$;

create or replace function public.reject_agency_application(application_id uuid, notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins can reject agency applications';
  end if;

  update public.agency_applications
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_notes = notes
    where id = application_id and status = 'pending';
end;
$$;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;
alter table public.agency_applications enable row level security;

create policy "agencies: members read own agency"
  on public.agencies for select
  to authenticated
  using (public.is_agency_member(id));

create policy "agencies: admin full read"
  on public.agencies for select
  to authenticated
  using (public.is_admin());

create policy "agencies: admin manage"
  on public.agencies for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "agencies: owner update own agency"
  on public.agencies for update
  to authenticated
  using (public.is_agency_owner(id))
  with check (public.is_agency_owner(id));

create policy "agency_members: read own membership row"
  on public.agency_members for select
  to authenticated
  using (profile_id = auth.uid());

create policy "agency_members: read teammates"
  on public.agency_members for select
  to authenticated
  using (public.is_agency_member(agency_id));

create policy "agency_members: admin manage"
  on public.agency_members for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "agency_members: owner invites staff"
  on public.agency_members for insert
  to authenticated
  with check (public.is_agency_owner(agency_id) and role_in_agency = 'staff');

create policy "agency_members: owner removes staff"
  on public.agency_members for update
  to authenticated
  using (public.is_agency_owner(agency_id))
  with check (public.is_agency_owner(agency_id) and role_in_agency = 'staff');

create policy "agency_applications: applicant reads own"
  on public.agency_applications for select
  to authenticated
  using (applicant_id = auth.uid());

create policy "agency_applications: applicant submits"
  on public.agency_applications for insert
  to authenticated
  with check (applicant_id = auth.uid());

create policy "agency_applications: admin manage"
  on public.agency_applications for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
