-- Commit operational access, console status and audit history together.
create or replace function public.transition_partner_account(
  p_account_id text,
  p_expected_status public.partner_account_status,
  p_to_status public.partner_account_status,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  account public.partner_accounts;
  entity_table text;
  changed integer;
begin
  if not public.is_admin() then
    raise exception 'Only platform admins can change partner status.';
  end if;
  select * into account from public.partner_accounts where id = p_account_id for update;
  if not found then raise exception 'Partner account not found.'; end if;
  if account.status <> p_expected_status then
    raise exception 'Account status changed. Reload and try again.';
  end if;
  if not (
    (account.status = 'onboarding' and p_to_status in ('live', 'suspended', 'offboarded')) or
    (account.status = 'live' and p_to_status in ('suspended', 'offboarded')) or
    (account.status = 'suspended' and p_to_status in ('live', 'offboarded'))
  ) then raise exception 'This status change is not available.'; end if;
  if length(p_reason) > 1000 then raise exception 'Reason must be 1,000 characters or fewer.'; end if;

  entity_table := case account.type
    when 'agency' then 'agencies'
    when 'hotel_partner' then 'hotel_partners'
    when 'venue_partner' then 'venue_partners'
    when 'affiliate' then 'affiliates'
  end;
  if entity_table is null then raise exception 'Partner type is not supported.'; end if;
  execute format('update public.%I set status = %L where id = $1', entity_table,
    case when p_to_status = 'live' then 'active' else 'suspended' end)
    using account.entity_id;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Partner entity not found.'; end if;

  update public.partner_accounts set
    status = p_to_status,
    went_live_at = case when p_to_status = 'live' and account.status = 'onboarding' then now() else went_live_at end,
    suspended_at = case when p_to_status = 'suspended' then now() else suspended_at end,
    offboarded_at = case when p_to_status = 'offboarded' then now() else offboarded_at end
  where id = p_account_id;
  insert into public.partner_account_events(account_id, actor, action, from_status, to_status, reason)
  values (account.id, auth.uid(),
    case when p_to_status = 'live' and account.status = 'onboarding' then 'went_live'
      when p_to_status = 'live' then 'reactivated' else p_to_status::text end,
    account.status, p_to_status, case when p_to_status = 'suspended' then null else nullif(btrim(p_reason), '') end);
end;
$$;
revoke all on function public.transition_partner_account(text, public.partner_account_status, public.partner_account_status, text) from public, anon;
grant execute on function public.transition_partner_account(text, public.partner_account_status, public.partner_account_status, text) to authenticated;

-- Password verification still runs before any account status is shown.
-- Suspended agents can authenticate to the blocked-access screen, but never
-- receive an active agency. Offboarded accounts remain unable to sign in.
create or replace function public.agent_login_identity(p_agent_id text)
returns text language sql stable security definer set search_path = public as $$
  select u.email::text from public.profiles p join auth.users u on u.id = p.id
  where p.agent_code = upper(btrim(p_agent_id)) and p.status = 'active'
    and exists (select 1 from public.agency_members m join public.agencies a on a.id = m.agency_id
      where m.profile_id = p.id and m.status = 'active' and a.status in ('active', 'suspended')
        and not exists (select 1 from public.partner_accounts pa
          where pa.type = 'agency' and pa.entity_id = a.id and pa.status = 'offboarded'))
  limit 1;
$$;
revoke execute on function public.agent_login_identity(text) from public, anon, authenticated;
grant execute on function public.agent_login_identity(text) to service_role;
