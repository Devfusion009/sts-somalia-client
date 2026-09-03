-- Bookings taken while the catalogue was unpriced are stuck at zero.
--
-- createHotelBooking has always priced a stay itself — sum of
-- (price_override ?? base_price) per night x rooms — so nothing was ever
-- missing from the flow. But rooms seeded at base_price 0 (20260817000001)
-- made that sum 0, and the resulting orders kept the zero after
-- 20260903000006 gave the rooms real rates: the total is copied onto the
-- order at booking time, not read back from the room. Those orders sit in
-- the admin queue as "No price yet", asking staff to type a price the
-- catalogue can now answer for itself.
--
-- This reprices them from the same inputs the booking action uses, so a
-- repaired order is indistinguishable from one booked today.
--
-- Only unpaid orders: a paid or cancelled order is a financial record and
-- its total is what was actually agreed, whatever the catalogue says now.
create temp table repriced_orders on commit drop as
with target as (
  select
    hb.id            as booking_id,
    hb.room_id,
    hb.num_rooms,
    hb.check_in,
    hb.check_out,
    r.base_price,
    oi.id            as item_id,
    o.id             as order_id,
    o.agency_id
  from public.hotel_bookings hb
  join public.hotel_rooms r  on r.id = hb.room_id
  join public.order_items oi on oi.hotel_booking_id = hb.id
  join public.orders o       on o.id = oi.order_id
  where hb.total_price = 0
    and o.status = 'pending_payment'
),
netted as (
  select
    t.*,
    (
      -- check_out is exclusive, matching the booking action's night loop.
      select coalesce(sum(coalesce(inv.price_override, t.base_price)), 0)
      from generate_series(t.check_in::date, t.check_out::date - 1, interval '1 day') g(d)
      left join public.hotel_room_inventory inv
        on inv.room_id = t.room_id
       and inv.date = g.d::date
    ) * t.num_rooms as net
  from target t
)
select
  n.*,
  case
    when n.agency_id is null then 0
    else coalesce((
      -- Mirrors getAgencyMarkupAmount: a vertical-specific rule wins over the
      -- agency-wide default (item_type null).
      select round(
        case when m.markup_type = 'percent' then n.net * m.value / 100 else m.value end,
        2
      )
      from public.agency_markups m
      where m.agency_id = n.agency_id
        and (m.item_type = 'hotel' or m.item_type is null)
      order by (m.item_type is null)
      limit 1
    ), 0)
  end as markup
from netted n
where n.net > 0;

update public.hotel_bookings hb
set total_price = rp.net
from repriced_orders rp
where hb.id = rp.booking_id;

update public.order_items oi
set unit_price = rp.net,
    quantity = 1,
    total_price = rp.net
from repriced_orders rp
where oi.id = rp.item_id;

update public.orders o
set subtotal = rp.net,
    markup_amount = rp.markup,
    total = rp.net + rp.markup
from repriced_orders rp
where o.id = rp.order_id;

-- The last route back to a zero-priced stay: a per-date rate override of 0
-- would beat the room's own rate in that same night loop. Nullable stays
-- meaningful ("no override for this night"); zero does not.
alter table public.hotel_room_inventory
  add constraint hotel_room_inventory_price_override_positive
  check (price_override is null or price_override > 0);
