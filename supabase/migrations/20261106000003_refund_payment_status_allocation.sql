-- complete_booking_request flagged only the newest succeeded payment as
-- partially_refunded whatever the amount, so a refund larger than that
-- payment left older payments looking untouched, and a second partial
-- refund on the same order was not reflected. Statuses are now re-derived
-- from the total refunded on the order, newest payment first. A completed
-- cancellation that leaves no live booking on the order also closes it.

CREATE OR REPLACE FUNCTION public.complete_booking_request(p_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r public.booking_requests;
  v_paid numeric;
  v_latest uuid;
  v_agency_id uuid;
  v_order_number text;
  v_wallet_paid numeric;
  v_credit numeric;
  v_refunded numeric;
  v_pay record;
  v_has_active boolean;
begin
  if not public.is_admin() then
    raise exception 'Only admin can complete a refund.';
  end if;

  select * into r from public.booking_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found.';
  end if;
  if r.status <> 'approved' then
    raise exception 'Only an approved request can be completed.';
  end if;

  update public.booking_requests
     set status = 'completed', resolved_by = auth.uid(), resolved_at = now()
   where id = r.id;

  if r.kind in ('cancellation', 'refund') and coalesce(r.approved_amount, 0) > 0 then
    select agency_id, order_number into v_agency_id, v_order_number
      from public.orders where id = r.order_id;

    if v_agency_id is not null and not exists (
      select 1 from public.agency_refund_requests a
       where a.order_id = r.order_id and a.status = 'approved'
    ) then
      -- Net of what the wallet already got back for this order, so a second
      -- partial refund can never return more than the wallet paid.
      select coalesce(sum(-t.amount) filter (where t.type = 'booking_payment'), 0)
           - coalesce(sum(t.amount) filter (where t.type = 'refund'), 0)
        into v_wallet_paid
        from public.agency_wallet_transactions t
       where t.order_id = r.order_id and t.agency_id = v_agency_id;
      v_credit := least(r.approved_amount, greatest(v_wallet_paid, 0));
      if v_credit > 0 then
        perform public.apply_agency_wallet_transaction(
          v_agency_id, v_credit, 'refund', r.order_id, 'Refund ' || v_order_number
        );
      end if;
    end if;

    -- Re-derive every collected payment's status from the total refunded
    -- on the order (all completed refund/cancellation requests, this one
    -- included), consuming the newest payment first. A refund larger than
    -- the latest payment now marks that one refunded and the next one part
    -- refunded, and a second partial refund builds on the first.
    select coalesce(sum(amount), 0) into v_paid
      from public.payments
     where order_id = r.order_id and status in ('succeeded', 'partially_refunded', 'refunded');
    select coalesce(sum(o.approved_amount), 0) into v_refunded
      from public.booking_requests o
     where o.order_id = r.order_id and o.kind in ('cancellation', 'refund') and o.status = 'completed';

    if v_paid > 0 then
      for v_pay in
        select id, amount from public.payments
         where order_id = r.order_id and status in ('succeeded', 'partially_refunded', 'refunded')
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
         where order_id = r.order_id and status in ('succeeded', 'partially_refunded')
      ) then
        update public.orders set status = 'refunded'
         where id = r.order_id and status in ('paid', 'processing', 'partially_paid', 'completed');
      end if;
    end if;
  end if;

  -- A completed cancellation that leaves nothing live on the order closes
  -- it: otherwise a cancelled, part-refunded booking still showed a balance
  -- and could be paid again from checkout.
  if r.kind = 'cancellation' then
    select exists (
      select 1
        from public.order_items oi
        left join public.hotel_bookings hb on hb.id = oi.hotel_booking_id
        left join public.hall_bookings hl on hl.id = oi.hall_booking_id
        left join public.umrah_bookings ub on ub.id = oi.umrah_booking_id
        left join public.flight_bookings fb on fb.id = oi.flight_booking_id
       where oi.order_id = r.order_id
         and coalesce(hb.status::text, hl.status::text, ub.status::text, fb.status::text, 'active')
             not in ('cancelled', 'refunded')
    ) into v_has_active;
    if not v_has_active then
      update public.orders set status = 'cancelled'
       where id = r.order_id and status in ('pending_payment', 'partially_paid', 'paid', 'processing');
    end if;
  end if;

  -- A request staff opened themselves (admin cancel, departure cancel) tells
  -- the order's customer and booker, not the staff member.
  insert into public.notifications (profile_id, type, title, body, data)
  select distinct x.profile_id,
         'booking_request_completed',
         'Refund sent',
         case when r.approved_amount is not null then r.currency || ' ' || to_char(r.approved_amount, 'FM999999990.00') else null end,
         jsonb_build_object('request_id', r.id, 'order_id', r.order_id)
    from (
      select r.requested_by as profile_id
       where not exists (select 1 from public.profiles p where p.id = r.requested_by and p.is_platform_admin)
      union
      select o.customer_id from public.orders o
       where o.id = r.order_id
         and exists (select 1 from public.profiles p where p.id = r.requested_by and p.is_platform_admin)
      union
      select o.booked_by from public.orders o
       where o.id = r.order_id
         and exists (select 1 from public.profiles p where p.id = r.requested_by and p.is_platform_admin)
    ) x
   where x.profile_id is not null;
end;
$function$;

-- Close orders already left open by a completed cancellation.
update public.orders o
   set status = 'cancelled'
 where o.status in ('pending_payment', 'partially_paid', 'paid', 'processing')
   and exists (
     select 1 from public.booking_requests br
      where br.order_id = o.id and br.kind = 'cancellation' and br.status = 'completed'
   )
   and not exists (
     select 1
       from public.order_items oi
       left join public.hotel_bookings hb on hb.id = oi.hotel_booking_id
       left join public.hall_bookings hl on hl.id = oi.hall_booking_id
       left join public.umrah_bookings ub on ub.id = oi.umrah_booking_id
       left join public.flight_bookings fb on fb.id = oi.flight_booking_id
      where oi.order_id = o.id
        and coalesce(hb.status::text, hl.status::text, ub.status::text, fb.status::text, 'active')
            not in ('cancelled', 'refunded')
   );
