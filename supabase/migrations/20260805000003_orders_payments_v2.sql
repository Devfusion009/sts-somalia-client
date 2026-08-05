-- ============================================================================
-- Orders & Payments v2
-- 1) Wire hall bookings into the unified order ledger.
-- 2) Provider-agnostic payment plumbing: the app layer exposes whichever
--    gateways are configured via env (Stripe, WaafiPay, eDahab, ...) plus
--    always-available manual methods (bank transfer / pay at office); the
--    ledger just records provider + provider_ref + method_label uniformly.
-- 3) Succeeded payments auto-mark their order paid (which in turn drives the
--    existing affiliate-conversion trigger on orders).
-- ============================================================================

alter table public.order_items
  add column hall_booking_id uuid references public.hall_bookings (id);

alter table public.order_items drop constraint order_items_exactly_one_target;
alter table public.order_items add constraint order_items_exactly_one_target check (
    (case when hotel_booking_id is not null then 1 else 0 end)
  + (case when flight_booking_id is not null then 1 else 0 end)
  + (case when visa_application_id is not null then 1 else 0 end)
  + (case when umrah_booking_id is not null then 1 else 0 end)
  + (case when hall_booking_id is not null then 1 else 0 end) = 1
);

alter table public.order_items drop constraint order_items_type_matches_target;
alter table public.order_items add constraint order_items_type_matches_target check (
  (item_type = 'hotel' and hotel_booking_id is not null) or
  (item_type = 'flight' and flight_booking_id is not null) or
  (item_type = 'visa' and visa_application_id is not null) or
  (item_type = 'umrah' and umrah_booking_id is not null) or
  (item_type = 'hall' and hall_booking_id is not null)
);

-- ----------------------------------------------------------------------------
-- Payments: provider-agnostic metadata
-- ----------------------------------------------------------------------------
alter table public.payments
  add column provider_ref text,       -- gateway transaction/session id
  add column method_label text,       -- human label shown on receipts ("ZAAD", "Visa •••• 4242")
  add column payer_phone text,        -- mobile-money payer number
  add column instructions text,       -- manual methods: what the customer should do next
  add column paid_at timestamptz;

alter table public.orders add column paid_at timestamptz;

-- ----------------------------------------------------------------------------
-- A payment reaching 'succeeded' settles its order exactly once. SECURITY
-- DEFINER because the payer's own RLS has no update rights on orders.
-- ----------------------------------------------------------------------------
create or replace function public.handle_payment_succeeded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'succeeded' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.paid_at := coalesce(new.paid_at, now());
    update public.orders
      set status = 'paid', paid_at = coalesce(paid_at, now())
      where id = new.order_id and status = 'pending_payment';
  end if;
  return new;
end;
$$;

create trigger payments_settle_order
  before insert or update of status on public.payments
  for each row execute function public.handle_payment_succeeded();
