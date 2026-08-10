-- ============================================================================
-- B2B Portal Phase 2 — booking lifecycle
-- 1) Hold bookings: reserve without paying, agencies convert or let expire.
-- 2) Unified cancel-order cascade (order + underlying booking + inventory
--    release), replacing the ad-hoc per-vertical "customer cancels own
--    pending booking" policies with one atomic, auditable entry point.
-- 3) Missing hall_bookings self-cancel RLS parity (hotel/flight/umrah had it,
--    hall didn't).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Hold bookings
-- ----------------------------------------------------------------------------
alter type public.order_status add value 'held';

alter table public.orders add column hold_expires_at timestamptz;

comment on column public.orders.hold_expires_at is
  'Set only when status=''held''. Past this instant the hold is stale — cancel_order()/expire_stale_holds() clear it.';

-- ----------------------------------------------------------------------------
-- 2) Unified cancellation
--
-- _apply_order_cancellation does the actual writes, no ownership check —
-- callable only from the two entry points below, both of which authorize
-- first. Keeping the write logic in one place means the order and its
-- underlying booking (and, for hotels, room inventory via the pre-existing
-- release_room_inventory trigger) can never drift out of sync.
-- ----------------------------------------------------------------------------
create or replace function public._apply_order_cancellation(target_order_id uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
begin
  update public.orders
    set status = 'cancelled', notes = coalesce(reason, notes)
    where id = target_order_id and status in ('held', 'pending_payment');

  for item in select * from public.order_items where order_id = target_order_id loop
    if item.hotel_booking_id is not null then
      update public.hotel_bookings set status = 'cancelled'
        where id = item.hotel_booking_id and status <> 'cancelled';
    elsif item.flight_booking_id is not null then
      update public.flight_bookings set status = 'cancelled'
        where id = item.flight_booking_id and status <> 'cancelled';
    elsif item.umrah_booking_id is not null then
      update public.umrah_bookings set status = 'cancelled'
        where id = item.umrah_booking_id and status <> 'cancelled';
    elsif item.hall_booking_id is not null then
      update public.hall_bookings set status = 'cancelled'
        where id = item.hall_booking_id and status <> 'cancelled';
    elsif item.visa_application_id is not null then
      update public.visa_applications set status = 'cancelled'
        where id = item.visa_application_id and status <> 'cancelled';
    end if;
  end loop;
end;
$$;

-- User-facing entry point: the caller must be able to see the order
-- (customer/booker/agency member/admin, via the existing can_access_order),
-- and it must still be pre-payment.
create or replace function public.cancel_order(target_order_id uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ord public.orders;
begin
  if not public.can_access_order(target_order_id) then
    raise exception 'not authorized to cancel this order';
  end if;

  select * into ord from public.orders where id = target_order_id for update;
  if not found then
    raise exception 'order not found';
  end if;
  if ord.status not in ('held', 'pending_payment') then
    raise exception 'only held or unpaid orders can be cancelled';
  end if;

  perform public._apply_order_cancellation(target_order_id, reason);
end;
$$;

-- Admin-triggered sweep for stale holds (no per-order ownership check needed
-- — it only ever touches orders already past their own expiry). Manual for
-- now; wire to pg_cron later if the client wants automatic sweeping.
create or replace function public.expire_stale_holds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_id uuid;
  swept integer := 0;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  for expired_id in
    select id from public.orders where status = 'held' and hold_expires_at < now()
  loop
    perform public._apply_order_cancellation(expired_id, 'Hold expired');
    swept := swept + 1;
  end loop;

  return swept;
end;
$$;

-- Converts a held order into a normal checkout-ready order (clears the
-- hold expiry so it never gets swept once payment is underway). Same
-- authorization shape as cancel_order — orders has no client UPDATE policy
-- at all, so this is the only way a booker moves their own hold forward.
create or replace function public.convert_hold_to_checkout(target_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_access_order(target_order_id) then
    raise exception 'not authorized to modify this order';
  end if;

  update public.orders
    set status = 'pending_payment', hold_expires_at = null
    where id = target_order_id and status = 'held';

  if not found then
    raise exception 'order is not a held booking';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) hall_bookings self-cancel RLS parity (hotel/flight/umrah already had
-- this before Phase 2 — it's unused by the new cancel_order() path, which
-- runs as SECURITY DEFINER, but keeping every vertical's direct-access RLS
-- symmetric matters if anything else ever queries these tables directly).
-- ----------------------------------------------------------------------------
create policy "hall_bookings: customer cancels own pending booking"
  on public.hall_bookings for update to authenticated
  using ((customer_id = auth.uid() or booked_by = auth.uid()) and status = 'pending')
  with check (status in ('pending', 'cancelled'));
