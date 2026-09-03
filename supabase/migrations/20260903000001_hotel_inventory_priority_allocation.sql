-- ============================================================================
-- Hotel room inventory: tracked capacity + priority allocation.
--
-- Before this, availability only existed for nights a partner had explicitly
-- capped (hotel_room_inventory rows); every other night was unlimited, and
-- the manual-booking catalog (50 STS-direct Somali hotels) had zero rows —
-- nothing was tracked. The reserve trigger also decided contention purely by
-- lock-acquisition order, so an agency booking and a walk-in customer were
-- treated identically.
--
-- New model:
--  1) hotel_rooms.total_units — how many physical rooms of this type exist.
--     Capacity for any night = the per-date override (hotel_room_inventory,
--     now capacity/price only) else this baseline. NULL = not yet tracked.
--  2) Holdings are derived from hotel_bookings by status, never counted in a
--     separate column — booked_units is dropped, so the ledger cannot drift.
--  3) One allocator, serialized per room with a transaction-scoped advisory
--     lock (the "queue": every room has its own, so unrelated hotels never
--     wait on each other). Agency (B2B) requests carry priority 0, customers
--     (B2C) priority 1. When a higher-priority request can't be seated, the
--     allocator displaces the most recently placed, still-unconfirmed,
--     unpaid lower-priority requests on the contested nights — only if that
--     fully seats the new request, never partially — and waitlists them with
--     a notification. Result is order-independent: 15 customers + 6 agencies
--     for 20 rooms ends with 6 agency + 14 customer reservations and one
--     customer waitlisted, whichever arrived first.
--  4) Read models for every console: hotel_availability (admin / partner /
--     manager board, gated) and room_units_left (public "N left").
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Schema
-- ----------------------------------------------------------------------------
alter table public.hotel_rooms
  add column total_units integer check (total_units >= 0);

alter table public.hotel_room_inventory
  drop column booked_units;

alter table public.hotel_bookings
  add column channel text not null default 'b2c' check (channel in ('b2b', 'b2c')),
  add column priority smallint not null default 1,
  add column allocated_at timestamptz,
  -- deferrable: the allocator runs inside the BEFORE INSERT of the booking
  -- that does the displacing, so the referenced row does not exist yet at
  -- statement end — it does at commit.
  add column displaced_by uuid references public.hotel_bookings (id) deferrable initially deferred,
  add column displaced_at timestamptz;

update public.hotel_bookings set channel = 'b2b', priority = 0 where agency_id is not null;
update public.hotel_bookings set allocated_at = created_at
 where status in ('pending', 'confirmed', 'completed', 'no_show');

create index hotel_bookings_room_stay_idx
  on public.hotel_bookings (room_id, check_in, check_out)
  where status in ('pending', 'confirmed', 'completed', 'no_show');

create index hotel_bookings_displaced_by_idx
  on public.hotel_bookings (displaced_by) where displaced_by is not null;

-- ----------------------------------------------------------------------------
-- 2) Retire the counter-based triggers
-- ----------------------------------------------------------------------------
drop trigger hotel_bookings_reserve_inventory on public.hotel_bookings;
drop trigger hotel_bookings_release_inventory on public.hotel_bookings;
drop trigger hotel_bookings_reserve_on_waitlist_promotion on public.hotel_bookings;
drop function public.reserve_room_inventory();
drop function public.release_room_inventory();
drop function public.reserve_inventory_on_waitlist_promotion();
drop function public.room_available_units(uuid, date, date);

-- ----------------------------------------------------------------------------
-- 3) Ledger
-- ----------------------------------------------------------------------------
create function public.hotel_booking_holds_units(p_status public.booking_status)
returns boolean
language sql
immutable
as $$
  select p_status in ('pending', 'confirmed', 'completed', 'no_show');
$$;

