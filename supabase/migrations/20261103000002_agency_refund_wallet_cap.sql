-- Agency refunds return only funds actually debited from the wallet.
-- Provider-funded orders require a refund through their original payment rail.
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
end;
$$;
