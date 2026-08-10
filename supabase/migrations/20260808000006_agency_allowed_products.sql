-- ============================================================================
-- Restricts an agency to the product verticals it's actually approved for.
-- Empty array = unrestricted (matches every existing agency's behavior
-- today, so nothing already approved loses access). A non-empty array
-- restricts booking to exactly those verticals — enforced server-side in
-- each booking action via assertAgencyCanBookProduct(), not just hidden in
-- the UI, so it can't be bypassed by calling the action directly.
-- ============================================================================

alter table public.agencies
  add column allowed_products public.order_item_type[] not null default '{}';

-- approve_agency_application gains an optional p_allowed_products param —
-- existing single-arg callers (application_id only) are unaffected since it
-- defaults to null, which the insert coalesces to '{}' (unrestricted).
create or replace function public.approve_agency_application(
  application_id uuid,
  p_allowed_products public.order_item_type[] default null
)
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

  insert into public.agencies (name, contact_email, created_by, status, allowed_products)
  select app.agency_name, p.email, app.applicant_id, 'active', coalesce(p_allowed_products, '{}')
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
