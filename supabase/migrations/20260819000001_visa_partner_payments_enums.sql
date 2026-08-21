-- ============================================================================
-- New enum values/types only — see the split rationale documented in
-- 20260815000001_enum_values_waitlist_venue_partner.sql: a value added to an
-- existing enum can't be used in the same transaction it was added in, so
-- anything that references 'partially_paid' (the settlement trigger) lives in
-- the next migration file.
-- ============================================================================

-- Orders can now be settled by more than one payment (a deposit followed by
-- a balance payment) — this is the "some, but not all, of the total is in"
-- state between 'pending_payment' and 'paid'.
alter type public.order_status add value if not exists 'partially_paid';

-- visa_types.processing_mode is a brand-new type (not an existing enum
-- gaining a value), so it's safe to use immediately in later statements —
-- including later in this same migration, or the next one.
create type public.visa_processing_mode as enum ('in_house', 'partner');
