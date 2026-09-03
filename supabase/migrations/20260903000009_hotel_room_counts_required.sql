-- Every room must carry a real unit count — the same gap as
-- hotel_rooms_base_price_positive (20260903000006), on the column
-- 20260903000001 added for the availability allocator.
--
-- hotel_room_nights computes capacity as coalesce(inventory-override,
-- hotel_rooms.total_units); room_units_left then drops any night whose
-- capacity is null. Every one of the 63 rooms in this catalog had
-- total_units = null, so EVERY hotel's availability grid was empty — not
-- one property could show a real "units left" number, which is exactly
-- what surfaced as "Count not set" and a row of dashes in the hotel
-- manager's own Rooms & Availability screen.

-- ----------------------------------------------------------------------------
-- 1. Placeholder unit counts, by the room's own name.
--
-- PLACEHOLDER, NOT CLIENT DATA — "how many physical rooms of this type
-- exist" is business fact only the property can supply, same as the price
-- backfill. Differentiated by name because that's the one signal already in
-- the data: a suite-class room is architecturally rarer than a standard
-- room in any real hotel, so treating them identically would have been a
-- worse placeholder than none. Every one of these is meant to be
-- overwritten by the property's real count from the room form.
-- ----------------------------------------------------------------------------
update public.hotel_rooms
set total_units = case
      when name ~* 'suite|executive|diplomatic|presidential|villa' then 2
      when name ~* 'family|quad' then 3
      else 6
    end
where total_units is null;

-- ----------------------------------------------------------------------------
-- 2. The rule itself — mirrors hotel_rooms_base_price_positive exactly.
-- ----------------------------------------------------------------------------
alter table public.hotel_rooms
  alter column total_units set not null;

alter table public.hotel_rooms
  add constraint hotel_rooms_total_units_positive check (total_units > 0);
