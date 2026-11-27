-- Isolated schema fixture. Never run this file against an application database.
\set ON_ERROR_STOP on
begin;
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
create function public.is_admin() returns boolean language sql stable as $$ select coalesce(current_setting('test.admin', true), 'false') = 'true' $$;
create type public.partner_account_status as enum ('onboarding', 'live', 'suspended', 'offboarded');
create table public.partner_accounts(id text primary key, type text, entity_id uuid, status public.partner_account_status, went_live_at timestamptz, suspended_at timestamptz, offboarded_at timestamptz);
create table public.partner_account_events(account_id text, actor uuid, action text, from_status text, to_status text, reason text);
create table public.agencies(id uuid primary key, status text);
create table public.hotel_partners(id uuid primary key, status text);
create table public.venue_partners(id uuid primary key, status text);
create table public.affiliates(id uuid primary key, status text);
create table auth.users(id uuid primary key, email text);
create table public.profiles(id uuid primary key, agent_code text, status text);
create table public.agency_members(agency_id uuid, profile_id uuid, status text);
\ir ../../../supabase/migrations/20261127000001_partner_status_transition.sql
insert into public.agencies values ('00000000-0000-0000-0000-000000000002','active');
insert into public.partner_accounts values ('agent','agency','00000000-0000-0000-0000-000000000002','onboarding',null,null,null);
insert into auth.users values ('00000000-0000-0000-0000-000000000003','agent@test.invalid');
insert into public.profiles values ('00000000-0000-0000-0000-000000000003','AGT-TEST','active');
insert into public.agency_members values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','active');

-- Non-admin calls must leave operational access and history unchanged.
do $$ begin
  begin perform public.transition_partner_account('agent','onboarding','suspended');
    raise exception 'unauthorized transition accepted';
  exception when others then
    if sqlerrm <> 'Only platform admins can change partner status.' then raise; end if;
  end;
end $$;
set test.admin = 'true';
select public.transition_partner_account('agent','onboarding','suspended');
do $$ begin
  if (select status from public.agencies limit 1) <> 'suspended' then raise exception 'operational suspension missing'; end if;
  if (select status from public.partner_accounts where id='agent') <> 'suspended' then raise exception 'console suspension missing'; end if;
  if (select count(*) from public.partner_account_events where action='suspended' and reason is null) <> 1 then raise exception 'audit missing'; end if;
  if public.agent_login_identity('agt-test') <> 'agent@test.invalid' then raise exception 'suspended agent cannot authenticate to notice'; end if;
  begin perform public.transition_partner_account('agent','onboarding','suspended');
    raise exception 'stale change accepted';
  exception when others then
    if sqlerrm <> 'Account status changed. Reload and try again.' then raise; end if;
  end;
end $$;
select public.transition_partner_account('agent','suspended','live');
do $$ begin
  if (select status from public.agencies limit 1) <> 'active' then raise exception 'reactivation failed'; end if;
end $$;

-- Audit errors roll back both status writes.
create function reject_test_event() returns trigger language plpgsql as $$ begin raise exception 'test audit unavailable'; end $$;
create trigger test_audit_error before insert on public.partner_account_events for each row execute function reject_test_event();
do $$ begin
  begin perform public.transition_partner_account('agent','live','suspended');
    raise exception 'audit failure ignored';
  exception when others then if sqlerrm <> 'test audit unavailable' then raise; end if; end;
  if (select status from public.agencies limit 1) <> 'active' or (select status from public.partner_accounts where id='agent') <> 'live' then raise exception 'partial transition committed'; end if;
end $$;
drop trigger test_audit_error on public.partner_account_events;

-- Missing operational entities cannot produce a false success.
insert into public.partner_accounts values ('missing','agency','00000000-0000-0000-0000-000000000099','live',null,null,null);
do $$ begin
  begin perform public.transition_partner_account('missing','live','suspended');
    raise exception 'missing entity accepted';
  exception when others then if sqlerrm <> 'Partner entity not found.' then raise; end if; end;
  if (select status from public.partner_accounts where id='missing') <> 'live' then raise exception 'missing entity changed console'; end if;
end $$;
select public.transition_partner_account('agent','live','offboarded');
do $$ begin
  if public.agent_login_identity('AGT-TEST') is not null then raise exception 'offboarded account allowed login'; end if;
  begin perform public.transition_partner_account('agent','offboarded','live');
    raise exception 'offboarded account reinstated';
  exception when others then if sqlerrm <> 'This status change is not available.' then raise; end if; end;
  if has_function_privilege('anon','public.transition_partner_account(text,public.partner_account_status,public.partner_account_status,text)','execute') then raise exception 'public transition exposed'; end if;
  if has_function_privilege('authenticated','public.agent_login_identity(text)','execute') then raise exception 'login identity exposed'; end if;
end $$;
rollback;
\echo 'Partner suspension, reactivation, rollback, stale writes, auth restrictions and offboarding passed.'
