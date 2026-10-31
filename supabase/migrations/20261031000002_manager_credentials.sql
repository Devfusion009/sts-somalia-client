-- One personal manager ID across hotel and venue assignments. New manager
-- identities are distinct from customer accounts using the same contact email.
create sequence public.manager_code_seq;
create function public.generate_manager_code() returns text language sql volatile security definer set search_path = public as $$
  select 'MGR-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, greatest(6,length(n::text)), '0')
  from (select nextval('public.manager_code_seq') n) s;
$$;
revoke execute on function public.generate_manager_code() from public, anon, authenticated;
grant execute on function public.generate_manager_code() to service_role;

alter table public.profiles add column manager_code text unique;
alter table public.profiles add column manager_contact_email text;
create table public.manager_login_credentials (
  id uuid primary key default gen_random_uuid(),
  manager_code text not null unique default public.generate_manager_code(),
  contact_email text not null unique check (contact_email = lower(btrim(contact_email))),
  profile_id uuid unique references public.profiles(id) on delete set null,
  password_encrypted text,
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  check (manager_code ~ '^MGR-[0-9]{4}-[0-9]{6,}$')
);
alter table public.manager_login_credentials enable row level security;
revoke all on public.manager_login_credentials from public, anon, authenticated;
grant all on public.manager_login_credentials to service_role;

update public.profiles p set manager_code = public.generate_manager_code(), manager_contact_email = p.email::text
where exists(select 1 from public.hotel_managers h where h.profile_id = p.id)
   or exists(select 1 from public.venue_managers v where v.profile_id = p.id);

create function public.assign_personal_manager_code() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles p set
    manager_code = coalesce(p.manager_code, (select c.manager_code from public.manager_login_credentials c where c.profile_id=p.id), public.generate_manager_code()),
    manager_contact_email = coalesce(p.manager_contact_email, (select c.contact_email from public.manager_login_credentials c where c.profile_id=p.id), p.email::text)
  where p.id = new.profile_id;
  return new;
end;
$$;
create trigger hotel_managers_assign_personal_code before insert or update of profile_id on public.hotel_managers
for each row execute function public.assign_personal_manager_code();
create trigger venue_managers_assign_personal_code before insert or update of profile_id on public.venue_managers
for each row execute function public.assign_personal_manager_code();

create function public.manager_login_identity(p_manager_code text) returns text language sql stable security definer set search_path=public as $$
  select u.email::text from public.profiles p join auth.users u on u.id=p.id
  where p.manager_code=upper(btrim(p_manager_code)) and p.status='active'
    and (exists(select 1 from public.hotel_managers h where h.profile_id=p.id and h.status='active')
      or exists(select 1 from public.venue_managers v where v.profile_id=p.id and v.status='active'))
  limit 1;
$$;
revoke execute on function public.manager_login_identity(text) from public, anon, authenticated;
grant execute on function public.manager_login_identity(text) to service_role;

create table public.manager_password_recovery_limits (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now()
);
alter table public.manager_password_recovery_limits enable row level security;
revoke all on public.manager_password_recovery_limits from public, anon, authenticated;
grant all on public.manager_password_recovery_limits to service_role;
create function public.claim_manager_password_recovery(p_manager_code text)
returns table(login_email text,contact_email text) language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  select p.id into v_id from public.profiles p where p.manager_code=upper(btrim(p_manager_code))
    and p.status='active' and (exists(select 1 from public.hotel_managers h where h.profile_id=p.id and h.status='active')
      or exists(select 1 from public.venue_managers v where v.profile_id=p.id and v.status='active'));
  if v_id is null then return; end if;
  insert into public.manager_password_recovery_limits as r(profile_id,requested_at) values(v_id,now())
  on conflict(profile_id) do update set requested_at=excluded.requested_at where r.requested_at<now()-interval '5 minutes';
  if not found then return; end if;
  return query select u.email::text,coalesce(c.contact_email,p.manager_contact_email,u.email::text)
    from auth.users u join public.profiles p on p.id=u.id
    left join public.manager_login_credentials c on c.profile_id=u.id where u.id=v_id;
end;
$$;
revoke execute on function public.claim_manager_password_recovery(text) from public, anon, authenticated;
grant execute on function public.claim_manager_password_recovery(text) to service_role;

-- Reassigning a removed hotel seat must reactivate it, preserving the personal
-- ID. Authorization and the one-active-hotel constraint stay in place.
create or replace function public.add_hotel_manager(p_hotel_id uuid,p_email extensions.citext,p_permissions text[] default '{}')
returns public.hotel_managers language plpgsql security definer set search_path=public as $$
declare target_profile_id uuid; target_role public.app_role; new_row public.hotel_managers;
begin
  if not public.can_manage_hotel_managers(p_hotel_id) then raise exception 'You do not have permission to assign managers for this hotel.'; end if;
  select id,role into target_profile_id,target_role from public.profiles where email=p_email;
  if target_profile_id is null then raise exception 'No STS account found with that email.'; end if;
  if exists(select 1 from public.hotel_managers where profile_id=target_profile_id and status='active') then
    raise exception 'This person already manages another hotel. Remove them from it first.';
  end if;
  insert into public.hotel_managers(hotel_id,profile_id,created_by,permissions)
  values(p_hotel_id,target_profile_id,auth.uid(),p_permissions)
  on conflict(hotel_id,profile_id) do update set status='active',permissions=excluded.permissions,created_by=excluded.created_by
  returning * into new_row;
  if target_role='customer' then update public.profiles set role='hotel_manager' where id=target_profile_id; end if;
  return new_row;
end;
$$;
