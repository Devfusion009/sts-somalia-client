-- Instant flight booking.
--
-- The manual quote flow (traveller requests, staff quote a fare, staff key in
-- the PNR) is replaced by provider booking: the API prices the selected
-- offer, creates the order at that price, and once the order is paid in full
-- a worker books it with the provider (Amadeus) and records the PNR and
-- ticket numbers. Booking and pricing run in the API with the service role;
-- this migration holds the state machine and its guards.
--
-- ticketing_status:
--   awaiting_payment  priced, order unpaid (payable for FARE_HOLD minutes)
--   queued            order paid in full, waiting for the worker
--   booking           worker is creating the provider order
--   booked            PNR created, ticket numbers not issued yet
--   ticketed          ticket numbers recorded
--   failed            provider booking failed three times; staff follow up
--   expired           fare hold lapsed before payment
-- Rows from the old quote flow keep ticketing_status = null.

alter table public.flight_bookings
  add column offer_snapshot jsonb,
  add column priced_at timestamptz,
  add column contact_email text,
  add column contact_phone text,
  add column ticketing_status text
    check (ticketing_status in ('awaiting_payment', 'queued', 'booking', 'booked', 'ticketed', 'failed', 'expired')),
  add column ticketing_attempts smallint not null default 0,
  add column ticketing_claimed_at timestamptz,
  add column ticketing_error text,
  add column provider_order_id text,
  add column ticket_numbers text[] not null default '{}',
  add column booked_at timestamptz,
  add column ticketed_at timestamptz;

create index flight_bookings_ticketing_idx
  on public.flight_bookings (ticketing_status, ticketing_claimed_at)
  where ticketing_status in ('awaiting_payment', 'queued', 'booking', 'booked');

alter table public.flight_passengers
  add column first_name text,
  add column last_name text,
  add column gender text check (gender in ('male', 'female')),
  add column passport_country text,
  add column traveler_ref text;

-- Travellers no longer create flight bookings directly: the quote-request
-- insert path is closed and every booking is written by the API.
drop policy if exists "flight_bookings: customer creates own booking" on public.flight_bookings;
drop trigger if exists flight_bookings_notify_admins_quote on public.flight_bookings;
drop function if exists public.notify_admins_flight_quote_request();

/**
 * Payment guards for orders that carry a flight:
 *  - the fare is paid in full in one payment (an airline ticket can't be
 *    issued against a deposit);
 *  - the priced fare must still be within its hold window.
 * Covers every rail, including the agency wallet RPC, because all of them
 * insert into payments.
 */
create or replace function public.guard_flight_order_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_flight public.flight_bookings;
  v_total numeric;
  v_paid numeric;
begin
  select fb.* into v_flight
    from public.order_items oi
    join public.flight_bookings fb on fb.id = oi.flight_booking_id
   where oi.order_id = new.order_id and fb.ticketing_status is not null
   limit 1;
  if not found then
    return new;
  end if;

  if v_flight.ticketing_status <> 'awaiting_payment' then
    raise exception 'flight_not_payable';
  end if;
  if v_flight.priced_at is null or v_flight.priced_at < now() - interval '30 minutes' then
    raise exception 'offer_expired';
  end if;

  select total into v_total from public.orders where id = new.order_id;
  select coalesce(sum(amount), 0) into v_paid
    from public.payments where order_id = new.order_id and status = 'succeeded';
  if new.amount < v_total - v_paid - 0.01 then
    raise exception 'flight_full_payment_required';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_flight_order_payment() from public, anon, authenticated;
create trigger guard_flight_order_payment
  before insert on public.payments
  for each row execute function public.guard_flight_order_payment();

/** Paid in full: hand the booking to the ticketing worker. */
create or replace function public.queue_flight_ticketing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'paid' and old.status is distinct from new.status then
    update public.flight_bookings fb
       set ticketing_status = 'queued', ticketing_error = null
      from public.order_items oi
     where oi.order_id = new.id
       and oi.flight_booking_id = fb.id
       and fb.ticketing_status in ('awaiting_payment', 'expired');
  end if;
  return new;
end;
$$;

revoke all on function public.queue_flight_ticketing() from public, anon, authenticated;
create trigger orders_queue_flight_ticketing
  after update of status on public.orders
  for each row execute function public.queue_flight_ticketing();

/**
 * Claims paid bookings for the provider call. SKIP LOCKED keeps two API
 * instances from booking the same fare twice; a row stuck in 'booking' (the
 * worker died mid-call) is reclaimed after ten minutes, at most three tries.
 */
create or replace function public.claim_flight_ticketing(p_limit integer default 5)
returns setof public.flight_bookings
language sql
security definer
set search_path = public
as $$
  update public.flight_bookings fb
     set ticketing_status = 'booking',
         ticketing_claimed_at = now(),
         ticketing_attempts = fb.ticketing_attempts + 1
   where fb.id in (
     select q.id
       from public.flight_bookings q
      where q.ticketing_attempts < 3
        and (
          q.ticketing_status = 'queued'
          or (q.ticketing_status = 'booking' and q.ticketing_claimed_at < now() - interval '10 minutes')
        )
      order by q.updated_at
      limit greatest(1, least(coalesce(p_limit, 5), 20))
      for update skip locked
   )
  returning fb.*;
$$;

/**
 * Booked orders whose ticket numbers haven't arrived yet, checked at most
 * every five minutes each, for up to three days after booking.
 */
create or replace function public.claim_flight_ticket_checks(p_limit integer default 10)
returns setof public.flight_bookings
language sql
security definer
set search_path = public
as $$
  update public.flight_bookings fb
     set ticketing_claimed_at = now()
   where fb.id in (
     select q.id
       from public.flight_bookings q
      where q.ticketing_status = 'booked'
        and q.provider_order_id is not null
        and q.booked_at > now() - interval '3 days'
        and (q.ticketing_claimed_at is null or q.ticketing_claimed_at < now() - interval '5 minutes')
      order by q.ticketing_claimed_at nulls first
      limit greatest(1, least(coalesce(p_limit, 10), 50))
      for update skip locked
   )
  returning fb.*;
$$;

/** Unpaid fares past their hold: close the booking and its unpaid order. */
create or replace function public.expire_flight_fares()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.flight_bookings
       set ticketing_status = 'expired', status = 'cancelled'
     where ticketing_status = 'awaiting_payment'
       and priced_at < now() - interval '30 minutes'
       -- A payment started inside the hold may still settle (mobile money).
       and not exists (
         select 1
           from public.order_items oi
           join public.payments p on p.order_id = oi.order_id
          where oi.flight_booking_id = flight_bookings.id
            and p.status in ('processing', 'requires_action')
            and p.created_at > now() - interval '2 hours'
       )
    returning id
  )
  update public.orders o
     set status = 'cancelled'
    from public.order_items oi
   where oi.order_id = o.id
     and oi.flight_booking_id in (select id from expired)
     and o.status in ('pending_payment', 'held');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.claim_flight_ticketing(integer) from public, anon, authenticated;
revoke all on function public.claim_flight_ticket_checks(integer) from public, anon, authenticated;
revoke all on function public.expire_flight_fares() from public, anon, authenticated;
grant execute on function public.claim_flight_ticketing(integer) to service_role;
grant execute on function public.claim_flight_ticket_checks(integer) to service_role;
grant execute on function public.expire_flight_fares() to service_role;
