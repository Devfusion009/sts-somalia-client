-- Instant-booking hotels confirm on payment.
--
-- booking_mode = 'instant' promises live availability: the guest picks a
-- room, pays, and holds a confirmed stay. Until now nothing moved the hotel
-- booking out of 'pending' when its order was paid, so every paid instant
-- booking sat in the admin queue under "Needs a decision" and the guest saw
-- "Request received" for a stay they had already paid for.
--
-- Manual hotels are untouched: STS confirms those by hand before payment.
-- Only 'pending' rows move — a waitlisted, cancelled or already-confirmed
-- booking keeps its status. pending -> confirmed stays inside the
-- unit-holding statuses, so the allocator does not re-run, and the existing
-- hotel_bookings_decided trigger notifies the guest.

create or replace function public.confirm_instant_hotel_bookings_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('paid', 'partially_paid')
     and old.status is distinct from new.status
     and old.status not in ('paid', 'partially_paid') then
    update public.hotel_bookings hb
       set status = 'confirmed'
      from public.order_items oi
      join public.hotels h on true
     where oi.order_id = new.id
       and oi.hotel_booking_id = hb.id
       and h.id = hb.hotel_id
       and h.booking_mode = 'instant'
       and hb.status = 'pending';
  end if;
  return new;
end;
$$;

revoke execute on function public.confirm_instant_hotel_bookings_on_payment() from public, anon, authenticated;

drop trigger if exists orders_confirm_instant_hotel_bookings on public.orders;
create trigger orders_confirm_instant_hotel_bookings
  after update of status on public.orders
  for each row execute function public.confirm_instant_hotel_bookings_on_payment();

-- Paid instant bookings already stuck in 'pending' before this migration.
update public.hotel_bookings hb
   set status = 'confirmed'
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  join public.hotels h on true
 where oi.hotel_booking_id = hb.id
   and h.id = hb.hotel_id
   and h.booking_mode = 'instant'
   and hb.status = 'pending'
   and o.status in ('paid', 'partially_paid');
