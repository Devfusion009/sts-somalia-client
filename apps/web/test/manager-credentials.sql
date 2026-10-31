-- Empty isolated PostgreSQL database only. All fixture objects are rolled back.
begin;
create role anon; create role authenticated; create role service_role;
create schema auth; create schema extensions; create extension citext with schema extensions;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
create type public.app_role as enum ('customer','admin','hotel_manager','venue_manager');
create table auth.users(id uuid primary key,email text);
create table public.profiles(id uuid primary key references auth.users,email text,full_name text,role public.app_role default 'customer',status text default 'active');
grant update(full_name) on public.profiles to authenticated;
create table public.hotels(id uuid primary key,owner_id uuid);
create table public.event_venues(id uuid primary key,owner_id uuid);
create table public.hotel_managers(id uuid primary key default gen_random_uuid(),hotel_id uuid references public.hotels,profile_id uuid references public.profiles,status text default 'active',permissions text[] default '{}',created_by uuid, unique(hotel_id,profile_id));
create unique index hotel_managers_one_active_hotel_per_profile on public.hotel_managers(profile_id) where status='active';
create table public.venue_managers(id uuid primary key default gen_random_uuid(),venue_id uuid references public.event_venues,profile_id uuid references public.profiles,status text default 'active',permissions text[] default '{}',created_by uuid, unique(venue_id,profile_id));
create unique index venue_managers_one_active_venue_per_profile on public.venue_managers(profile_id) where status='active';
create function public.can_manage_hotel_managers(p_hotel_id uuid) returns boolean language sql stable as $$ select exists(select 1 from public.hotels where id=p_hotel_id and owner_id=auth.uid()) $$;
create function public.can_manage_venue_managers(p_venue_id uuid) returns boolean language sql stable as $$ select exists(select 1 from public.event_venues where id=p_venue_id and owner_id=auth.uid()) $$;
insert into auth.users values
 ('00000000-0000-4000-8000-000000000001','owner@example.test'),
 ('00000000-0000-4000-8000-000000000002','customer@example.test'),
 ('00000000-0000-4000-8000-000000000003','legacy@example.test'),
 ('00000000-0000-4000-8000-000000000004','dedicated@manager-login.scoutsts.invalid');
insert into public.profiles(id,email) select id,email from auth.users;
insert into public.hotels values ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002');
insert into public.event_venues values ('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001');
insert into public.hotel_managers(hotel_id,profile_id) values('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003');
create function public.add_venue_manager(
  p_venue_id uuid,
  p_email extensions.citext,
  p_permissions text[] default '{}'
)
returns public.venue_managers
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile_id uuid;
  target_role public.app_role;
  new_row public.venue_managers;
begin
  if not public.can_manage_venue_managers(p_venue_id) then
    raise exception 'You do not have permission to assign managers for this venue.';
  end if;

  select id, role into target_profile_id, target_role from public.profiles where email = p_email;
  if target_profile_id is null then
    raise exception 'No STS account found with that email.';
  end if;

  if exists (
    select 1 from public.venue_managers where profile_id = target_profile_id and status = 'active'
  ) then
    raise exception 'This person already manages another venue. Remove them from it first.';
  end if;

  -- A removed seat on this same venue is reactivated rather than duplicated
  -- (unique (venue_id, profile_id)).
  insert into public.venue_managers (venue_id, profile_id, created_by, permissions)
  values (p_venue_id, target_profile_id, auth.uid(), p_permissions)
  on conflict (venue_id, profile_id) do update
    set status = 'active', permissions = excluded.permissions, created_by = excluded.created_by
  returning * into new_row;

  if target_role = 'customer' then
    update public.profiles set role = 'venue_manager' where id = target_profile_id;
  end if;

  return new_row;
end;
$$;


