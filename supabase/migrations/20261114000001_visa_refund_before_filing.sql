-- Visa refund policy, part 1: a case cancelled before STS files it with the
-- authority is refunded in full (government fee + STS fee).
--
-- "Filed" means a lodgement exists: any visa_processing_jobs row for the
-- application. Until then nothing has been paid to a government, so the
-- whole amount collected goes back:
--   * agency order paid from the wallet: credited to the wallet at once,
--     recorded as a completed refund request;
--   * anything else (card, mobile money, bank): an approved refund request
--     in Admin > Refund requests, which finance pays out and completes.
-- After filing nothing is refunded automatically; refusals get the STS fee
-- back as re-application credit (a later migration).

create or replace function public._visa_is_filed(p_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.visa_processing_jobs where application_id = p_application_id);
$$;

revoke execute on function public._visa_is_filed(uuid) from public, anon, authenticated;

/**
 * Refunds everything collected on a visa order that was never filed.
 * Returns the amount refunded (0 when nothing was paid). Idempotent: an
 * order that already has an open or completed refund request is skipped.
 */
create or replace function public._visa_refund_unfiled(p_application_id uuid, p_reason text, p_actor uuid default null)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_paid numeric;
  v_refunded numeric;
  v_due numeric;
  v_wallet numeric;
  v_request uuid;
  v_actor uuid := coalesce(p_actor, auth.uid());
  v_pay record;
begin
  if public._visa_is_filed(p_application_id) then
    return 0;
  end if;

  select o.* into v_order
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.visa_application_id = p_application_id
   order by o.created_at desc
   limit 1
   for update of o;
  if not found or v_order.status not in ('paid', 'partially_paid', 'processing', 'completed') then
    return 0;
  end if;

  if exists (
    select 1 from public.booking_requests
     where order_id = v_order.id and kind in ('refund', 'cancellation')
       and status in ('requested', 'in_review', 'approved', 'completed')
  ) then
    return 0;
  end if;

  select coalesce(sum(amount), 0) into v_paid
    from public.payments where order_id = v_order.id and status in ('succeeded', 'partially_refunded');
  if v_order.agency_id is not null then
    select coalesce(sum(amount), 0) into v_refunded
      from public.agency_wallet_transactions where order_id = v_order.id and type = 'refund';
  else
    v_refunded := 0;
  end if;
  v_due := round(v_paid - v_refunded, 2);
  if v_due <= 0 then
    return 0;
  end if;

  if v_order.agency_id is not null then
    select coalesce(sum(-amount), 0) - v_refunded into v_wallet
      from public.agency_wallet_transactions
     where order_id = v_order.id and agency_id = v_order.agency_id and type = 'booking_payment';
  else
    v_wallet := 0;
  end if;

  if v_order.agency_id is not null and v_wallet >= v_due then
    -- Wallet-paid in full: return it to the wallet now.
    perform 1 from public.agencies where id = v_order.agency_id for update;
    perform public.credit_agency_wallet_internal(
      v_order.agency_id, v_due, 'refund', v_order.id,
      'Refund ' || v_order.order_number || ' · visa not filed', v_actor
    );
    insert into public.booking_requests (
      order_id, requested_by, kind, status, reason, requested_amount, approved_amount,
      currency, staff_note, resolved_by, resolved_at
    ) values (
      v_order.id, coalesce(v_actor, v_order.booked_by), 'refund', 'completed', p_reason, v_due, v_due,
      v_order.currency, 'Visa not filed: full refund to wallet.', v_actor, now()
    );
    for v_pay in
      select id from public.payments where order_id = v_order.id and status in ('succeeded', 'partially_refunded')
    loop
      update public.payments set status = 'refunded' where id = v_pay.id;
    end loop;
    update public.orders set status = 'refunded' where id = v_order.id;
  else
    -- Paid outside the wallet: finance returns it the way it came in.
    insert into public.booking_requests (
      order_id, requested_by, kind, status, reason, requested_amount, approved_amount, currency, staff_note
    ) values (
      v_order.id, coalesce(v_actor, v_order.booked_by), 'refund', 'approved', p_reason, v_due, v_due,
      v_order.currency, 'Visa not filed: full refund approved.'
    )
    returning id into v_request;
  end if;

  return v_due;
end;
$$;

revoke execute on function public._visa_refund_unfiled(uuid, text, uuid) from public, anon, authenticated;

create or replace function public.visa_cancel_case(p_application_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_filed boolean;
  v_refund numeric;
  v_currency text;
begin
  perform public._visa_require('visa.case.cancel');
  if v_reason is null or length(v_reason) < 5 then
    raise exception 'enter a reason for cancelling';
  end if;
  app := public._visa_open_case(p_application_id);
  v_filed := public._visa_is_filed(app.id);

  -- Refund first so the customer message can state the amount.
  v_refund := case when v_filed then 0
                   else public._visa_refund_unfiled(app.id, 'Visa application cancelled: ' || v_reason) end;
  select o.currency into v_currency
    from public.order_items oi join public.orders o on o.id = oi.order_id
   where oi.visa_application_id = app.id limit 1;

  perform public._visa_set_stage(
    app.id, 'cancelled', v_reason, 'visa.case.cancel',
    app.application_ref || ' was cancelled. ' || v_reason
      || case when v_refund > 0
              then ' A full refund of ' || coalesce(v_currency, 'USD') || ' ' || to_char(v_refund, 'FM999999990.00') || ' is on its way.'
              else '' end,
    true
  );

  -- An unpaid order for a cancelled case must not stay payable.
  perform public._apply_order_cancellation(o.id, 'Visa application cancelled: ' || v_reason)
     from public.order_items oi
     join public.orders o on o.id = oi.order_id
    where oi.visa_application_id = app.id
      and o.status in ('pending_payment', 'held');
end;
$$;
