-- Every room must carry a nightly rate.
--
-- 20260817000001 seeded 50 manual Somali hotels with base_price 0 meaning
-- "price on request", on the expectation that the client would supply real
-- rates later. They never were, and the consequence surfaced through the
-- agent booking desk: an agent booked two rooms for two customers and got
-- two USD 0 orders sitting at "Pending Payment". Nothing downstream can work
-- from a zero — not the agency markup, not the commission entry, not the
-- wallet debit, not a quote to the walk-in standing at the counter.
--
-- Two halves, and both are needed: real prices for the rows that have none,
-- and a constraint so no future seed or form can put the catalogue back into
-- this state. The app-side schemas (modules/hotels/partner-actions.ts and
-- modules/admin/actions.ts) reject 0 as well, for a readable error before it
-- ever reaches the database.

-- ----------------------------------------------------------------------------
-- 1. Placeholder market rates, by city and star rating.
--
-- PLACEHOLDER, NOT CLIENT DATA. These are ordinary Somali market rates for a
-- standard double, calibrated against the 13 rooms that already carry real
-- prices in this database (4-star Mogadishu standard twin 95, 5-star ocean
-- deluxe 145, 3-star Hargeisa queen 75) so the catalogue reads as one
-- coherent price list rather than two. Every one of these is meant to be
-- overwritten by the client's real rate from the admin room form.
-- ----------------------------------------------------------------------------
update public.hotel_rooms r
set base_price = case
      when h.city = 'Mogadishu' then
        case h.star_rating when 5 then 140 when 4 then 95 when 3 then 65 when 2 then 40 else 65 end
      when h.city = 'Hargeisa' then
        case h.star_rating when 5 then 115 when 4 then 85 when 3 then 55 when 2 then 35 else 55 end
      when h.city = 'Berbera' then
        case h.star_rating when 5 then 125 when 4 then 85 when 3 then 55 when 2 then 35 else 55 end
      when h.city = 'Garowe' then
        case h.star_rating when 5 then 100 when 4 then 75 when 3 then 48 when 2 then 30 else 48 end
      else
        case h.star_rating when 5 then 95 when 4 then 70 when 3 then 45 when 2 then 28 else 45 end
    end
from public.hotels h
where h.id = r.hotel_id
  and r.base_price = 0;

-- The seeded blurb promised a rate would be quoted later, which is no longer
-- true of these rooms. Cleared rather than rewritten — an empty description
-- renders fine, and inventing per-hotel copy here would be worse than none.
update public.hotel_rooms
set description = null
where description = 'Room type and rate confirmed by STS when your booking request is processed.';

-- ----------------------------------------------------------------------------
-- 2. The rule itself.
--
-- Deliberately > 0 rather than >= 0: "free" is not a real nightly rate, and 0
-- was exactly the value that let unpriced inventory look bookable. A hotel
-- that genuinely cannot publish a rate belongs in draft status, not published
-- at zero.
-- ----------------------------------------------------------------------------
alter table public.hotel_rooms
  add constraint hotel_rooms_base_price_positive check (base_price > 0);
