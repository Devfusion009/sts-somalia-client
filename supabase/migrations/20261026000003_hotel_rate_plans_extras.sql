-- Rate plans, extras and a database-priced hotel booking.
--
-- Modelled on a hotel-chain booking engine (Eurostars): every room type is
-- sold under one or more rate plans that combine a meal plan (room only,
-- breakfast, ...) with a cancellation policy (free cancellation until N days
-- before arrival, or non-refundable at a discount), and the guest can add
-- paid extras (late check-out, airport transfer, ...) before paying.
--
--   hotel_rate_plans  hotel-wide plans: meal plan + per-guest-per-night meal
--                     supplement, cancellation policy, discount on the room
--                     price
--   hotel_extras      paid add-ons priced per stay, per night, per guest or
--                     per guest per night
--   quote_hotel_stay  the one price formula; the booking page shows it and
--                     the database charges it
--
-- The booking stores a snapshot of the plan, the extras and the price
-- breakdown, so a later edit of a plan never changes a booking already made.
--
-- Also closes a pricing gap: a customer or agency session inserted its own
-- hotel_bookings.total_price and its own order totals, and could edit dates
-- or rooms on a pending booking after the order was priced. Now the database
-- prices every non-staff hotel booking itself, an order line must match its
-- booking's price, and a non-staff session can only change a booking's status
-- (RLS still limits that to cancelling). Hotel staff (admin, the hotel's
-- managers and partner) keep setting prices for offline bookings.
--
-- Last: a public price calendar (cheapest available nightly rate per date)
-- for the hotel page date picker, and refund quotes that follow the booking's
-- own cancellation policy.

-- ----------------------------------------------------------------------------
-- 1. Rate plans
-- ----------------------------------------------------------------------------
create table public.hotel_rate_plans (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  board text not null default 'room_only'
    check (board in ('room_only', 'breakfast', 'half_board', 'full_board', 'all_inclusive')),
  -- Meal supplement per guest per night, on top of the room price.
  board_price_adult numeric(10,2) not null default 0 check (board_price_adult >= 0),
  board_price_child numeric(10,2) not null default 0 check (board_price_child >= 0),
  cancellation text not null default 'flexible' check (cancellation in ('flexible', 'non_refundable')),
  -- Flexible plans: free cancellation until this many days before check-in.
  free_cancel_days smallint check (free_cancel_days between 0 and 60),
  -- Discount on the room price (not on meals or extras), e.g. 10 for non-refundable.
  discount_percent numeric(5,2) not null default 0 check (discount_percent >= 0 and discount_percent <= 90),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((cancellation = 'flexible') = (free_cancel_days is not null))
);

create index hotel_rate_plans_hotel_idx on public.hotel_rate_plans (hotel_id, sort_order);

alter table public.hotel_rate_plans enable row level security;

create policy "hotel_rate_plans: public reads"
  on public.hotel_rate_plans for select
  using (true);

create policy "hotel_rate_plans: admin manages"
  on public.hotel_rate_plans for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "hotel_rate_plans: partner manages own"
  on public.hotel_rate_plans for all to authenticated
  using (public.is_hotel_partner_member((select partner_id from public.hotels where id = hotel_id)))
  with check (public.is_hotel_partner_member((select partner_id from public.hotels where id = hotel_id)));

create policy "hotel_rate_plans: manager writes when permitted"
  on public.hotel_rate_plans for all to authenticated
  using (public.hotel_manager_has_permission(hotel_id, 'rooms'))
  with check (public.hotel_manager_has_permission(hotel_id, 'rooms'));

