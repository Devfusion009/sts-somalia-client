-- Paying an order from the agency wallet debits the balance and settles the
-- order, but told no one: not the agent who just paid, not admins. Every
-- other wallet event (top-ups, payouts, markup changes, refunds) already
-- writes to public.notifications from inside apply_agency_wallet_transaction
-- or its sibling approval functions — booking_payment was the one case that
-- never got one. Fixed at the same choke point every wallet debit already
-- goes through, so it can't be missed from a future call site.
--
-- Scoped to tx_type = 'booking_payment' only: deposits/adjustments/refunds/
-- credit notes already have their own notifications at their own approval
-- points (agency_wallet_topups, agency_earnings_review_and_payouts,
-- agency_payout_offline_rail), so notifying here too would double them up.
create or replace function public.apply_agency_wallet_transaction(
  target_agency_id uuid,
  tx_amount numeric,
  tx_type public.wallet_tx_type,
  target_order_id uuid default null,
  tx_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  agency public.agencies;
  new_balance numeric(12,2);
  new_tx_id uuid;
  v_order_number text;
begin
  if not public.is_admin() then
    if not public.is_agency_booker(target_agency_id) then
      raise exception 'not authorized to spend this agency''s wallet';
    end if;
    if tx_type <> 'booking_payment' or tx_amount >= 0 then
      raise exception 'agency members can only make booking payments';
    end if;
    if target_order_id is null or not exists (
      select 1 from public.orders
      where id = target_order_id and agency_id = target_agency_id
    ) then
      raise exception 'order does not belong to this agency';
    end if;
  end if;

  select * into agency from public.agencies where id = target_agency_id for update;
  if not found then
    raise exception 'agency not found';
  end if;

  new_balance := agency.credit_balance + tx_amount;
  if tx_amount < 0 and new_balance < -agency.credit_limit then
    raise exception 'insufficient agency balance (available: %)',
      agency.credit_balance + agency.credit_limit;
  end if;

  update public.agencies set credit_balance = new_balance where id = target_agency_id;

  insert into public.agency_wallet_transactions
    (agency_id, type, amount, balance_after, order_id, note, created_by)
  values
    (target_agency_id, tx_type, tx_amount, new_balance, target_order_id, tx_note, auth.uid())
  returning id into new_tx_id;

  if tx_type = 'booking_payment' and target_order_id is not null then
    select order_number into v_order_number from public.orders where id = target_order_id;

    insert into public.notifications (profile_id, type, title, body, data)
    values (
      auth.uid(),
      'wallet_booking_payment',
      'Payment sent',
      'USD ' || trim_scale(-tx_amount) || ' was paid from ' || agency.name || '''s balance for order '
        || coalesce(v_order_number, target_order_id::text) || '.',
      jsonb_build_object('agencyId', target_agency_id, 'orderId', target_order_id, 'amount', -tx_amount)
    );

    insert into public.notifications (profile_id, type, title, body, data)
    select p.id,
           'wallet_booking_payment',
           agency.name || ' paid an order from wallet balance',
           'Order ' || coalesce(v_order_number, target_order_id::text) || ' — USD ' || trim_scale(-tx_amount)
             || ' paid from agency balance. Balance now USD ' || trim_scale(new_balance) || '.',
           jsonb_build_object('agencyId', target_agency_id, 'orderId', target_order_id, 'amount', -tx_amount)
    from public.profiles p
    where p.is_platform_admin;
  end if;

  return new_tx_id;
end;
$$;