-- One row per night of a stay for one room: capacity (override else baseline,
-- null when untracked) and what is held against it, split by channel and by
-- status. Internal — the allocator and the gated read models call it; not
-- exposed to clients.
create function public.hotel_room_nights(
  p_room_id uuid,
  p_from date,
  p_to date,
  p_exclude_booking uuid default null
)
returns table (
  night date,
  capacity integer,
  booked integer,
  b2b integer,
  b2c integer,
  confirmed integer,
  pending integer,
  price_override numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with nights as (
    select generate_series(p_from::timestamp, (p_to - 1)::timestamp, interval '1 day')::date as night
  )
  select n.night,
         coalesce(inv.total_units, r.total_units) as capacity,
         coalesce(sum(b.num_rooms), 0)::integer as booked,
         coalesce(sum(b.num_rooms) filter (where b.channel = 'b2b'), 0)::integer as b2b,
         coalesce(sum(b.num_rooms) filter (where b.channel = 'b2c'), 0)::integer as b2c,
         coalesce(sum(b.num_rooms) filter (where b.status = 'confirmed'), 0)::integer as confirmed,
         coalesce(sum(b.num_rooms) filter (where b.status = 'pending'), 0)::integer as pending,
         inv.price_override
  from public.hotel_rooms r
  cross join nights n
  left join public.hotel_room_inventory inv
    on inv.room_id = r.id and inv.date = n.night
  left join public.hotel_bookings b
    on b.room_id = r.id
   and public.hotel_booking_holds_units(b.status)
   and b.check_in <= n.night
   and b.check_out > n.night
   and (p_exclude_booking is null or b.id <> p_exclude_booking)
  where r.id = p_room_id
  group by n.night, inv.total_units, r.total_units, inv.price_override
  order by n.night;
$$;

revoke execute on function public.hotel_room_nights(uuid, date, date, uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4) Allocator
-- ----------------------------------------------------------------------------
create function public._allocate_hotel_booking(b public.hotel_bookings)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  short_nights date[];
  deficits integer[];
  cand record;
  plan_ids uuid[] := '{}';
  i integer;
  v_hotel_name text;
begin
  if b.num_rooms is null or b.num_rooms <= 0 then
    raise exception 'num_rooms must be positive';
  end if;

  -- The per-room queue: every allocation for this room runs one at a time,
  -- in lock-acquisition order, and sees every earlier one committed.
  perform pg_advisory_xact_lock(hashtextextended('hotel_room:' || b.room_id::text, 0));

  select array_agg(n.night order by n.night),
         array_agg(b.num_rooms - (n.capacity - n.booked) order by n.night)
    into short_nights, deficits
  from public.hotel_room_nights(b.room_id, b.check_in, b.check_out, b.id) n
  where n.capacity is not null
    and n.capacity - n.booked < b.num_rooms;

  if short_nights is null then
    return 'reserved';
  end if;

  -- Displacement plan: lower-priority, still-pending, unpaid requests that
  -- overlap the stay, newest first. A candidate joins the plan only if it
  -- frees at least one night still in deficit; the loop stops the moment
  -- every deficit is covered.
  for cand in
    select c.id, c.check_in, c.check_out, c.num_rooms
      from public.hotel_bookings c
     where c.room_id = b.room_id
       and c.id <> b.id
       and c.status = 'pending'
       and c.priority > b.priority
       and c.check_in < b.check_out
       and c.check_out > b.check_in
       and not exists (
         select 1
           from public.order_items oi
           join public.orders o on o.id = oi.order_id
          where oi.hotel_booking_id = c.id
            and o.status in ('paid', 'partially_paid', 'processing', 'completed')
       )
     order by c.priority desc, c.created_at desc
  loop
    if exists (
      select 1 from generate_subscripts(deficits, 1) g
       where deficits[g] > 0
         and short_nights[g] >= cand.check_in
         and short_nights[g] < cand.check_out
    ) then
      plan_ids := plan_ids || cand.id;
      for i in 1 .. array_length(deficits, 1) loop
        if short_nights[i] >= cand.check_in and short_nights[i] < cand.check_out then
          deficits[i] := deficits[i] - cand.num_rooms;
        end if;
      end loop;
      exit when not exists (select 1 from unnest(deficits) d where d > 0);
    end if;
  end loop;

  if exists (select 1 from unnest(deficits) d where d > 0) then
    return 'waitlisted';
  end if;

  update public.hotel_bookings
     set status = 'waitlisted',
         displaced_by = b.id,
         displaced_at = now(),
         allocated_at = null
   where id = any (plan_ids);

  select h.name into v_hotel_name from public.hotels h where h.id = b.hotel_id;

  insert into public.notifications (profile_id, type, title, body, data)
  select distinct on (d.id, p.profile_id)
         p.profile_id,
         'booking_waitlisted',
         'Dates no longer available — ' || v_hotel_name,
         'Your request for ' || v_hotel_name || ' (' || d.check_in || ' to ' || d.check_out
           || ') is waitlisted. STS will confirm as soon as a room frees up.',
         jsonb_build_object(
           'hotel_booking_id', d.id,
           'order_id', (select oi.order_id from public.order_items oi where oi.hotel_booking_id = d.id limit 1)
         )
    from public.hotel_bookings d
   cross join lateral (values (d.customer_id), (d.booked_by)) as p(profile_id)
   where d.id = any (plan_ids);

  return 'reserved';
end;
$$;

revoke execute on function public._allocate_hotel_booking(public.hotel_bookings) from public, anon, authenticated;

create function public.hotel_bookings_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.channel := case when new.agency_id is not null then 'b2b' else 'b2c' end;
  new.priority := case when new.channel = 'b2b' then 0 else 1 end;
  new.displaced_by := null;
  new.displaced_at := null;

  if public.hotel_booking_holds_units(new.status) then
    if public._allocate_hotel_booking(new) = 'reserved' then
      new.allocated_at := now();
    else
      new.status := 'waitlisted';
      new.allocated_at := null;
    end if;
  else
    new.allocated_at := null;
  end if;
  return new;
end;
$$;

create trigger hotel_bookings_allocate
  before insert on public.hotel_bookings
  for each row execute function public.hotel_bookings_before_insert();

-- Promotion out of a non-holding status (waitlisted, cancelled, failed,
-- refunded) into a holding one re-runs the allocator; an explicit promotion
-- that still cannot be seated fails loudly rather than double-booking.
create function public.hotel_bookings_before_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.hotel_booking_holds_units(old.status)
     and public.hotel_booking_holds_units(new.status) then
    if public._allocate_hotel_booking(new) = 'reserved' then
      new.allocated_at := now();
      new.displaced_by := null;
      new.displaced_at := null;
    else
      raise exception 'still not enough rooms available for % to %', new.check_in, new.check_out;
    end if;
  end if;
  return new;
end;
$$;

create trigger hotel_bookings_allocate_on_status_change
  before update of status on public.hotel_bookings
  for each row execute function public.hotel_bookings_before_status_change();

-- ----------------------------------------------------------------------------
-- 5) Read models
-- ----------------------------------------------------------------------------