-- ----------------------------------------------------------------------------
-- 2. Extras
-- ----------------------------------------------------------------------------
create table public.hotel_extras (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  price numeric(10,2) not null check (price > 0 and price <= 100000),
  unit text not null default 'per_stay' check (unit in ('per_stay', 'per_night', 'per_guest', 'per_guest_night')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index hotel_extras_hotel_idx on public.hotel_extras (hotel_id, sort_order);

alter table public.hotel_extras enable row level security;

create policy "hotel_extras: public reads"
  on public.hotel_extras for select
  using (true);

create policy "hotel_extras: admin manages"
  on public.hotel_extras for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "hotel_extras: partner manages own"
  on public.hotel_extras for all to authenticated
  using (public.is_hotel_partner_member((select partner_id from public.hotels where id = hotel_id)))
  with check (public.is_hotel_partner_member((select partner_id from public.hotels where id = hotel_id)));

create policy "hotel_extras: manager writes when permitted"
  on public.hotel_extras for all to authenticated
  using (public.hotel_manager_has_permission(hotel_id, 'rooms'))
  with check (public.hotel_manager_has_permission(hotel_id, 'rooms'));

-- ----------------------------------------------------------------------------
-- 3. Booking snapshot columns
-- ----------------------------------------------------------------------------
alter table public.hotel_bookings
  add column rate_plan_id uuid references public.hotel_rate_plans (id) on delete set null,
  -- {id, name, board, cancellation, free_cancel_days, discount_percent, board_price_adult, board_price_child}
  add column rate_plan jsonb,
  -- [{id, name, unit, unit_price, quantity, total}]
  add column extras jsonb not null default '[]'::jsonb,
  -- [{adults, children}] one entry per room
  add column room_occupancy jsonb not null default '[]'::jsonb,
  -- {arrival_time, purpose, booked_for_other, lead_guest: {name, phone, email}, preferences: [{bed, smoking, cot, location}]}
  add column stay_details jsonb not null default '{}'::jsonb,
  -- quote_hotel_stay() result at booking time
  add column price_breakdown jsonb;

-- ----------------------------------------------------------------------------
-- 4. The price formula
-- ----------------------------------------------------------------------------
-- rooms_total  = nightly rates (override > rule > base) x rooms
-- discount     = rooms_total x plan discount_percent
-- board_total  = nights x (adults x adult supplement + children x child supplement)
-- extras_total = per_stay x 1, per_night x nights, per_guest x guests,
--                per_guest_night x guests x nights
-- total        = rooms_total - discount + board_total + extras_total
create or replace function public.quote_hotel_stay(
  p_room_id uuid,
  p_check_in date,
  p_check_out date,
  p_num_rooms integer,
  p_adults integer,
  p_children integer,
  p_rate_plan_id uuid default null,
  p_extra_ids uuid[] default '{}'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_room public.hotel_rooms;
  v_plan public.hotel_rate_plans;
  v_nights integer;
  v_nightly_count integer;
  v_room_stay numeric;
  v_rooms_total numeric;
  v_discount numeric := 0;
  v_board numeric := 0;
  v_guests integer;
  v_extras jsonb;
  v_extras_total numeric;
begin
  select * into v_room from public.hotel_rooms where id = p_room_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'This room is no longer available.';
  end if;

  v_nights := p_check_out - p_check_in;
  if v_nights < 1 or v_nights > 60 then
    raise exception using errcode = 'P0001', message = 'Stays are 1 to 60 nights.';
  end if;
  if coalesce(p_num_rooms, 0) < 1 or p_num_rooms > 20 then
    raise exception using errcode = 'P0001', message = 'Book between 1 and 20 rooms.';
  end if;
  if coalesce(p_adults, 0) < 1 or coalesce(p_children, -1) < 0 then
    raise exception using errcode = 'P0001', message = 'At least one adult is required.';
  end if;

  select count(*), coalesce(sum(r.rate), 0)
    into v_nightly_count, v_room_stay
    from public.hotel_nightly_rates(array[p_room_id], p_check_in, p_check_out) r;
  if v_nightly_count < v_nights or v_room_stay <= 0 then
    raise exception using errcode = 'P0001', message = 'This room has no price for these dates.';
  end if;

  v_rooms_total := round(v_room_stay * p_num_rooms, 2);

  if p_rate_plan_id is not null then
    select * into v_plan
      from public.hotel_rate_plans
     where id = p_rate_plan_id and hotel_id = v_room.hotel_id and is_active;
    if not found then
      raise exception using errcode = 'P0001', message = 'This rate is no longer available.';
    end if;
    v_discount := round(v_rooms_total * v_plan.discount_percent / 100, 2);
    v_board := round(v_nights * (p_adults * v_plan.board_price_adult + p_children * v_plan.board_price_child), 2);
  end if;

  v_guests := p_adults + p_children;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id,
           'name', e.name,
           'unit', e.unit,
           'unit_price', e.price,
           'quantity', q.qty,
           'total', round(e.price * q.qty, 2)
         ) order by e.sort_order, e.name), '[]'::jsonb),
         coalesce(sum(round(e.price * q.qty, 2)), 0)
    into v_extras, v_extras_total
    from public.hotel_extras e
   cross join lateral (
     select case e.unit
              when 'per_stay' then 1
              when 'per_night' then v_nights
              when 'per_guest' then v_guests
              else v_guests * v_nights
            end as qty
   ) q
   where e.id = any (coalesce(p_extra_ids, '{}'::uuid[]))
     and e.hotel_id = v_room.hotel_id
     and e.is_active;

  return jsonb_build_object(
    'currency', v_room.currency,
    'nights', v_nights,
    'rooms', p_num_rooms,
    'room_stay', v_room_stay,
    'rooms_total', v_rooms_total,
    'discount', v_discount,
    'board_total', v_board,
    'extras', v_extras,
    'extras_total', v_extras_total,
    'total', v_rooms_total - v_discount + v_board + v_extras_total,
    'rate_plan', case when v_plan.id is null then null else jsonb_build_object(
      'id', v_plan.id,
      'name', v_plan.name,
      'board', v_plan.board,
      'cancellation', v_plan.cancellation,
      'free_cancel_days', v_plan.free_cancel_days,
      'discount_percent', v_plan.discount_percent,
      'board_price_adult', v_plan.board_price_adult,
      'board_price_child', v_plan.board_price_child
    ) end
  );
