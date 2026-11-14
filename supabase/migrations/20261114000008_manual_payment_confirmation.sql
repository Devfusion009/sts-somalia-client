-- Manual payment approval uses the same settlement/booking/invoice triggers
-- as verified gateway payments. Lock the order before checking its balance.
create or replace function public.confirm_manual_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_order public.orders;
  v_order_id uuid;
  v_paid numeric;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  select order_id into v_order_id from public.payments where id = p_payment_id;
  if not found then raise exception 'Payment not found.'; end if;
  select * into v_order from public.orders where id = v_order_id for update;
  select * into v_payment from public.payments where id = p_payment_id for update;
  if v_payment.provider <> 'manual' then
    raise exception 'Online payments require confirmation from the payment provider.';
  end if;
  -- A repeat click must not settle or notify twice.
  if v_payment.status = 'succeeded' then return; end if;
  if v_payment.status <> 'requires_action' then
    raise exception 'Only pending manual payments can be approved.';
  end if;
  if v_order.status not in ('pending_payment', 'held', 'partially_paid') then
    raise exception 'This order is no longer awaiting payment.';
  end if;
  if v_order.status = 'held' and v_order.hold_expires_at is not null and v_order.hold_expires_at <= now() then
    raise exception 'This order has expired.';
  end if;
  if exists (select 1 from public.payments where order_id = v_order.id
    and provider <> 'manual' and status in ('processing', 'requires_action')) then
    raise exception 'An online payment is still awaiting confirmation.';
  end if;
  select coalesce(sum(amount), 0) into v_paid from public.payments
    where order_id = v_order.id and status = 'succeeded';
  if v_payment.currency <> v_order.currency or v_payment.amount <= 0
     or v_payment.amount > v_order.total - v_paid then
    raise exception 'The payment does not match the remaining balance.';
  end if;

  update public.payments set status = 'succeeded' where id = p_payment_id;
end;
$$;

revoke all on function public.confirm_manual_payment(uuid) from public, anon;
grant execute on function public.confirm_manual_payment(uuid) to authenticated;
