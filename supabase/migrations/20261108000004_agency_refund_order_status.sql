-- An approved agency refund now updates the order it refunds.
--
-- approve_agency_refund_request credited the wallet but left the payment
-- 'succeeded' and the order 'paid', so a fully refunded booking still read
-- as paid and its commission stayed in review. Payment statuses are now
-- re-derived from the total refunded to the wallet for the order, newest
-- payment first (the rule complete_booking_request uses). When nothing
-- collected remains, the order becomes 'refunded', which reverses its
-- commission (20261108000002).

create or replace function public.approve_agency_refund_request(request_id uuid, notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.agency_refund_requests;
  new_tx_id uuid;
  v_available numeric;
  v_refunded numeric;
  v_pay record;
begin
  if not public.is_admin() then
    raise exception 'only admins can approve refund requests';
  end if;

  select * into req from public.agency_refund_requests where id = request_id for update;
  if not found then
    raise exception 'refund request not found';
  end if;
  if req.status <> 'pending' then
    raise exception 'refund request already processed';
  end if;

  if req.order_id is null then
    raise exception 'Select the original wallet-paid order for this refund.';
  end if;
  -- Serialize against wallet spending and other refund approvals.
  perform 1 from public.agencies where id = req.agency_id for update;
  if not exists (select 1 from public.orders where id = req.order_id and agency_id = req.agency_id) then
    raise exception 'Order does not belong to this agency.';
  end if;
  select coalesce(sum(case when type = 'booking_payment' then -amount
                          when type = 'refund' then -amount else 0 end), 0)
    into v_available from public.agency_wallet_transactions
    where agency_id = req.agency_id and order_id = req.order_id;
  if req.amount <= 0 or req.amount > v_available then
    raise exception 'Refund exceeds the remaining wallet payment.';
  end if;

  new_tx_id := public.apply_agency_wallet_transaction(
    req.agency_id, req.amount, 'refund', req.order_id,
    'Refund approved: ' || req.reason
  );

  update public.agency_refund_requests
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
        review_notes = notes, wallet_transaction_id = new_tx_id
    where id = request_id;

  select coalesce(sum(amount), 0) into v_refunded
    from public.agency_wallet_transactions
   where agency_id = req.agency_id and order_id = req.order_id and type = 'refund';

  for v_pay in
    select id, amount from public.payments
     where order_id = req.order_id and status in ('succeeded', 'partially_refunded', 'refunded')
     order by created_at desc, id desc
  loop
    update public.payments
       set status = case
             when v_refunded >= v_pay.amount then 'refunded'
             when v_refunded > 0 then 'partially_refunded'
             else 'succeeded'
           end::public.payment_status
     where id = v_pay.id;
    v_refunded := greatest(v_refunded - v_pay.amount, 0);
  end loop;

  if not exists (
    select 1 from public.payments
     where order_id = req.order_id and status in ('succeeded', 'partially_refunded')
  ) then
    update public.orders set status = 'refunded'
     where id = req.order_id and status in ('paid', 'processing', 'partially_paid', 'completed');
  end if;
end;
$$;

-- Backfill: wallet-paid agency orders already refunded in full.
with refunded as (
  select o.id
    from public.orders o
   where o.agency_id is not null
     and o.status in ('paid', 'processing', 'partially_paid', 'completed')
     and exists (select 1 from public.agency_refund_requests a where a.order_id = o.id and a.status = 'approved')
     and (select coalesce(sum(t.amount), 0) from public.agency_wallet_transactions t
           where t.order_id = o.id and t.type = 'refund')
         >= (select coalesce(sum(-t.amount), 0) from public.agency_wallet_transactions t
              where t.order_id = o.id and t.type = 'booking_payment')
     and (select coalesce(sum(-t.amount), 0) from public.agency_wallet_transactions t
           where t.order_id = o.id and t.type = 'booking_payment') > 0
)
update public.payments p
   set status = 'refunded'
  from refunded r
 where p.order_id = r.id and p.status in ('succeeded', 'partially_refunded');

update public.orders o
   set status = 'refunded'
 where o.agency_id is not null
   and o.status in ('paid', 'processing', 'partially_paid', 'completed')
   and exists (select 1 from public.agency_refund_requests a where a.order_id = o.id and a.status = 'approved')
   and exists (select 1 from public.payments p where p.order_id = o.id and p.status = 'refunded')
   and not exists (select 1 from public.payments p where p.order_id = o.id and p.status in ('succeeded', 'partially_refunded'));
