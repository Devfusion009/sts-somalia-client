-- Every agent gets a personal, human-readable Agent ID — display-only (login
-- stays email + password), shown on the agent portal's login page, sidebar
-- and security page so an agent has something short to quote to support.
-- Distinct from an agency's own reference_number (STS-TA-...), which
-- identifies the agency/application, not the individual person: one agency
-- can have several staff members, each promoted to role 'agent' in turn,
-- and each needs their own code.

create sequence public.agent_code_seq;

create or replace function public.generate_agent_code()
returns text
language sql
as $$
  select 'AGT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.agent_code_seq')::text, 6, '0');
$$;

alter table public.profiles add column agent_code text unique;

-- Assigned at the same moment role flips to 'agent', inside the approval
-- flow — never editable afterward (no client update grant reaches this
-- column; see 20260101000002_roles_and_profiles.sql's revoke/grant pair,
-- which this column is deliberately left out of).
create or replace function public.approve_agency_application(
  application_id uuid,
  p_allowed_products public.order_item_type[] default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.agency_applications;
  new_agency_id uuid;
  v_markup numeric;
begin
  if not public.is_admin() then
    raise exception 'only admins can approve agency applications';
  end if;

  select * into app from public.agency_applications where id = application_id for update;
  if not found then
    raise exception 'application not found';
  end if;
  if app.status not in ('pending', 'under_review') then
    raise exception 'application already processed';
  end if;
  if app.reference_number is null then
    raise exception 'application has no reference number';
  end if;

  insert into public.agencies (name, contact_email, created_by, status, allowed_products)
  select app.agency_name, p.email, app.applicant_id, 'active',
         coalesce(p_allowed_products, array['flight','hotel','visa','umrah','hall']::public.order_item_type[])
  from public.profiles p where p.id = app.applicant_id
  returning id into new_agency_id;

  v_markup := nullif(app.business_details->>'requestedMarkupPercent', '')::numeric;
  if v_markup is not null and v_markup >= 0 and v_markup <= 100 then
    insert into public.agency_markups (agency_id, item_type, markup_type, value)
    values (new_agency_id, null, 'percent', v_markup);
  end if;

  insert into public.agency_members (agency_id, profile_id, role_in_agency, status)
  values (new_agency_id, app.applicant_id, 'owner', 'active');

  update public.agency_applications
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = application_id;

  perform public.promote_user_role(app.applicant_id, 'agent');

  update public.profiles
    set agent_code = coalesce(agent_code, public.generate_agent_code())
    where id = app.applicant_id;

  insert into public.partner_accounts (id, type, application_id, entity_id, created_by)
  values (app.reference_number, 'agency', application_id, new_agency_id, auth.uid());

  insert into public.partner_account_events (account_id, actor, action, to_status, reason)
  values (app.reference_number, auth.uid(), 'account_created', 'onboarding', p_note);

  return new_agency_id;
end;
$$;

-- Backfill: agents approved before this migration existed get a code too.
update public.profiles set agent_code = public.generate_agent_code()
where role = 'agent' and agent_code is null;
