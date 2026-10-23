-- Refunds are measured against money actually received, not the booking price.
--
-- Found in live QA (2026-10-23): a hall booking of USD 801 with a USD 400.50
-- deposit quoted "Refund if cancelled today USD 640.80". hotel_refund_quote
-- and hall_refund_quote treated any succeeded payment as the full price, the
-- venue/hotel-cancel triggers auto-approved a refund of the full price, and the
-- resolvers capped a refund at the booking total. A deposit-only booking could
-- therefore refund more than was paid.

-- ----------------------------------------------------------------------------
-- 1. What an order has actually received
-- ----------------------------------------------------------------------------
create or replace function public._order_amount_paid(p_order_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)
    from public.payments
   where order_id = p_order_id and status = 'succeeded';
$$;

revoke all on function public._order_amount_paid(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Quotes: the refund base is the paid amount
-- ----------------------------------------------------------------------------
create or replace function public.hotel_refund_quote(p_booking_id uuid, p_as_of date default current_date)
returns table (days_before integer, deduction_percent numeric, paid_amount numeric, refund_amount numeric, currency text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  hb public.hotel_bookings;
  v_partner uuid;
  v_days integer;
  v_pct numeric;
  v_paid numeric;
  v_order uuid;
begin
  select * into hb from public.hotel_bookings where id = p_booking_id;
  if not found then
    return;
  end if;

  select partner_id into v_partner from public.hotels where id = hb.hotel_id;
  if not (
    public.is_admin()
    or public.is_hotel_manager(hb.hotel_id)
    or public.is_hotel_partner_member(v_partner)
    or exists (
      select 1 from public.order_items oi
       where oi.hotel_booking_id = hb.id and public.can_access_order(oi.order_id)
    )
  ) then
    return;
  end if;

  v_days := greatest(hb.check_in - p_as_of, 0);

  if exists (select 1 from public.hotel_refund_rules r where r.hotel_id = hb.hotel_id) then
    select r.deduction_percent into v_pct
      from public.hotel_refund_rules r
     where r.hotel_id = hb.hotel_id and r.days_before <= v_days
     order by r.days_before desc
     limit 1;
    v_pct := coalesce(v_pct, 100);
  end if;

  select oi.order_id into v_order from public.order_items oi where oi.hotel_booking_id = hb.id limit 1;
  -- A desk booking marked paid has no payment rows; it was paid in full.
  v_paid := case
    when v_order is not null then public._order_amount_paid(v_order)
    when hb.paid_at is not null then hb.total_price
    else 0
  end;

  return query select
    v_days,
    v_pct,
    v_paid,
    case when v_pct is null then null else round(v_paid * (100 - v_pct) / 100, 2) end,
    hb.currency;
end;
$$;

create or replace function public.hall_refund_quote(p_booking_id uuid, p_as_of date default current_date)
returns table (days_before integer, deduction_percent numeric, paid_amount numeric, refund_amount numeric, currency text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  hb public.hall_bookings;
  v_partner uuid;
  v_days integer;
  v_pct numeric;
  v_paid numeric;
  v_order uuid;
begin
  select * into hb from public.hall_bookings where id = p_booking_id;
  if not found then
    return;
  end if;
  select partner_id into v_partner from public.event_venues where id = hb.venue_id;
  if not (
    public.is_admin()
    or public.is_venue_manager(hb.venue_id)
    or (v_partner is not null and public.is_venue_partner_member(v_partner))
    or exists (select 1 from public.order_items oi where oi.hall_booking_id = hb.id and public.can_access_order(oi.order_id))
  ) then
    return;
  end if;

  v_days := greatest(hb.start_date - p_as_of, 0);
  if exists (select 1 from public.venue_refund_rules r where r.venue_id = hb.venue_id) then
    select r.deduction_percent into v_pct
      from public.venue_refund_rules r
     where r.venue_id = hb.venue_id and r.days_before <= v_days
     order by r.days_before desc
     limit 1;
    v_pct := coalesce(v_pct, 100);
  end if;

  select oi.order_id into v_order from public.order_items oi where oi.hall_booking_id = hb.id limit 1;
  v_paid := case
    when v_order is not null then public._order_amount_paid(v_order)
    when hb.paid_at is not null then hb.price
    else 0
  end;

  return query select v_days, v_pct, v_paid,
    case when v_pct is null then null else round(v_paid * (100 - v_pct) / 100, 2) end,
    hb.currency;
end;
$$;

grant execute on function public.hotel_refund_quote(uuid, date) to authenticated;
grant execute on function public.hall_refund_quote(uuid, date) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. An approved refund never exceeds what the order received
-- ----------------------------------------------------------------------------
-- One guard for every path that approves a refund: the hotel/hall resolvers
-- (UPDATE) are refused with a message; the hotel/venue-cancel triggers
-- (INSERT, no person to correct it) are lowered to the paid amount so the
-- cancellation itself still goes through.
create or replace function public.booking_requests_refund_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paid numeric;
begin
  if new.status <> 'approved'
     or new.kind not in ('cancellation', 'refund')
     or coalesce(new.approved_amount, 0) <= 0 then
    return new;
  end if;

  v_paid := public._order_amount_paid(new.order_id);
  if new.approved_amount <= v_paid then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.approved_amount := v_paid;
    return new;
  end if;

  raise exception using
    errcode = 'P0001',
    message = format('Refund cannot exceed the amount paid (%s %s).', new.currency, to_char(v_paid, 'FM999999990.00'));
end;
$$;

drop trigger if exists booking_requests_refund_cap on public.booking_requests;
create trigger booking_requests_refund_cap
  before insert or update of status, approved_amount on public.booking_requests
  for each row execute function public.booking_requests_refund_cap();