-- Public: units left per room for a stay. Rooms with no tracked night in the
-- range are omitted (untracked ≠ sold out).
create function public.room_units_left(p_room_ids uuid[], p_check_in date, p_check_out date)
returns table (room_id uuid, units_left integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_check_out <= p_check_in or p_check_out - p_check_in > 60 then
    raise exception 'stay must be 1 to 60 nights';
  end if;
  if coalesce(array_length(p_room_ids, 1), 0) > 50 then
    raise exception 'too many rooms';
  end if;

  return query
  select rid, min(n.capacity - n.booked)::integer
    from unnest(p_room_ids) rid
   cross join lateral public.hotel_room_nights(rid, p_check_in, p_check_out) n
   where n.capacity is not null
   group by rid;
end;
$$;

grant execute on function public.room_units_left(uuid[], date, date) to anon, authenticated;

-- Consoles: the availability board for one hotel (every room × night), or one
-- room when p_room_id is given. Admin, the owning partner's members and the
-- hotel's managers.
create function public.hotel_availability(
  p_hotel_id uuid,
  p_from date,
  p_days integer default 14,
  p_room_id uuid default null
)
returns table (
  room_id uuid,
  room_name text,
  room_status public.listing_status,
  room_total_units integer,
  night date,
  capacity integer,
  booked integer,
  b2b integer,
  b2c integer,
  confirmed integer,
  pending integer,
  available integer,
  price_override numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or p_hotel_id in (select public.my_operable_hotel_ids())) then
    raise exception 'not authorised';
  end if;
  if p_days < 1 or p_days > 120 then
    raise exception 'p_days must be between 1 and 120';
  end if;

  return query
  select r.id, r.name, r.status, r.total_units,
         n.night, n.capacity, n.booked, n.b2b, n.b2c, n.confirmed, n.pending,
         case when n.capacity is null then null else n.capacity - n.booked end,
         n.price_override
    from public.hotel_rooms r
   cross join lateral public.hotel_room_nights(r.id, p_from, p_from + p_days) n
   where r.hotel_id = p_hotel_id
     and (p_room_id is null or r.id = p_room_id)
   order by r.created_at, r.name, n.night;
end;
$$;

grant execute on function public.hotel_availability(uuid, date, integer, uuid) to authenticated;
