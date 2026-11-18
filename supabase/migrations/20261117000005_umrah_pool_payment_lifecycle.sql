-- Preserve legacy checkout expiry, but request-first orders use invitation deadlines.

create or replace function public.release_public_umrah_checkouts()
returns integer language plpgsql security definer set search_path=public as $$
declare r record; n integer:=0;
begin
  for r in select o.id from public.orders o where not exists(select 1 from public.umrah_pool_requests pr where pr.order_id=o.id) and o.status in ('pending_payment','held')
    and o.created_at<now()-interval '30 minutes'
    and exists(select 1 from public.order_items oi join public.umrah_bookings b on b.id=oi.umrah_booking_id
      where oi.order_id=o.id and b.booking_kind='group' and b.status='pending')
    and not exists(select 1 from public.payments p where p.order_id=o.id and
      (p.status in ('succeeded','requires_action') or (p.status='processing' and p.created_at>now()-interval '2 hours')))
    for update of o skip locked
  loop
    perform public._apply_order_cancellation(r.id,'Checkout expired. Seats released.'); n:=n+1;
  end loop;
  -- Recovery for an interrupted API request between the booking and order writes.
  update public.umrah_bookings b set status='cancelled'
    where b.pool_request_id is null and b.booking_kind='group' and b.status='pending' and b.created_at<now()-interval '30 minutes'
      and not exists(select 1 from public.order_items oi where oi.umrah_booking_id=b.id);
  return n;
end $$;

create or replace function public.guard_public_umrah_payment()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_total numeric; v_paid numeric;
begin
  if exists(select 1 from public.umrah_pool_requests where order_id=new.order_id) then return new; end if;
  if exists(select 1 from public.order_items oi join public.umrah_bookings b on b.id=oi.umrah_booking_id
    where oi.order_id=new.order_id and b.booking_kind='group') then
    -- Lock the order before checking expiry or accepting a receipt, serialising
    -- payment against the expiry sweep and concurrent payment attempts.
    select total into v_total from public.orders where id=new.order_id for update;
    if exists(select 1 from public.orders where id=new.order_id and status in ('pending_payment','held') and created_at<now()-interval '30 minutes')
      and not exists(select 1 from public.payments p where p.order_id=new.order_id and
        (p.status in ('succeeded','requires_action') or (p.status='processing' and p.created_at>now()-interval '2 hours'))) then
      raise exception 'This checkout has expired. Choose an available departure.';
    end if;
    if exists(select 1 from public.orders where id=new.order_id and status in ('cancelled','refunded')) then
      raise exception 'This checkout has expired or been cancelled.';
    end if;
    select coalesce(sum(amount),0) into v_paid from public.payments where order_id=new.order_id and status='succeeded';
    if new.amount < v_total-v_paid-0.01 then raise exception 'Public Umrah requires full payment.'; end if;
  end if;
  return new;
end $$;

