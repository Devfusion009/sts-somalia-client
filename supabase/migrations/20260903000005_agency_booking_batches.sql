-- Group booking from the agent desk: one product (an Umrah departure, a
-- room and dates, a hall) booked for several of the agency's customers in a
-- single pass at the counter — the Somali agency case is 20-30 pilgrims on
-- one departure, entered once rather than 30 times.
--
-- Deliberately N separate orders sharing an id, NOT one order with N items.
-- Every downstream mechanism this platform already has — cancellation,
-- refunds, per-customer invoices, commission entries, the hotel allocator's
-- per-booking seat/room accounting — is keyed to a single order for a single
-- customer. One fat order would have to re-implement all of it to let one
-- pilgrim drop out; separate orders get it for free, and the batch id is
-- only what the desk needs to show them together and settle them together.
--
-- No batch table: nothing is stored about a batch beyond the fact that these
-- orders were placed in one go, and a bare uuid carries that. Add one only
-- if a batch ever grows attributes of its own (a label, an organiser).
alter table public.orders add column booking_batch_id uuid;

comment on column public.orders.booking_batch_id is
  'Set when the agent booking desk placed several orders for different agency customers in one submission. Null for every single-customer booking.';

-- The desk reads a batch back by id to render and pay it; there is no other
-- access path, and batches are small, so a plain partial index is enough.
create index orders_booking_batch_id_idx
  on public.orders (booking_batch_id)
  where booking_batch_id is not null;
