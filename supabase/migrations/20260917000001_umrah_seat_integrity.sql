-- Group Umrah seat inventory moves into the database.
--
-- Until now createUmrahBooking read booked_seats, compared it in TypeScript,
-- inserted the booking, and then wrote `booked_seats = <value it read> + n`
-- through the service-role client. Two customers booking the last seats at the
-- same moment both passed the check and both "incremented" from the same
-- stale value — the departure oversold and the counter under-counted. Nothing
-- ever gave seats back either: cancelling (including the hold-expiry cascade
-- in _apply_order_cancellation) only flipped umrah_bookings.status.
--
-- booked_seats is now owned by triggers on umrah_bookings, serialised by a row
-- lock on the departure. Seats sold outside the system get their own column so
-- the trigger-owned counter never has to absorb numbers no booking explains.

-- ----------------------------------------------------------------------------
-- 1) Seats sold outside the system (phone, walk-in, partner allotment).
--    Admin-set and counted in every capacity check. Same offline-sync
--    principle as hotel_bookings.source: inventory the platform did not sell
--    still has to block the platform from selling it again.
-- ----------------------------------------------------------------------------
alter table public.umrah_package_departures
  add column offline_seats integer not null default 0 check (offline_seats >= 0);

-- ----------------------------------------------------------------------------
-- 2) Which bookings hold a seat. 'waitlisted' has not been given one yet;
--    'no_show' and 'completed' used theirs, so the seat is not resold.
-- ----------------------------------------------------------------------------
create or replace function public.umrah_booking_holds_seats(p_kind text, p_status public.booking_status)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_kind = 'group' and p_status in ('pending', 'confirmed', 'no_show', 'completed');
$$;

-- ----------------------------------------------------------------------------
-- 3) Backfill. Existing booked_seats counts include seats with no booking row
--    behind them — possibly real offline sales — so the difference moves to
--    offline_seats instead of being discarded. Before/after is printed per
--    departure so the split is visible in the migration log.
-- ----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select d.id,
           d.booked_seats as before_booked,
           d.offline_seats as before_offline,
           coalesce((
             select sum(b.num_pilgrims)
               from public.umrah_bookings b
              where b.departure_id = d.id
                and public.umrah_booking_holds_seats(b.booking_kind, b.status)
           ), 0)::int as live
      from public.umrah_package_departures d
  loop
    if r.before_booked <> r.live then
      raise notice 'departure %: booked_seats % -> %, offline_seats % -> %',
        r.id, r.before_booked, r.live,
        r.before_offline, greatest(r.before_booked - r.live, 0);
      update public.umrah_package_departures
         set offline_seats = greatest(r.before_booked - r.live, 0),
             booked_seats = r.live
       where id = r.id;
    end if;
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) Hard ceiling, also covering admin edits to total_seats / offline_seats.
--    Added NOT VALID first so an oversold departure is reported rather than
--    failing the migration; validated only when clean.
-- ----------------------------------------------------------------------------
do $$
declare
  r record;
  v_violations int := 0;
begin
  for r in
    select id, total_seats, booked_seats, offline_seats
      from public.umrah_package_departures
     where booked_seats + offline_seats > total_seats
  loop
    v_violations := v_violations + 1;
    raise notice 'oversold departure %: booked % + offline % of %',
      r.id, r.booked_seats, r.offline_seats, r.total_seats;
  end loop;

  alter table public.umrah_package_departures
    add constraint umrah_package_departures_seats_within_total
    check (booked_seats + offline_seats <= total_seats) not valid;

  if v_violations = 0 then
    alter table public.umrah_package_departures
      validate constraint umrah_package_departures_seats_within_total;
  else
    raise notice '% oversold departure(s) — constraint left NOT VALID', v_violations;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) Reserve / release
-- ----------------------------------------------------------------------------
create or replace function public._umrah_reserve_seats(p_departure_id uuid, p_seats int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  dep public.umrah_package_departures;
begin
  -- The row lock is what serialises concurrent bookings for the same departure.
  select * into dep from public.umrah_package_departures where id = p_departure_id for update;
  if not found then
    raise exception 'departure not found';
  end if;

  if dep.booked_seats + dep.offline_seats + p_seats > dep.total_seats then
    raise exception 'not enough seats left on this departure';
  end if;

  update public.umrah_package_departures
     set booked_seats = booked_seats + p_seats
   where id = p_departure_id;
end;
$$;

create or replace function public._umrah_release_seats(p_departure_id uuid, p_seats int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only booked_seats: offline seats are not tied to any booking row. Floored
  -- at zero so a release can never fail a cancellation.
  update public.umrah_package_departures
     set booked_seats = greatest(booked_seats - p_seats, 0)
   where id = p_departure_id;
end;
$$;

revoke execute on function public._umrah_reserve_seats(uuid, int) from public, anon, authenticated;
revoke execute on function public._umrah_release_seats(uuid, int) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6) Triggers. SECURITY DEFINER because customers have no UPDATE right on
--    departures — the reason the old code reached for the service-role client.
-- ----------------------------------------------------------------------------
create or replace function public.umrah_bookings_reserve_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.umrah_booking_holds_seats(new.booking_kind, new.status) then
    perform public._umrah_reserve_seats(new.departure_id, new.num_pilgrims);
  end if;
  return new;
end;
$$;

create or replace function public.umrah_bookings_sync_seats_on_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_holds boolean;
  v_new_holds boolean;
begin
  if tg_op = 'DELETE' then
    if public.umrah_booking_holds_seats(old.booking_kind, old.status) then
      perform public._umrah_release_seats(old.departure_id, old.num_pilgrims);
    end if;
    return old;
  end if;

  v_old_holds := public.umrah_booking_holds_seats(old.booking_kind, old.status);
  v_new_holds := public.umrah_booking_holds_seats(new.booking_kind, new.status);

  if v_old_holds and v_new_holds
     and old.departure_id = new.departure_id
     and old.num_pilgrims = new.num_pilgrims then
    return new;
  end if;

  -- Release before reserving so resizing a booking on the same departure is
  -- checked against the seats it already held.
  if v_old_holds then
    perform public._umrah_release_seats(old.departure_id, old.num_pilgrims);
  end if;
  if v_new_holds then
    perform public._umrah_reserve_seats(new.departure_id, new.num_pilgrims);
  end if;

  return new;
end;
$$;

revoke execute on function public.umrah_bookings_reserve_on_insert() from public, anon, authenticated;
revoke execute on function public.umrah_bookings_sync_seats_on_change() from public, anon, authenticated;

create trigger umrah_bookings_reserve_seats
  before insert on public.umrah_bookings
  for each row execute function public.umrah_bookings_reserve_on_insert();

create trigger umrah_bookings_sync_seats
  after update of status, num_pilgrims, departure_id on public.umrah_bookings
  for each row execute function public.umrah_bookings_sync_seats_on_change();

create trigger umrah_bookings_release_seats_on_delete
  after delete on public.umrah_bookings
  for each row execute function public.umrah_bookings_sync_seats_on_change();
