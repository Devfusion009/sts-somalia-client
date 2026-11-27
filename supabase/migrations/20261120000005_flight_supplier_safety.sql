create or replace function public.flight_supplier_ready()
returns boolean language sql stable security definer set search_path = public
as $$ select true $$;
revoke all on function public.flight_supplier_ready() from public, anon, authenticated;
grant execute on function public.flight_supplier_ready() to service_role;

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
  if v_flight.priced_at is null or coalesce((v_flight.raw_payload->>'offer_expires_at')::timestamptz, v_flight.priced_at + interval '30 minutes') <= now() then
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


-- A crashed provider call has an unknown outcome. Never create another order
-- automatically. Staff must reconcile with the supplier before an explicit retry.
create or replace function public.claim_flight_ticketing(p_limit integer default 5)
returns setof public.flight_bookings
language plpgsql security definer set search_path = public
as $$
begin
  update public.flight_bookings
     set ticketing_status = 'failed',
         ticketing_error = 'Supplier outcome unknown after worker interruption. Reconcile before retrying.'
   where ticketing_status = 'booking'
     and ticketing_claimed_at < now() - interval '10 minutes';
  return query
  update public.flight_bookings fb
     set ticketing_status = 'booking', ticketing_claimed_at = now(),
         ticketing_attempts = fb.ticketing_attempts + 1
   where fb.id in (
     select q.id from public.flight_bookings q
      where q.ticketing_status = 'queued' and q.ticketing_attempts < 3
        and q.provider_order_id is null
      order by q.updated_at
      limit greatest(1, least(coalesce(p_limit, 5), 20))
      for update skip locked
   ) returning fb.*;
end;
$$;

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
       and coalesce((raw_payload->>'offer_expires_at')::timestamptz, priced_at + interval '30 minutes') <= now()
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