\ir ../../../supabase/migrations/20261031000002_manager_credentials.sql
select set_config('test.uid','00000000-0000-4000-8000-000000000001',true);
insert into public.manager_login_credentials(contact_email,profile_id,password_encrypted) values('contact@example.test','00000000-0000-4000-8000-000000000004','ciphertext-test');
select public.add_hotel_manager('10000000-0000-4000-8000-000000000001','dedicated@manager-login.scoutsts.invalid',array['bookings']);
select public.add_venue_manager('20000000-0000-4000-8000-000000000001','dedicated@manager-login.scoutsts.invalid',array['photos']);
do $$ declare code text; n integer; begin
  select manager_code into code from public.profiles where id='00000000-0000-4000-8000-000000000004';
  if code<>(select manager_code from public.manager_login_credentials) then raise exception 'reserved code mismatch'; end if;
  if (select manager_code from public.profiles where email='legacy@example.test') is null then raise exception 'legacy manager not backfilled'; end if;
  if (select role from public.profiles where email='customer@example.test')<>'customer' then raise exception 'customer role changed'; end if;
  if public.manager_login_identity(lower(code))<>'dedicated@manager-login.scoutsts.invalid' then raise exception 'wrong manager login'; end if;
  if public.manager_login_identity('contact@example.test') is not null then raise exception 'email used as login'; end if;
  if (select contact_email from public.claim_manager_password_recovery(code))<>'contact@example.test' then raise exception 'wrong recovery email'; end if;
  select count(*) into n from public.claim_manager_password_recovery(code);if n<>0 then raise exception 'cooldown failed';end if;
  update public.hotel_managers set status='removed' where profile_id='00000000-0000-4000-8000-000000000004';
  if public.manager_login_identity(code) is null then raise exception 'venue access lost when hotel seat removed';end if;
  update public.venue_managers set status='removed' where profile_id='00000000-0000-4000-8000-000000000004';
  if public.manager_login_identity(code) is not null then raise exception 'removed manager can sign in';end if;
  perform public.add_hotel_manager('10000000-0000-4000-8000-000000000001','dedicated@manager-login.scoutsts.invalid',array['photos']);
  if (select manager_code from public.profiles where id='00000000-0000-4000-8000-000000000004')<>code then raise exception 'ID changed on reassignment';end if;
  if (select count(*) from public.hotel_managers where profile_id='00000000-0000-4000-8000-000000000004')<>1 then raise exception 'duplicate seat created';end if;
  update public.profiles set status='suspended' where id='00000000-0000-4000-8000-000000000004';
  if public.manager_login_identity(code) is not null then raise exception 'suspended manager can sign in';end if;
  if has_table_privilege('authenticated','public.manager_login_credentials','SELECT') then raise exception 'credential table exposed';end if;
  if has_column_privilege('authenticated','public.profiles','manager_code','UPDATE') then raise exception 'manager ID editable';end if;
  if has_function_privilege('authenticated','public.manager_login_identity(text)','EXECUTE') then raise exception 'identity lookup exposed';end if;
  if has_function_privilege('authenticated','public.claim_manager_password_recovery(text)','EXECUTE') then raise exception 'recovery lookup exposed';end if;
  perform setval('public.manager_code_seq',999999);if public.generate_manager_code() not like '%-1000000' then raise exception 'manager code truncated';end if;
end $$;
select set_config('test.uid','00000000-0000-4000-8000-000000000002',true);
do $$ begin
  begin perform public.add_hotel_manager('10000000-0000-4000-8000-000000000001','customer@example.test',array['bookings']);raise exception 'foreign owner assigned manager';
  exception when others then if sqlerrm not like '%permission%' then raise;end if;end;
  begin perform public.add_venue_manager('20000000-0000-4000-8000-000000000001','customer@example.test',array['photos']);raise exception 'foreign owner assigned venue manager';
  exception when others then if sqlerrm not like '%permission%' then raise;end if;end;
end $$;
rollback;
\echo 'Manager credential SQL checks passed.'
