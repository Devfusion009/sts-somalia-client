-- ============================================================================
-- New enum values only. Postgres allows ALTER TYPE ... ADD VALUE inside a
-- transaction (PG 12+), but a value added in a transaction cannot be USED in
-- that same transaction — so these live alone here, and everything that
-- references them ('waitlisted' in triggers, 'venue_partner' in RPCs) lives
-- in the next migration file. Same split this repo already documents at the
-- bottom of 20260805000002_events_halls.sql for order_item_type.
-- ============================================================================

-- Manual-booking workflow: a booking request whose nights are fully booked is
-- not rejected — it is parked in the queue as 'waitlisted' until a slot frees
-- up or staff resolve it with the customer.
alter type public.booking_status add value if not exists 'waitlisted';

-- Fourth partner program: event-venue owners (halls), separate from hotel
-- partners — venues were previously an admin-only catalog.
alter type public.app_role add value if not exists 'venue_partner';
