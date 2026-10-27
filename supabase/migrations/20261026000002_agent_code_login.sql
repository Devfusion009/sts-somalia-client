-- Agent code + username sign-in for the B2B Agent Portal.
--
-- Every agency gets a short agent code (STS001, STS002, ...) the moment its
-- row is created, which only happens when an admin approves the agency's
-- application (approve_agency_application) or an admin creates it. Every
-- agency member gets a username, unique inside that agency, derived from the
-- member's account email; the member or the agency owner/admin can change it.
--
-- /agent/login takes agent code + username + password. The server resolves
-- the pair to the member's account email with agent_login_email() (service
-- role only) and signs in with that email, so no email ever reaches the
-- browser and the password stays the member's own STS account password.
--
-- Also closes a gap found while adding the code: agency owners and admins
-- could update every column of their own agency row through the API,
-- including credit_balance, credit_limit, commission_rate and status. Those
-- columns and agent_code now change only from platform-admin sessions,
-- the service role, or security-definer functions (the wallet ledger).
--
-- profiles.agent_code (AGT-YYYY-NNNNNN, 20260920000001) is no longer shown
-- anywhere; the column is left in place.

-- ----------------------------------------------------------------------------
-- 1. Agent code on agencies
-- ----------------------------------------------------------------------------
create sequence if not exists public.agency_agent_code_seq;

create or replace function public.next_agency_agent_code()
returns text
language sql
volatile
set search_path = public
as $$
  select 'STS' || lpad(nextval('public.agency_agent_code_seq')::text, 3, '0');
$$;

revoke execute on function public.next_agency_agent_code() from public, anon, authenticated;

alter table public.agencies add column if not exists agent_code text;

-- Existing agencies, oldest first, so the first approved agency is STS001.
do $$
declare
  r record;
begin
  for r in select id from public.agencies where agent_code is null order by created_at, id loop
    update public.agencies set agent_code = public.next_agency_agent_code() where id = r.id;
  end loop;
end;
$$;

alter table public.agencies
  alter column agent_code set not null,
  add constraint agencies_agent_code_format check (agent_code ~ '^[A-Z0-9]{3,20}$'),
  add constraint agencies_agent_code_key unique (agent_code);

create or replace function public.agencies_assign_agent_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.agent_code is null then
    new.agent_code := public.next_agency_agent_code();
  end if;
  return new;
end;
$$;

drop trigger if exists agencies_assign_agent_code on public.agencies;
create trigger agencies_assign_agent_code
  before insert on public.agencies
  for each row execute function public.agencies_assign_agent_code();

-- SECURITY INVOKER on purpose: current_user is 'authenticated' for a direct
-- API update and the function owner inside security-definer functions such
-- as apply_agency_wallet_transaction, which must keep moving credit_balance.
create or replace function public.agencies_guard_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if new.agent_code is distinct from old.agent_code
       or new.credit_balance is distinct from old.credit_balance
       or new.credit_limit is distinct from old.credit_limit
       or new.commission_rate is distinct from old.commission_rate
       or new.commission_rate_set_at is distinct from old.commission_rate_set_at
       or new.status is distinct from old.status
       or new.tier_id is distinct from old.tier_id
       or new.allowed_products is distinct from old.allowed_products
       or new.created_by is distinct from old.created_by then
      raise exception using
        errcode = '42501',
        message = 'Only STS can change this agency setting.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists agencies_guard_privileged_columns on public.agencies;
create trigger agencies_guard_privileged_columns
  before update on public.agencies
  for each row execute function public.agencies_guard_privileged_columns();

-- ----------------------------------------------------------------------------
-- 2. Username on agency members
-- ----------------------------------------------------------------------------
-- "Ahmed.Hassan+ops@mail.com" -> "ahmed.hassan" style: the email's local
-- part, lower-cased, reduced to [a-z0-9._-], starting with a letter or digit,
-- at least 3 characters ("agent" prefix when shorter), at most 24 so a
-- numeric suffix still fits the 30-character limit.
create or replace function public.agent_username_base(p_email text)
returns text
language sql
immutable
set search_path = public
as $$
  with cleaned as (
    select regexp_replace(
             regexp_replace(lower(split_part(coalesce(p_email, ''), '@', 1)), '[^a-z0-9._-]', '', 'g'),
             '^[^a-z0-9]+', ''
           ) as v
  )
  select case when length(v) >= 3 then left(v, 24) else left('agent' || v, 24) end
    from cleaned;
