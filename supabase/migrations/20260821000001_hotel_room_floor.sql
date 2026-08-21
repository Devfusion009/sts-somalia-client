-- Room type detail was thinner than what operators actually need to
-- register a room type against a real property: which floor(s) it sits
-- on. Free text, not an integer — real hotels label floors "Ground",
-- "Mezzanine", "2-3", not just numbers, and this is descriptive metadata
-- on a room TYPE (Booking.com's own extranet calls the equivalent field
-- "location"), not a physical-unit identifier — hotel_rooms models types
-- with date-based inventory (hotel_room_inventory), not individual
-- numbered rooms, so no room_number column belongs here.
alter table public.hotel_rooms add column floor text;
