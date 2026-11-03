-- Debit and settlement must commit together. Lock the agency before the order,
-- matching wallet/refund paths, then recalculate the unpaid balance under lock.
create or replace function public.pay_order_from_agency_wallet(p_order_id uuid, p_amount numeric)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_agency_id uuid;
  v_paid numeric;
  v_payment_id uuid;
begin
  select agency_id into v_agency_id from public.orders where id = p_order_id;
  if v_agency_id is null or not public.is_agency_booker(v_agency_id) then
    raise exception 'Only the booking agency can pay from its wallet.';
  end if;
  perform 1 from public.agencies where id = v_agency_id for update;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.agency_id is distinct from v_agency_id or v_order.status not in ('pending_payment', 'held', 'partially_paid') then
    raise exception 'This order is not awaiting payment.';
  end if;
  if v_order.currency <> 'USD' then
    raise exception 'Agency wallet payments require USD.';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) or p_amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Enter a valid payment amount.';
  end if;
  select coalesce(sum(amount), 0) into v_paid from public.payments
    where order_id = p_order_id and status = 'succeeded';
  if p_amount > v_order.total - v_paid then
    raise exception 'Payment exceeds the remaining balance.';
  end if;
  if v_paid = 0 and p_amount < coalesce(v_order.min_first_payment, round(v_order.total * 0.5, 2)) then
    raise exception 'Payment is below the required deposit.';
  end if;
  if exists (
    select 1 from public.order_items i
    left join public.hotel_bookings h on h.id = i.hotel_booking_id
    left join public.hall_bookings b on b.id = i.hall_booking_id
    where i.order_id = p_order_id and (h.status = 'waitlisted' or b.status = 'waitlisted')
  ) then
    raise exception 'This booking is waiting for confirmation.';
  end if;
  if exists (
    select 1 from public.order_items i
    join public.hall_bookings b on b.id = i.hall_booking_id
    left join public.event_venues v on v.id = b.venue_id
    where i.order_id = p_order_id and b.status in ('pending', 'waitlisted')
      and (coalesce(v.base_price, 0) <= 0 or (v.price_unit = 'per_hour' and b.start_time is null))
  ) then
    raise exception 'The venue has not confirmed the price.';
  end if;
  perform public.apply_agency_wallet_transaction(v_agency_id, -p_amount, 'booking_payment', p_order_id, 'Order ' || v_order.order_number);
  insert into public.payments(order_id, provider, method_label, amount, currency, status)
    values (p_order_id, 'wallet', 'Agency Balance', p_amount, v_order.currency, 'succeeded')
    returning id into v_payment_id;
  return v_payment_id;
end;
$$;
revoke all on function public.pay_order_from_agency_wallet(uuid, numeric) from public, anon;
grant execute on function public.pay_order_from_agency_wallet(uuid, numeric) to authenticated;