create or replace function public._expire_unpaid_umrah_orders(p_package_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hours numeric;
  v_order_id uuid;
  v_swept integer := 0;
begin
  begin
    v_hours := (public.umrah_setting('unpaidHoldHours'))::text::numeric;
  exception when others then
    v_hours := null;
  end;
  v_hours := coalesce(v_hours, 48);

  -- Unpaid group bookings past the window.
  if v_hours >= 0 then
    for v_order_id in
      select o.id
        from public.orders o
       where not exists(select 1 from public.umrah_pool_requests pr where pr.order_id=o.id) and o.status = 'pending_payment'
         and o.created_at < now() - v_hours * interval '1 hour'
         and exists (
           select 1
             from public.order_items oi
             join public.umrah_bookings b on b.id = oi.umrah_booking_id
            where oi.order_id = o.id
              and b.booking_kind = 'group'
              and b.status = 'pending'
              and (p_package_id is null or b.package_id = p_package_id)
         )
         and not exists (
           select 1 from public.payments p
            where p.order_id = o.id
              and p.status in ('succeeded', 'requires_action', 'processing')
         )
       for update of o skip locked
    loop
      perform set_config('sts.umrah_close_note', 'Unpaid. Seats released.', true);
      perform public._apply_order_cancellation(v_order_id, 'Unpaid. Seats released.');
      v_swept := v_swept + 1;
    end loop;
  end if;

  -- Umrah agent holds past their expiry.
  for v_order_id in
    select o.id
      from public.orders o
     where not exists(select 1 from public.umrah_pool_requests pr where pr.order_id=o.id) and o.status = 'held'
       and o.hold_expires_at < now()
       and exists (
         select 1
           from public.order_items oi
           join public.umrah_bookings b on b.id = oi.umrah_booking_id
          where oi.order_id = o.id
            and (p_package_id is null or b.package_id = p_package_id)
       )
       and not exists (
         select 1 from public.payments p
          where p.order_id = o.id
            and p.status in ('succeeded', 'requires_action', 'processing')
       )
     for update of o skip locked
  loop
    perform set_config('sts.umrah_close_note', 'Hold expired.', true);
    perform public._apply_order_cancellation(v_order_id, 'Hold expired');
    v_swept := v_swept + 1;
  end loop;

  perform set_config('sts.umrah_close_note', '', true);
  return v_swept;
end;
$$;
create function public.guard_umrah_pool_payment() returns trigger language plpgsql security definer set search_path=public as $$
declare r public.umrah_pool_requests; outstanding numeric; order_state text;
begin
 select * into r from public.umrah_pool_requests where order_id=new.order_id;
 if not found then return new; end if;
 -- Existing provider/wallet paths already lock the order; keep that lock first.
 select status::text into order_state from public.orders where id=new.order_id for update;
 select * into r from public.umrah_pool_requests where id=r.id for update;
 if tg_op='UPDATE' and (new.amount,new.currency,new.order_id) is distinct from (old.amount,old.currency,old.order_id) then raise exception 'Payment terms cannot change.'; end if;
 if new.currency<>r.currency then raise exception 'Payment currency does not match the invitation.'; end if;
 if tg_op='UPDATE' and new.status=old.status then return new; end if;
 if new.status in ('failed','refunded','partially_refunded') then return new; end if;
 if new.status='succeeded' and (r.status in ('expired','withdrawn','cancelled') or order_state in ('cancelled','refunded')) then
  -- Preserve real provider funds for reconciliation without resurrecting seats.
  insert into public.umrah_pool_events(departure_id,request_id,event_key,kind,last_error) values(r.departure_id,r.id,'late-payment:'||new.id,'payment_reconciliation','Payment received after allocation closed. Review refund.') on conflict do nothing;
  return new;
 end if;
 if r.status<>'payment_due' or not exists(select 1 from public.umrah_package_departures where id=r.departure_id and formation_status in ('payment_open','ready')) then raise exception 'This pool is not open for payment.'; end if;
 if r.payment_due_at<=now() and not (tg_op='UPDATE' and old.status in ('processing','requires_action')) then raise exception 'The payment invitation has expired.'; end if;
 select r.total-coalesce(sum(amount),0) into outstanding from public.payments where order_id=r.order_id and status='succeeded' and id is distinct from new.id;
 if new.amount<>outstanding or outstanding<=0 then raise exception 'Pay the full outstanding invitation amount.'; end if;
 if tg_op='INSERT' and exists(select 1 from public.payments where order_id=r.order_id and status in ('processing','requires_action')) then raise exception 'A payment is already processing or under review.'; end if;
 return new;
end $$;
revoke all on function public.guard_umrah_pool_payment() from public,anon,authenticated;
create trigger aaa_guard_umrah_pool_payment before insert or update on public.payments for each row execute function public.guard_umrah_pool_payment();

create function public.settle_umrah_pool_request() returns trigger language plpgsql security definer set search_path=public as $$
declare dep uuid;
begin
 if new.status='paid' and old.status is distinct from new.status then
  update public.umrah_pool_requests set status='paid' where order_id=new.id and status='payment_due' returning departure_id into dep;
  if dep is not null then
   update public.umrah_package_departures set formation_status='ready' where id=dep and formation_status='payment_open' and booked_seats=total_seats and not exists(select 1 from public.umrah_pool_requests where departure_id=dep and status in ('requested','payment_due'));
   -- Existing order_paid / wallet payment notifications own the receipt email.
   insert into public.umrah_pool_events(departure_id,event_key,kind,processed_at) values(dep,'paid:'||new.id,'paid',now()) on conflict do nothing;
  end if;
 end if;
 return new;
end $$;
create trigger zz_settle_umrah_pool_request after update of status on public.orders for each row execute function public.settle_umrah_pool_request();

create function public.expire_umrah_pool_requests()
returns jsonb language plpgsql security definer set search_path=public as $$
declare d record; r public.umrah_pool_requests; n int:=0;
begin
 -- Forming requests have no orders. Cancel only unactivated groups.
 for d in select id from public.umrah_package_departures where booking_mode='request_then_pay' and formation_status='forming' and formation_closes_at<=now() for update skip locked loop
  for r in select * from public.umrah_pool_requests where departure_id=d.id and status='requested' order by id for update loop
   update public.umrah_pool_requests set status='cancelled',closed_reason='The group did not fill before its formation deadline.' where id=r.id;
   perform public.queue_umrah_pool_notice(r.id,'cancelled'); n:=n+1;
  end loop;
  update public.umrah_package_departures set formation_status='cancelled' where id=d.id;
 end loop;
 -- Lock orders before requests/departures, matching provider settlement. A
 -- concurrent settlement wins its lock and this sweep rechecks after locking.
 for d in select o.id from public.orders o join public.umrah_pool_requests q on q.order_id=o.id
  where q.status='payment_due' and q.payment_due_at<=now() order by o.id for update of o skip locked loop
  select * into r from public.umrah_pool_requests where order_id=d.id for update;
  if r.status<>'payment_due' or exists(select 1 from public.payments where order_id=d.id and status in ('succeeded','processing','requires_action')) then continue; end if;
  update public.umrah_pool_requests set status='expired',closed_reason='Payment deadline expired.' where id=r.id;
  perform public._apply_order_cancellation(d.id,'Umrah payment deadline expired.');
  perform public.queue_umrah_pool_notice(r.id,'expired'); n:=n+1;
 end loop;
 -- One reminder per invitation, only while unpaid and no payment is in flight.
 for r in select * from public.umrah_pool_requests q where status='payment_due' and payment_due_at>now() and payment_due_at<=now()+interval '24 hours'
  and not exists(select 1 from public.payments where order_id=q.order_id and status in ('succeeded','processing','requires_action')) loop
  perform public.queue_umrah_pool_notice(r.id,'reminder');
 end loop;
 return jsonb_build_object('expired',n);
end $$;
revoke all on function public.expire_umrah_pool_requests() from public,anon,authenticated;
grant execute on function public.expire_umrah_pool_requests() to service_role;

create function public.open_umrah_pool_replacements(p_departure uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Admin access required.'; end if;
 update public.umrah_package_departures set replacement_sales_open=true where id=p_departure and booking_mode='request_then_pay' and formation_status='payment_open'
  and booked_seats<total_seats and now()+payment_window_hours*interval '1 hour'<=payment_cutoff_at;
 if not found then raise exception 'No replacement places or payment window are available.'; end if;
 insert into public.umrah_pool_events(departure_id,event_key,kind,actor_id,processed_at) values(p_departure,gen_random_uuid()::text,'replacements_opened',auth.uid(),now());
end $$;
revoke all on function public.open_umrah_pool_replacements(uuid) from public,anon;
grant execute on function public.open_umrah_pool_replacements(uuid) to authenticated;
create function public.protect_umrah_pool_order() returns trigger language plpgsql set search_path=public as $$
begin
 if exists(select 1 from public.umrah_pool_requests where order_id=old.id) then
  if (new.total,new.subtotal,new.markup_amount,new.currency,new.customer_id,new.agency_id,new.agency_customer_id) is distinct from
     (old.total,old.subtotal,old.markup_amount,old.currency,old.customer_id,old.agency_id,old.agency_customer_id) then raise exception 'Accepted pool order terms are locked.'; end if;
  if current_user in ('anon','authenticated') and new.status is distinct from old.status then raise exception 'Use the payment or cancellation service.'; end if;
 end if;
 return new;
end $$;
create trigger protect_umrah_pool_order before update on public.orders for each row execute function public.protect_umrah_pool_order();
create function public.protect_umrah_pool_order_item() returns trigger language plpgsql set search_path=public as $$
begin
 if current_user in ('anon','authenticated') and exists(select 1 from public.umrah_bookings where id=new.umrah_booking_id and pool_request_id is not null) then raise exception 'Pool orders are created by activation.'; end if;
 return new;
end $$;
create trigger protect_umrah_pool_order_item before insert or update on public.order_items for each row execute function public.protect_umrah_pool_order_item();
-- Existing departure cancellation still owns paid refunds and booking cancellation.
-- This companion closes requests which have not become bookings yet.
create function public.close_umrah_pool_on_departure_cancel() returns trigger language plpgsql security definer set search_path=public as $$
declare req record;
begin
 if new.booking_mode='request_then_pay' and new.status='cancelled' and old.status is distinct from new.status then
  update public.umrah_package_departures set formation_status='cancelled',replacement_sales_open=false where id=new.id;
  for req in select id from public.umrah_pool_requests where departure_id=new.id and status='requested' for update loop
   update public.umrah_pool_requests set status='cancelled',closed_reason='Departure cancelled by STS.' where id=req.id;
   perform public.queue_umrah_pool_notice(req.id,'cancelled');
  end loop;
 end if;
 return new;
end $$;
create trigger close_umrah_pool_on_departure_cancel after update of status on public.umrah_package_departures for each row execute function public.close_umrah_pool_on_departure_cancel();
create function public.protect_umrah_pool_booking_terms() returns trigger language plpgsql set search_path=public as $$
begin
 if old.pool_request_id is not null and (new.pool_request_id,new.package_id,new.departure_id,new.booking_kind,new.num_pilgrims,new.total_price,new.currency,new.room_sharing,new.customer_id,new.booked_by,new.agency_id)
 is distinct from (old.pool_request_id,old.package_id,old.departure_id,old.booking_kind,old.num_pilgrims,old.total_price,old.currency,old.room_sharing,old.customer_id,old.booked_by,old.agency_id) then raise exception 'Pool booking terms are locked.'; end if;
 return new;
end $$;
create trigger protect_umrah_pool_booking_terms before update on public.umrah_bookings for each row execute function public.protect_umrah_pool_booking_terms();
