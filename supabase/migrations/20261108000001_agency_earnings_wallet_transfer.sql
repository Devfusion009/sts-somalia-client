-- Wallet transfers settle whole approved earnings entries. Keeping the entry's
-- original amount and moving it to paid_out preserves the existing earnings
-- summary and prevents the same earnings being withdrawn a second time.
create or replace function public.transfer_agency_earnings_to_wallet(
  p_agency_id uuid, p_amount numeric, p_transfer_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric;
  v_balance numeric;
  v_wallet_id uuid;
  v_existing public.agency_commission_payouts;
begin
  if not public.is_agency_owner_or_admin(p_agency_id) then
    raise exception 'Only the agency owner or an admin can transfer earnings.';
  end if;
  if p_transfer_id is null or p_amount is null or p_amount <= 0
     or p_amount::text in ('NaN', 'Infinity', '-Infinity') or p_amount <> round(p_amount, 2) then
    raise exception 'Enter a valid transfer amount.';
  end if;

  perform 1 from public.agencies where id = p_agency_id for update;
  select * into v_existing from public.agency_commission_payouts where id = p_transfer_id;
  if found then
    if v_existing.agency_id <> p_agency_id or v_existing.method <> 'wallet'
       or v_existing.amount <> p_amount then
      raise exception 'This transfer reference is already in use.';
    end if;
    return v_existing.payout_reference::uuid;
  end if;

  if exists (select 1 from public.agency_payout_requests where agency_id = p_agency_id
             and status in ('pending', 'approved', 'processing')) then
    raise exception 'Complete or cancel the open withdrawal before transferring earnings.';
  end if;

  -- Lock entries before calculating the amount, so another settlement cannot
  -- consume the same entries between the check and the credit.
  perform 1 from public.agency_commission_entries
    where agency_id = p_agency_id and status = 'confirmed' for update;
  select coalesce(sum(amount), 0) into v_amount from public.agency_commission_entries
    where agency_id = p_agency_id and status = 'confirmed';
  if v_amount <= 0 or v_amount <> p_amount then
    raise exception 'Available earnings changed. Refresh and try again.';
  end if;

  update public.agency_commission_entries set status = 'paid_out'
    where agency_id = p_agency_id and status = 'confirmed';
  update public.agencies set credit_balance = credit_balance + v_amount
    where id = p_agency_id returning credit_balance into v_balance;
  insert into public.agency_wallet_transactions
    (agency_id, type, amount, balance_after, note, created_by)
    values (p_agency_id, 'deposit', v_amount, v_balance, 'Approved earnings transfer', auth.uid())
    returning id into v_wallet_id;
  insert into public.agency_commission_payouts
    (id, agency_id, amount, method, payout_reference, created_by, status, paid_at)
    values (p_transfer_id, p_agency_id, v_amount, 'wallet', v_wallet_id::text, auth.uid(), 'paid', now());
  return v_wallet_id;
end;
$$;
revoke all on function public.transfer_agency_earnings_to_wallet(uuid, numeric, uuid) from public, anon;
grant execute on function public.transfer_agency_earnings_to_wallet(uuid, numeric, uuid) to authenticated;

-- A withdrawal request must reserve earnings under the same agency lock as a
-- wallet transfer, including requests that were validated just before a transfer.
create or replace function public.reserve_agency_payout_earnings()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_available numeric;
begin
  perform 1 from public.agencies where id = new.agency_id for update;
  v_available := (public.agency_earnings_summary(new.agency_id)->>'available')::numeric;
  if new.amount > v_available then
    raise exception 'The withdrawal exceeds available earnings.';
  end if;
  return new;
end;
$$;
revoke all on function public.reserve_agency_payout_earnings() from public, anon, authenticated;
drop trigger if exists reserve_agency_payout_earnings on public.agency_payout_requests;
create trigger reserve_agency_payout_earnings
  before insert on public.agency_payout_requests
  for each row execute function public.reserve_agency_payout_earnings();
