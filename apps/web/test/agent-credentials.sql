-- Run only in an isolated empty PostgreSQL database, with ON_ERROR_STOP enabled.
-- Minimal surrounding schema; the actual migration is included unchanged.
begin;
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create type public.order_item_type as enum ('flight','hotel','visa','umrah','hall');
create table auth.users(id uuid primary key, email text, raw_app_meta_data jsonb default '{}');
create table public.profiles(id uuid primary key references auth.users, email text, role text default 'customer', status text default 'active', agent_code text unique);
create sequence public.agent_code_seq;
create sequence public.agency_agent_code_seq;
create function public.is_admin() returns boolean language sql stable security definer as $$ select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false) $$;
create table public.agency_applications(id uuid primary key, applicant_id uuid, status text default 'under_review', agency_name text, reference_number text unique, business_details jsonb default '{}', reviewed_by uuid, reviewed_at timestamptz);
create table public.agencies(id uuid primary key default gen_random_uuid(), name text, contact_email text, created_by uuid, status text, allowed_products public.order_item_type[]);
create table public.agency_members(id uuid default gen_random_uuid(), agency_id uuid, profile_id uuid, role_in_agency text, status text);
create table public.agency_markups(agency_id uuid, item_type public.order_item_type, markup_type text, value numeric);
create table public.partner_accounts(id text primary key, type text, application_id uuid, entity_id uuid, created_by uuid);
create table public.partner_account_events(account_id text, actor uuid, action text, to_status text, reason text);
create function public.agent_login_email(text,text) returns text language sql as $$ select null::text $$;
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-000000000001','admin@example.test'),
 ('00000000-0000-0000-0000-000000000002','customer@example.test'),
 ('00000000-0000-0000-0000-000000000003','internal@agent-login.scoutsts.invalid');
insert into public.profiles(id,email,role) select id,email,case when email = 'admin@example.test' then 'admin' else 'customer' end from auth.users;
insert into public.agency_applications(id,applicant_id,agency_name,reference_number,business_details) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Test agency','STS-TA-TEST', '{"requestedMarkupPercent":7}');
update auth.users set raw_app_meta_data = '{"agent_application_id":"10000000-0000-0000-0000-000000000001"}' where id = '00000000-0000-0000-0000-000000000003';
\ir ../../../supabase/migrations/20261031000001_agent_credentials.sql

select set_config('test.uid','00000000-0000-0000-0000-000000000002', true);
do $$ begin
  begin perform public.approve_agency_application('10000000-0000-0000-0000-000000000001'); raise exception 'customer approved application';
  exception when others then if sqlerrm not like '%only admins%' then raise; end if; end;
end $$;
select set_config('test.uid','00000000-0000-0000-0000-000000000001', true);
do $$ begin
  begin perform public.approve_agency_application('10000000-0000-0000-0000-000000000001'); raise exception 'approval without staged identity succeeded';
  exception when others then if sqlerrm not like '%must be prepared%' then raise; end if; end;
end $$;
insert into public.agent_login_credentials(application_id,profile_id,login_email,contact_email,password_encrypted)
values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','internal@agent-login.scoutsts.invalid','contact@example.test','encrypted-test-only');
select public.approve_agency_application('10000000-0000-0000-0000-000000000001');

do $$ declare agent_id text; login text; n int; begin
  select c.agent_id into agent_id from public.agent_login_credentials c;
  if not agent_id ~ '^AGT-[0-9]{4}-[0-9]{6,}$' then raise exception 'invalid personal agent ID'; end if;
  if (select role from public.profiles where email='customer@example.test') <> 'customer' then raise exception 'customer role changed'; end if;
  if exists(select 1 from public.agency_members where profile_id='00000000-0000-0000-0000-000000000002') then raise exception 'applicant became agent owner'; end if;
  if (select contact_email from public.agencies limit 1) <> 'contact@example.test' then raise exception 'wrong agency contact'; end if;
  select public.agent_login_identity(lower(agent_id)) into login;
  if login <> 'internal@agent-login.scoutsts.invalid' then raise exception 'wrong login identity'; end if;
  if public.agent_login_identity('contact@example.test') is not null then raise exception 'contact email accepted as login'; end if;
  update public.agencies set status='suspended';
  if public.agent_login_identity(agent_id) is not null then raise exception 'suspended agency allowed login'; end if;
  update public.agencies set status='active';
  select count(*) into n from public.claim_agent_password_recovery(agent_id);
  if n <> 1 then raise exception 'first recovery denied'; end if;
  select count(*) into n from public.claim_agent_password_recovery(agent_id);
  if n <> 0 then raise exception 'recovery cooldown failed'; end if;
  begin perform public.approve_agency_application('10000000-0000-0000-0000-000000000001'); raise exception 'duplicate approval succeeded';
  exception when others then if sqlerrm not like '%already processed%' then raise; end if; end;
  if (select count(*) from public.agencies) <> 1 then raise exception 'duplicate agency created'; end if;
  if has_table_privilege('authenticated','public.agent_login_credentials','SELECT') then raise exception 'credentials readable by client'; end if;
  if has_function_privilege('authenticated','public.agent_login_identity(text)','EXECUTE') then raise exception 'login lookup exposed'; end if;
  if has_function_privilege('authenticated','public.claim_agent_password_recovery(text)','EXECUTE') then raise exception 'recovery lookup exposed'; end if;
  perform setval('public.agency_agent_code_seq', 999);
  if public.next_agency_agent_code() <> 'STS1000' then raise exception 'agency code truncated'; end if;
  perform setval('public.agent_code_seq', 999999);
  if public.generate_agent_code() not like '%-1000000' then raise exception 'personal ID truncated'; end if;
end $$;
select set_config('test.uid','00000000-0000-0000-0000-000000000002', true);
do $$ begin
  if (select count(*) from public.my_agent_application_login('10000000-0000-0000-0000-000000000001')) <> 1 then raise exception 'applicant cannot view own ID'; end if;
end $$;
select set_config('test.uid','00000000-0000-0000-0000-000000000003', true);
do $$ begin
  if (select count(*) from public.my_agent_application_login('10000000-0000-0000-0000-000000000001')) <> 0 then raise exception 'other identity can read applicant view'; end if;
end $$;
rollback;
\echo 'Agent credential SQL checks passed.'