end;
$$;

grant execute on function public.quote_hotel_stay(uuid, date, date, integer, integer, integer, uuid, uuid[]) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. The database prices non-staff bookings and locks them afterwards
-- ----------------------------------------------------------------------------
-- SECURITY INVOKER: current_user is 'authenticated' for an API call and the
-- function owner inside security-definer functions. Named "aa_" so it runs
-- before every other hotel_bookings trigger and sees only the caller's change.
create or replace function public.hotel_bookings_price_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_quote jsonb;
  v_extra_ids uuid[];
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.hotel_id in (select public.my_operable_hotel_ids()) then
      return new;
    end if;

    select coalesce(array_agg((x ->> 'id')::uuid), '{}'::uuid[])
      into v_extra_ids
      from jsonb_array_elements(case when jsonb_typeof(new.extras) = 'array' then new.extras else '[]'::jsonb end) x
     where jsonb_typeof(x) = 'object' and x ? 'id';

    v_quote := public.quote_hotel_stay(
      new.room_id, new.check_in, new.check_out,
      new.num_rooms, new.num_adults, new.num_children,
      new.rate_plan_id, v_extra_ids
    );
    new.total_price := (v_quote ->> 'total')::numeric;
    new.currency := v_quote ->> 'currency';
    new.price_breakdown := v_quote;
    new.rate_plan := v_quote -> 'rate_plan';
    new.extras := v_quote -> 'extras';
    return new;
  end if;

  if old.hotel_id not in (select public.my_operable_hotel_ids())
     and (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception using errcode = '42501', message = 'Only the hotel can change this booking.';
  end if;
  return new;
end;
$$;

drop trigger if exists aa_hotel_bookings_price_guard on public.hotel_bookings;
create trigger aa_hotel_bookings_price_guard
  before insert or update on public.hotel_bookings
  for each row execute function public.hotel_bookings_price_guard();

-- An order line for a hotel booking carries the booking's price, and the
-- order it belongs to must charge exactly that (plus an agency's own markup).
create or replace function public.order_items_bind_hotel_price()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_booking public.hotel_bookings;
  v_order public.orders;
begin
  if new.hotel_booking_id is null
     or current_user not in ('authenticated', 'anon')
     or public.is_admin() then
    return new;
  end if;

  select * into v_booking from public.hotel_bookings where id = new.hotel_booking_id;
  if not found then
    raise exception using errcode = '42501', message = 'Booking not found.';
  end if;
  if v_booking.hotel_id in (select public.my_operable_hotel_ids()) then
    return new;
  end if;

  select * into v_order from public.orders where id = new.order_id;
  if not found
     or v_order.subtotal <> v_booking.total_price
     or v_order.fee_total <> 0
     or v_order.markup_amount < 0
     or abs(v_order.total - (v_order.subtotal + v_order.markup_amount)) > 0.01 then
    raise exception using errcode = '42501', message = 'The order total does not match the booking price.';
  end if;

  new.quantity := 1;
  new.unit_price := v_booking.total_price;
  new.total_price := v_booking.total_price;
  return new;
end;
$$;

drop trigger if exists order_items_bind_hotel_price on public.order_items;
create trigger order_items_bind_hotel_price
  before insert on public.order_items
  for each row execute function public.order_items_bind_hotel_price();

-- ----------------------------------------------------------------------------
-- 6. Price calendar
-- ----------------------------------------------------------------------------
-- Public: for each night, the cheapest nightly rate among the hotel's priced,
-- published room types that still have a room that night, and whether any
-- room is left at all. Up to 60 nights per call.
create or replace function public.hotel_price_calendar(p_hotel_id uuid, p_from date, p_to date)
returns table (night date, min_rate numeric, available boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_ids uuid[];
begin
  if p_to <= p_from or p_to - p_from > 60 then
    raise exception 'range must be 1 to 60 nights';
  end if;

  select array_agg(r.id) into v_ids
    from public.hotel_rooms r
    join public.hotels h on h.id = r.hotel_id
   where r.hotel_id = p_hotel_id
     and r.status = 'published'
     and h.status = 'published'
     and r.base_price > 0;
  if v_ids is null then
    return;
  end if;

  return query
  with rates as (
    select nr.room_id, nr.night, nr.rate
      from public.hotel_nightly_rates(v_ids[1:50], p_from, p_to) nr
  ),
  caps as (
    select rid as room_id, rn.night, rn.capacity, rn.booked
      from unnest(v_ids[1:50]) rid
     cross join lateral public.hotel_room_nights(rid, p_from, p_to) rn
  )
  select ra.night,
         min(ra.rate) filter (where ca.capacity is null or ca.capacity - ca.booked > 0),
         coalesce(bool_or(ca.capacity is null or ca.capacity - ca.booked > 0), false)
    from rates ra
    join caps ca on ca.room_id = ra.room_id and ca.night = ra.night
   group by ra.night
   order by ra.night;
end;
$$;

grant execute on function public.hotel_price_calendar(uuid, date, date) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. Refund quotes follow the booking's cancellation policy
-- ----------------------------------------------------------------------------
-- Non-refundable rate: nothing back. Flexible rate inside its free window:
-- everything back. Past the window, the hotel's refund rules apply, or the
-- whole amount is kept when the hotel has none. Bookings made without a rate
-- plan keep the hotel's refund rules exactly as before.
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
  v_has_rules boolean;
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
  v_has_rules := exists (select 1 from public.hotel_refund_rules r where r.hotel_id = hb.hotel_id);

  if hb.rate_plan ->> 'cancellation' = 'non_refundable' then
    v_pct := 100;
  elsif hb.rate_plan ->> 'cancellation' = 'flexible'
        and hb.check_in - p_as_of >= coalesce((hb.rate_plan ->> 'free_cancel_days')::integer, 0) then
    v_pct := 0;
  elsif v_has_rules then
    select r.deduction_percent into v_pct
      from public.hotel_refund_rules r
     where r.hotel_id = hb.hotel_id and r.days_before <= v_days
     order by r.days_before desc
     limit 1;
    v_pct := coalesce(v_pct, 100);
  elsif hb.rate_plan is not null then
    v_pct := 100;
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
