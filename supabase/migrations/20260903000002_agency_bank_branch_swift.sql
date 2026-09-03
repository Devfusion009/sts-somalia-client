-- Somali domestic transfers route through a specific branch (the account
-- number alone doesn't identify one — see the branch component embedded in
-- the informal IBAN structure banks like Salaam Somali Bank and Premier
-- Bank use), and settling from outside Somalia needs the bank's SWIFT/BIC.
-- Neither existed on the agency payout account, so admin had no way to
-- actually complete a transfer beyond the account number alone.

alter table public.agencies add column bank_branch text;
alter table public.agencies add column bank_swift_code text;

-- Same snapshot reasoning as the three columns this table already carries
-- (see 20260902000001): the agency can edit its bank details later, and a
-- request already reviewed or paid has to keep showing the account the
-- money was actually sent to.
alter table public.agency_payout_requests add column bank_branch text;
alter table public.agency_payout_requests add column bank_swift_code text;

create or replace function public.request_agency_payout(
  p_agency_id uuid,
  p_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_available numeric;
  v_agency public.agencies;
begin
  if not public.is_agency_owner_or_admin(p_agency_id) then
    raise exception 'only the agency owner or an admin can request a payout';
  end if;

  select * into v_agency from public.agencies where id = p_agency_id;
  if not found then
    raise exception 'agency not found';
  end if;
  if coalesce(btrim(v_agency.bank_account_number), '') = '' then
    raise exception 'add your bank details before requesting a payout';
  end if;

  v_available := (public.agency_earnings_summary(p_agency_id) ->> 'available')::numeric;

  if p_amount is null or p_amount <= 0 then
    raise exception 'enter an amount greater than zero';
  end if;
  if p_amount > v_available then
    raise exception 'you can request up to USD %', trim_scale(v_available);
  end if;

  insert into public.agency_payout_requests
    (agency_id, amount, bank_name, bank_account_name, bank_account_number,
     bank_branch, bank_swift_code, requested_by)
  values
    (p_agency_id, p_amount, v_agency.bank_name, v_agency.bank_account_name,
     v_agency.bank_account_number, v_agency.bank_branch, v_agency.bank_swift_code,
     auth.uid())
  returning id into v_request_id;

  insert into public.notifications (profile_id, type, title, body, data)
  select p.id,
         'payout_request',
         'Payout request awaiting review',
         v_agency.name || ' requested a transfer of USD ' || trim_scale(p_amount) || '.',
         jsonb_build_object('agencyId', p_agency_id, 'requestId', v_request_id)
  from public.profiles p
  where p.is_platform_admin;

  return v_request_id;
end;
$$;