$$;

-- First free username in the agency: base, base2, base3, ...
create or replace function public.next_agent_username(p_agency_id uuid, p_base text)
returns text
language plpgsql
set search_path = public
as $$
declare
  v text := p_base;
  n integer := 1;
begin
  while exists (
    select 1 from public.agency_members where agency_id = p_agency_id and username = v
  ) loop
    n := n + 1;
    v := left(p_base, 27) || n::text;
  end loop;
  return v;
end;
$$;

revoke execute on function public.next_agent_username(uuid, text) from public, anon, authenticated;

alter table public.agency_members add column if not exists username text;

do $$
declare
  r record;
begin
  for r in
    select m.id, m.agency_id, p.email::text as email
      from public.agency_members m
      join public.profiles p on p.id = m.profile_id
     where m.username is null
     order by m.agency_id, (m.role_in_agency = 'owner') desc, m.created_at, m.id
  loop
    update public.agency_members
       set username = public.next_agent_username(r.agency_id, public.agent_username_base(r.email))
     where id = r.id;
  end loop;
end;
$$;

alter table public.agency_members
  alter column username set not null,
  add constraint agency_members_username_format check (username ~ '^[a-z0-9][a-z0-9._-]{2,29}$');

create unique index if not exists agency_members_agency_username_key
  on public.agency_members (agency_id, username);

-- Security definer: the inserting owner/admin can't read the new member's
-- profile email under RLS, and the username is derived from it.
create or replace function public.agency_members_assign_username()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if new.username is null then
    perform pg_advisory_xact_lock(hashtextextended('agency_username:' || new.agency_id::text, 0));
    select email::text into v_email from public.profiles where id = new.profile_id;
    new.username := public.next_agent_username(new.agency_id, public.agent_username_base(v_email));
  else
    new.username := lower(btrim(new.username));
  end if;
  return new;
end;
$$;

drop trigger if exists agency_members_assign_username on public.agency_members;
create trigger agency_members_assign_username
  before insert on public.agency_members
  for each row execute function public.agency_members_assign_username();

-- The member themself, their agency's owner/admin, or a platform admin.
create or replace function public.set_agent_username(p_member_id uuid, p_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.agency_members;
  v text := lower(btrim(coalesce(p_username, '')));
begin
  select * into m from public.agency_members where id = p_member_id;
  if not found
     or not (m.profile_id = auth.uid() or public.is_agency_owner_or_admin(m.agency_id) or public.is_admin()) then
    raise exception using errcode = '42501', message = 'Not allowed.';
  end if;

  if v !~ '^[a-z0-9][a-z0-9._-]{2,29}$' then
    raise exception using
      errcode = '22023',
      message = 'Use 3–30 lowercase letters, numbers, dots, dashes or underscores, starting with a letter or number.';
  end if;

  if v = m.username then
    return v;
  end if;

  begin
    update public.agency_members set username = v where id = p_member_id;
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'That username is already taken in this agency.';
  end;
  return v;
end;
$$;

revoke execute on function public.set_agent_username(uuid, text) from public, anon;
grant execute on function public.set_agent_username(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Sign-in lookup (server only)
-- ----------------------------------------------------------------------------
create or replace function public.agent_login_email(p_agent_code text, p_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.email::text
    from public.agencies a
    join public.agency_members m on m.agency_id = a.id
    join public.profiles p on p.id = m.profile_id
   where a.agent_code = upper(btrim(p_agent_code))
     and m.username = lower(btrim(p_username))
     and m.status = 'active'
   limit 1;
$$;

revoke execute on function public.agent_login_email(text, text) from public, anon, authenticated;
grant execute on function public.agent_login_email(text, text) to service_role;
