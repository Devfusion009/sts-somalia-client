-- Departure lifecycle: change alerts, cancelling a departure, and closing
-- finished trips.
--
-- 1. A change to a departure's dates or flights after sale notified nobody.
--    Every holder of a live booking on it now gets 'umrah_departure_changed'.
-- 2. cancel_umrah_departure: STS cancels a whole departure. Unpaid bookings
--    are cancelled outright; paid ones get an approved cancellation request
--    for the full amount paid, which staff settle from /admin/refunds.
-- 3. _complete_finished_umrah_trips: bookings at 'documents_ready' whose trip
--    has ended move to 'completed' (daily cron).

-- ----------------------------------------------------------------------------
-- 1. Change alerts
-- ----------------------------------------------------------------------------
create or replace function public.umrah_departures_notify_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
begin
  if new.departure_date is not distinct from old.departure_date
     and new.return_date is not distinct from old.return_date
     and new.outbound_airline is not distinct from old.outbound_airline
     and new.outbound_flight_number is not distinct from old.outbound_flight_number
     and new.outbound_departs_at is not distinct from old.outbound_departs_at
     and new.outbound_arrives_at is not distinct from old.outbound_arrives_at
     and new.return_airline is not distinct from old.return_airline
     and new.return_flight_number is not distinct from old.return_flight_number
     and new.return_departs_at is not distinct from old.return_departs_at
     and new.return_arrives_at is not distinct from old.return_arrives_at then
    return new;
  end if;

  select name into v_label from public.umrah_packages where id = new.package_id;

  insert into public.notifications (profile_id, type, title, body, data)
  select distinct r.profile_id, 'umrah_departure_changed', 'Umrah travel details changed',
         coalesce(v_label, 'Umrah') || ', departing ' || to_char(new.departure_date, 'DD Mon YYYY') || '.',
         jsonb_build_object('bookingId', r.booking_id, 'orderId', r.order_id)
  from (
    select b.id as booking_id, b.customer_id as profile_id,
           (select oi.order_id from public.order_items oi where oi.umrah_booking_id = b.id limit 1) as order_id
      from public.umrah_bookings b
     where b.departure_id = new.id and b.status in ('pending', 'confirmed')
    union
    select b.id, b.booked_by,
           (select oi.order_id from public.order_items oi where oi.umrah_booking_id = b.id limit 1)
      from public.umrah_bookings b
     where b.departure_id = new.id and b.status in ('pending', 'confirmed')
    union
    select b.id, m.profile_id,
           (select oi.order_id from public.order_items oi where oi.umrah_booking_id = b.id limit 1)
      from public.umrah_bookings b
      join public.agency_members m on m.agency_id = b.agency_id and m.status = 'active'
     where b.departure_id = new.id and b.status in ('pending', 'confirmed')
  ) r
  where r.profile_id is not null;

  return new;
end;
$$;

revoke execute on function public.umrah_departures_notify_change() from public, anon, authenticated;

drop trigger if exists umrah_departures_notify_change on public.umrah_package_departures;
create trigger umrah_departures_notify_change
  after update on public.umrah_package_departures
  for each row execute function public.umrah_departures_notify_change();

-- ----------------------------------------------------------------------------
-- 2. Cancel a departure
-- ----------------------------------------------------------------------------
create or replace function public.cancel_umrah_departure(p_departure_id uuid, p_reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  dep public.umrah_package_departures;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  r record;
  v_paid numeric;
  v_request_id uuid;
  v_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Only STS staff can cancel a departure.';
  end if;
  if v_reason is null then
    raise exception 'Enter a reason.';
  end if;

  select * into dep from public.umrah_package_departures where id = p_departure_id for update;
  if not found then
    raise exception 'Departure not found.';
  end if;
  if dep.status = 'cancelled' then
    raise exception 'This departure is already cancelled.';
  end if;
  if dep.departure_date <= current_date then
    raise exception 'This departure has already left.';
  end if;

  update public.umrah_package_departures set status = 'cancelled' where id = dep.id;

  perform set_config('sts.umrah_close_note', v_reason, true);

  for r in
    select b.id as booking_id, lo.id as order_id, lo.status as order_status, lo.currency
      from public.umrah_bookings b
      left join lateral (
        select o.id, o.status, o.currency from public.order_items oi join public.orders o on o.id = oi.order_id
         where oi.umrah_booking_id = b.id order by o.created_at desc limit 1
      ) lo on true
     where b.departure_id = dep.id
       and b.status in ('pending', 'confirmed')
     for update of b
  loop
    if r.order_id is null then
      update public.umrah_bookings set status = 'cancelled' where id = r.booking_id;
    elsif r.order_status in ('held', 'pending_payment') then
      perform public._apply_order_cancellation(r.order_id, v_reason);
    elsif r.order_status in ('cancelled', 'refunded') then
      update public.umrah_bookings set status = 'cancelled' where id = r.booking_id;
    else
      -- What is still refundable: paid, less refunds already approved.
      select coalesce(sum(amount), 0) into v_paid
        from public.payments
       where order_id = r.order_id and status in ('succeeded', 'partially_refunded');
      v_paid := greatest(v_paid - coalesce((
        select sum(br.approved_amount) from public.booking_requests br
         where br.order_id = r.order_id
           and br.kind in ('cancellation', 'refund')
           and br.status in ('approved', 'completed')
      ), 0), 0);
      insert into public.booking_requests (
        order_id, requested_by, kind, status, reason, requested_amount, currency, umrah_booking_id
      ) values (
        r.order_id, auth.uid(), 'cancellation', 'requested', v_reason, v_paid, r.currency, r.booking_id
      )
      returning id into v_request_id;
      perform public._resolve_umrah_booking_request(v_request_id, 'approved', v_paid, v_reason, false);
    end if;
    v_count := v_count + 1;
  end loop;

  perform set_config('sts.umrah_close_note', '', true);
  return v_count;
end;
$$;

revoke execute on function public.cancel_umrah_departure(uuid, text) from public, anon;
grant execute on function public.cancel_umrah_departure(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Finished trips
-- ----------------------------------------------------------------------------
create or replace function public._complete_finished_umrah_trips()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    select b.id
      from public.umrah_bookings b
      left join public.umrah_package_departures d on d.id = b.departure_id
      left join public.umrah_custom_requests cr on cr.id = b.custom_request_id
     where b.fulfillment_stage = 'documents_ready'
       and b.status = 'confirmed'
       and coalesce(d.return_date, cr.departure_date + (cr.nights_makkah + cr.nights_madinah)) < current_date
  loop
    begin
      perform public.apply_umrah_stage_transition_internal(v_id, 'completed', null, 'Trip ended');
      v_count := v_count + 1;
    exception when others then
      null;
    end;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public._complete_finished_umrah_trips() from public, anon, authenticated;
grant execute on function public._complete_finished_umrah_trips() to service_role;
