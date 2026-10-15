-- ============================================================================
-- New enum value only — a value added by ALTER TYPE ... ADD VALUE can't be
-- USED in the same transaction it was added in (see 20260815000001), so
-- everything that references 'venue_manager' lives in the next migration.
--
-- Venue managers are the event-hall counterpart of 'hotel_manager': a person
-- admin (or the venue's owning partner) assigns to run ONE venue's booking
-- desk and calendar. See 20261013000003_venue_managers.sql.
-- ============================================================================
alter type public.app_role add value if not exists 'venue_manager';
