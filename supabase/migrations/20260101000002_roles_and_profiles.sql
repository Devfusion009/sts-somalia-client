-- ============================================================================
-- Roles & Profiles
-- ============================================================================
-- profiles.role is the coarse "which portal does this user land in" role.
-- It is NEVER settable by the user themselves (see handle_new_user + the
-- lack of any client-writable policy on the role column). Promotion to
-- agent / hotel_partner / affiliate happens through the application tables
-- in later migrations, which an admin approves via a SECURITY DEFINER
-- function. This keeps privilege escalation impossible from the client.

create type public.app_role as enum (
  'customer',
  'agent',        -- B2B travel agent (agency staff)
  'hotel_partner', -- hotel partner portal user
  'affiliate',     -- affiliate marketer
  'admin'          -- internal STS staff
);

create type public.account_status as enum (
  'active',
  'suspended',
  'pending_verification'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'customer',
  full_name text,
  email citext,
  phone text,
  avatar_url text,
  country_code text,
  status public.account_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per auth.users, holds the coarse portal role used by RLS.';
comment on column public.profiles.role is 'Client cannot write this column directly; promotions go through admin-approved application flows.';

create index profiles_role_idx on public.profiles (role);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Auto-create a profile whenever a new auth user signs up.
-- Role always starts as 'customer' regardless of client-supplied metadata,
-- to prevent self-elevation. Admins/agencies invite privileged users through
-- separate, controlled paths (see agencies/hotel_partners/affiliates).
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- RLS helper functions (SECURITY DEFINER + fixed search_path so they cannot
-- be tricked by a caller-controlled search_path, and STABLE so the planner
-- can cache the result within a statement).
-- ----------------------------------------------------------------------------
create or replace function public.current_role()
returns public.app_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.has_role(check_role public.app_role)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = check_role
  );
$$;

-- Promote a user's role. Only callable by an existing admin (checked inside).
-- Application-approval triggers (later migrations) call this via
-- `perform public.promote_user_role(...)` from their own SECURITY DEFINER
-- approval functions, so the direct grant below stays admin-only.
create or replace function public.promote_user_role(target_user_id uuid, new_role public.app_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins can promote user roles';
  end if;

  update public.profiles set role = new_role where id = target_user_id;
end;
$$;

-- Suspend/reactivate an account. Only callable by an existing admin.
-- Like promote_user_role, this keeps role/status changes auditable and
-- funneled through one code path even for admins (column grants below
-- block direct table UPDATEs of these two columns for every client role).
create or replace function public.set_account_status(target_user_id uuid, new_status public.account_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins can change account status';
  end if;

  update public.profiles set status = new_status where id = target_user_id;
end;
$$;

alter table public.profiles enable row level security;

create policy "profiles: self read"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles: admin read all"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

create policy "profiles: self update"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Only expose safe, self-editable columns to authenticated role updates.
-- role/status remain writable only via promote_user_role/set_account_status
-- (SECURITY DEFINER, owned by postgres) which bypass column privileges.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, avatar_url, country_code, metadata) on public.profiles to authenticated;

create policy "profiles: admin update all"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
