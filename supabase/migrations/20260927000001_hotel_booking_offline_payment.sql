-- ============================================================================
-- Offline reservation payment capture
--
-- A reservation recorded at the front desk (walk-in / phone) is settled
-- outside the online order flow — cash at the counter, a card terminal,
-- EVC Plus, a bank transfer. These columns record HOW and WHETHER it was
-- paid; they are not a payment integration. Online bookings leave all three
-- null: their payment lives on orders / order_items as before.
--
-- paid_at mirrors checked_in_at / checked_out_at on this table: a timestamp
-- that is null until the event happens, rather than a separate status enum.
-- None of these columns touch status, so neither allocator trigger fires on
-- a payment update (hotel_bookings_allocate_on_status_change is BEFORE
-- UPDATE OF status).
-- ============================================================================

alter table public.hotel_bookings
  add column payment_method text
    check (payment_method in ('cash', 'card', 'mobile_money', 'bank_transfer')),
  add column paid_at timestamptz,
  add column payment_reference text
    check (char_length(payment_reference) <= 120);
