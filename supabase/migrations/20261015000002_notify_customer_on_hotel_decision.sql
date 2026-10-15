-- A hotel request that is decided closes its loop in one place.
--
-- Before: confirm / decline happened silently (the guest only found out by
-- reopening the booking page), and only the admin console cancelled the
-- unpaid order behind a declined request — a partner or manager decline left
-- the order payable. One trigger on hotel_bookings now covers every path
-- that can decide a request (admin queue, partner and manager consoles):
--   * confirm  -> notify the guest (payment follows from their booking page)
--   * cancel   -> notify the guest, then cancel the unpaid order
--
-- A cancel the customer made themselves (cancel_order flips the order to
-- 'cancelled' before it cancels the booking) is not announced back to them.
-- Front-desk (source = 'offline') bookings and order-less rows (an aborted
-- checkout) have no online guest to tell.

create or replace function public.hotel_booking_decided()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hotel text;
  v_order_id uuid;
  v_order_status public.order_status;
  v_title text;
  v_body text;
  v_type text;
  v_stay text;
begin
  if new.source = 'offline' or old.status is not distinct from new.status then
    return new;
  end if;

  select o.id, o.status
    into v_order_id, v_order_status
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.hotel_booking_id = new.id
   limit 1;

  -- A booking with no order is a failed checkout being rolled back, not a decision.
  if v_order_id is null then
    return new;
  end if;

  select h.name into v_hotel from public.hotels h where h.id = new.hotel_id;
  v_stay := new.check_in || ' to ' || new.check_out;

  if new.status = 'confirmed' and old.status in ('pending', 'waitlisted') then
    v_type := 'booking_confirmed';
    v_title := 'Booking confirmed — ' || v_hotel;
    v_body := v_stay || '.'
      || case when v_order_status = 'pending_payment' then ' Complete payment to secure it.' else '' end;
  elsif new.status = 'cancelled' and old.status in ('pending', 'waitlisted', 'confirmed')
        and coalesce(v_order_status::text, '') <> 'cancelled' then
    v_type := 'booking_declined';
    v_title := case when old.status = 'confirmed' then 'Booking cancelled — ' else 'Request declined — ' end || v_hotel;
    v_body := v_stay || '.';
  else
    return new;
  end if;

  if v_type = 'booking_declined' and v_order_status in ('held', 'pending_payment') then
    update public.orders set status = 'cancelled' where id = v_order_id;
  end if;

  insert into public.notifications (profile_id, type, title, body, data)
  select distinct p.profile_id, v_type, v_title, v_body,
         jsonb_build_object('hotel_booking_id', new.id, 'order_id', v_order_id)
    from (values (new.customer_id), (new.booked_by)) as p(profile_id)
   where p.profile_id is not null;

  return new;
end;
$$;

drop trigger if exists hotel_bookings_decided on public.hotel_bookings;

create trigger hotel_bookings_decided
  after update of status on public.hotel_bookings
  for each row execute function public.hotel_booking_decided();
