-- Offline-booking sync: a manager recording a phone/walk-in booking must
-- write into the exact same table and go through the exact same capacity
-- allocator an online booking does — a separate "blocked dates" tracker
-- would be a second, unsynced ledger, which is the bug this closes, not a
-- feature to add. 'source' is purely descriptive (which desk it came
-- through), never read by the allocator or by priority/displacement —
-- channel ('b2b'/'b2c') already carries the meaning that actually affects
-- allocation and stays untouched.
alter table public.hotel_bookings
  add column source text not null default 'online' check (source in ('online', 'offline'));

comment on column public.hotel_bookings.source is
  'online = the customer/agent booking flow. offline = a manager recorded it (phone/walk-in) from the Rooms & Availability or Front Desk page. Display-only — never affects capacity/priority.';
