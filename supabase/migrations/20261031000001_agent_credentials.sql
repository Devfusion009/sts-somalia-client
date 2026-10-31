-- Agent login identities are separate from the customer who submitted the application.
-- Only trusted server code can stage or read credentials. Plaintext passwords are
-- never stored; the encrypted delivery copy is erased after the email is accepted.
create or replace function public.generate_agent_code()
returns text language sql volatile security definer set search_path = public as $$
  select 'AGT-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, greatest(6, length(n::text)), '0')
  from (select nextval('public.agent_code_seq') n) s;
$$;
revoke execute on function public.generate_agent_code() from public, anon, authenticated;
grant execute on function public.generate_agent_code() to service_role;

-- lpad truncates rather than expands when its input exceeds the requested width.
create or replace function public.next_agency_agent_code()
returns text language sql volatile security definer set search_path = public as $$
  select 'STS' || lpad(n::text, greatest(3, length(n::text)), '0')
  from (select nextval('public.agency_agent_code_seq') n) s;
$$;

create table public.agent_login_credentials (
  application_id uuid primary key references public.agency_applications(id),
  agent_id text not null unique default public.generate_agent_code(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  login_email text not null unique,
  contact_email text not null,
  password_encrypted text,
  approved_at timestamptz,
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint agent_credentials_id_format check (agent_id ~ '^AGT-[0-9]{4}-[0-9]{6,}$')
);
alter table public.agent_login_credentials enable row level security;
revoke all on public.agent_login_credentials from public, anon, authenticated;
grant all on public.agent_login_credentials to service_role;

-- A personal ID belongs to a person, including existing team members, not an agency.
update public.profiles p set agent_code = public.generate_agent_code()
where p.agent_code is null and exists (select 1 from public.agency_members m where m.profile_id = p.id);
create function public.agency_members_assign_personal_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set agent_code = coalesce(agent_code, public.generate_agent_code()) where id = new.profile_id;
  return new;
end;
$$;
create trigger agency_members_assign_personal_id before insert on public.agency_members
for each row execute function public.agency_members_assign_personal_id();

create or replace function public.approve_agency_application(
  application_id uuid,
  p_allowed_products public.order_item_type[] default null,
  p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  app public.agency_applications;
  credential public.agent_login_credentials;
  new_agency_id uuid;
  v_markup numeric;
begin
  if not public.is_admin() then raise exception 'only admins can approve agency applications'; end if;
  select * into app from public.agency_applications where id = application_id for update;
  if not found then raise exception 'application not found'; end if;
  if app.status not in ('pending', 'under_review') then raise exception 'application already processed'; end if;
  if app.reference_number is null then raise exception 'application has no reference number'; end if;
  select * into credential from public.agent_login_credentials c where c.application_id = app.id for update;
  if not found or credential.profile_id is null or credential.password_encrypted is null then
    raise exception 'Agent credentials must be prepared before approval.';
  end if;
  if not exists (select 1 from auth.users u where u.id = credential.profile_id
    and u.email = credential.login_email and u.raw_app_meta_data->>'agent_application_id' = app.id::text) then
    raise exception 'Agent identity is not valid.';
  end if;

  insert into public.agencies (name, contact_email, created_by, status, allowed_products)
  values (app.agency_name, credential.contact_email, app.applicant_id, 'active',
    coalesce(p_allowed_products, array['flight','hotel','visa','umrah','hall']::public.order_item_type[]))
  returning id into new_agency_id;

  v_markup := nullif(app.business_details->>'requestedMarkupPercent', '')::numeric;
  if v_markup is not null and v_markup >= 0 and v_markup <= 100 then
    insert into public.agency_markups (agency_id, item_type, markup_type, value)
    values (new_agency_id, null, 'percent', v_markup);
  end if;
  update public.profiles set role = 'agent', agent_code = credential.agent_id where id = credential.profile_id;
  insert into public.agency_members (agency_id, profile_id, role_in_agency, status)
  values (new_agency_id, credential.profile_id, 'owner', 'active');
  update public.agency_applications set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now() where id = app.id;
  update public.agent_login_credentials set approved_at = now() where agent_login_credentials.application_id = app.id;
  insert into public.partner_accounts (id, type, application_id, entity_id, created_by)
  values (app.reference_number, 'agency', app.id, new_agency_id, auth.uid());
  insert into public.partner_account_events (account_id, actor, action, to_status, reason)
  values (app.reference_number, auth.uid(), 'account_created', 'onboarding', p_note);
  return new_agency_id;
end;
$$;

-- Resolve ID to the actual auth identity only on the server. Contact email is
-- deliberately not a login key. Legacy agents keep their existing password.
create function public.agent_login_identity(p_agent_id text)
returns text language sql stable security definer set search_path = public as $$
  select u.email::text from public.profiles p join auth.users u on u.id = p.id
  where p.agent_code = upper(btrim(p_agent_id)) and p.status = 'active'
    and exists (select 1 from public.agency_members m join public.agencies a on a.id = m.agency_id
      where m.profile_id = p.id and m.status = 'active' and a.status = 'active')
  limit 1;
$$;
revoke execute on function public.agent_login_identity(text) from public, anon, authenticated;
grant execute on function public.agent_login_identity(text) to service_role;

create function public.my_agent_application_login(p_application_id uuid)
returns table(agent_id text, contact_email text) language sql stable security definer set search_path = public as $$
  select c.agent_id, c.contact_email from public.agent_login_credentials c
  join public.agency_applications a on a.id = c.application_id
  where a.id = p_application_id and a.applicant_id = auth.uid() and a.status = 'approved';
$$;
revoke execute on function public.my_agent_application_login(uuid) from public, anon;
grant execute on function public.my_agent_application_login(uuid) to authenticated;

-- Retire the old code+username lookup; only the personal ID resolves a login.
revoke execute on function public.agent_login_email(text, text) from service_role;

create table public.agent_password_recovery_limits (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now()
);
alter table public.agent_password_recovery_limits enable row level security;
revoke all on public.agent_password_recovery_limits from public, anon, authenticated;
grant all on public.agent_password_recovery_limits to service_role;

-- Atomic per-identity cooldown also covers legacy agency members.
create function public.claim_agent_password_recovery(p_agent_id text)
returns table(login_email text, contact_email text) language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select p.id into v_id from public.profiles p where p.agent_code = upper(btrim(p_agent_id))
    and p.status = 'active' and exists (
      select 1 from public.agency_members m join public.agencies a on a.id = m.agency_id
      where m.profile_id = p.id and m.status = 'active' and a.status = 'active');
  if v_id is null then return; end if;
  insert into public.agent_password_recovery_limits as r(profile_id, requested_at) values (v_id, now())
  on conflict (profile_id) do update set requested_at = excluded.requested_at
    where r.requested_at < now() - interval '5 minutes';
  if not found then return; end if;
  return query select u.email::text, coalesce(c.contact_email, u.email::text)
    from auth.users u left join public.agent_login_credentials c on c.profile_id = u.id and c.approved_at is not null
    where u.id = v_id;
end;
$$;
revoke execute on function public.claim_agent_password_recovery(text) from public, anon, authenticated;
grant execute on function public.claim_agent_password_recovery(text) to service_role;
