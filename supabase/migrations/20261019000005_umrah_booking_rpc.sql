-- Group Umrah bookings are created in one transaction, priced in SQL and
-- refused once sales for a departure have closed.
--
-- createUmrahBooking used to insert the booking (seats reserved by trigger),
-- then the pilgrims, then the order, as separate requests. A failure after
-- the first left a seat-holding booking with no order. Nothing checked on the
-- server that the departure had not already left.
--
-- 1. umrah_package_departures.sales_close_days: bookings close when
--    departure_date - sales_close_days <= today. Default 0 (closes on the
--    departure day). status: 'open' | 'closed' | 'cancelled'.
-- 2. create_umrah_group_booking: booking + pilgrims in one call, price from
--    the rate card for the chosen sharing, else price_override, else the
--    package base price (unchanged rule). Returns the booking id; the order
--    is still created by createOrderForBooking, because markup and affiliate
--    attribution live there.
-- 3. A booker may delete their own pending booking that has no order yet,
--    so the app can undo step 2 when order creation fails. The delete
--    trigger releases the seats.
-- 4. One live booking per private request: a double-submitted step 4 can no
--    longer create two bookings.

alter table public.umrah_package_departures
  add column if not exists sales_close_days smallint not null default 0
    check (sales_close_days between 0 and 120);

alter table public.umrah_package_departures
  add column if not exists status text not null default 'open'
    check (status in ('open', 'closed', 'cancelled'));

create or replace function public.create_umrah_group_booking(
  p_departure_id uuid,
  p_num_pilgrims integer,
  p_room_sharing smallint,
  p_special_requests text,
  p_pilgrims jsonb,
  p_agency_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  dep public.umrah_package_departures;
  pkg public.umrah_packages;
  v_has_rates boolean;
  v_rate numeric;
  v_unit numeric;
  v_sharing smallint;
  v_booking_id uuid;
begin
  if v_uid is null then
    raise exception 'not authorized';
  end if;
  if p_agency_id is not null and not (p_agency_id = any (public.my_agency_ids())) then
    raise exception 'not authorized';
  end if;
  if p_num_pilgrims is null or p_num_pilgrims < 1 then
    raise exception 'at least one pilgrim is required';
  end if;
  if jsonb_typeof(p_pilgrims) <> 'array' or jsonb_array_length(p_pilgrims) <> p_num_pilgrims then
    raise exception 'pilgrim details do not match the number of pilgrims';
  end if;

  select * into dep from public.umrah_package_departures where id = p_departure_id;
  if not found then
    raise exception 'departure not found';
  end if;
  select * into pkg from public.umrah_packages where id = dep.package_id;
  if not found or pkg.status <> 'published' then
    raise exception 'departure not found';
  end if;
  if dep.status <> 'open' or dep.departure_date - dep.sales_close_days <= current_date then
    raise exception 'bookings for this departure are closed';
  end if;

  select exists (select 1 from public.umrah_package_pricing where package_id = pkg.id) into v_has_rates;
  if v_has_rates then
    select price into v_rate
      from public.umrah_package_pricing
     where package_id = pkg.id and sharing = p_room_sharing;
    if v_rate is null then
      raise exception 'select a room sharing option';
    end if;
    v_unit := v_rate;
    v_sharing := p_room_sharing;
  else
    v_unit := coalesce(dep.price_override, pkg.base_price);
    v_sharing := null;
  end if;

  -- The insert trigger reserves the seats under a row lock and raises
  -- 'not enough seats left on this departure'.
  insert into public.umrah_bookings (
    package_id, departure_id, customer_id, booked_by, agency_id,
    num_pilgrims, total_price, currency, room_sharing, special_requests
  ) values (
    pkg.id, dep.id, v_uid, v_uid, p_agency_id,
    p_num_pilgrims, v_unit * p_num_pilgrims, pkg.currency, v_sharing,
    nullif(btrim(coalesce(p_special_requests, '')), '')
  )
  returning id into v_booking_id;

  insert into public.umrah_pilgrims (
    booking_id, full_name, gender, date_of_birth, nationality,
    passport_number, passport_expiry, mahram_name, mahram_relation
  )
  select v_booking_id,
         btrim(p.full_name),
         p.gender::public.pilgrim_gender,
         p.date_of_birth,
         nullif(btrim(p.nationality), ''),
         nullif(btrim(p.passport_number), ''),
         p.passport_expiry,
         nullif(btrim(p.mahram_name), ''),
         nullif(btrim(p.mahram_relation), '')
    from jsonb_to_recordset(p_pilgrims) as p(
      full_name text, gender text, date_of_birth date, nationality text,
      passport_number text, passport_expiry date, mahram_name text, mahram_relation text
    );

  if exists (select 1 from public.umrah_pilgrims where booking_id = v_booking_id and length(full_name) < 2) then
    raise exception 'enter each pilgrim''s full name';
  end if;

  return v_booking_id;
end;
$$;

revoke execute on function public.create_umrah_group_booking(uuid, integer, smallint, text, jsonb, uuid) from public, anon;
grant execute on function public.create_umrah_group_booking(uuid, integer, smallint, text, jsonb, uuid) to authenticated;

drop policy if exists "umrah_bookings: booker deletes orphan" on public.umrah_bookings;
create policy "umrah_bookings: booker deletes orphan"
  on public.umrah_bookings for delete to authenticated
  using (
    booked_by = (select auth.uid())
    and status = 'pending'
    and not exists (select 1 from public.order_items oi where oi.umrah_booking_id = umrah_bookings.id)
  );

-- Only created when no duplicates exist yet, so the migration never fails on
-- data a double-submit already wrote; the duplicates are reported instead.
do $$
declare
  v_dupes int;
begin
  select count(*) into v_dupes from (
    select custom_request_id
      from public.umrah_bookings
     where booking_kind = 'private' and status not in ('cancelled', 'refunded', 'failed')
     group by custom_request_id
    having count(*) > 1
  ) d;

  if v_dupes = 0 then
    create unique index if not exists umrah_bookings_one_live_per_request
      on public.umrah_bookings (custom_request_id)
      where booking_kind = 'private' and status not in ('cancelled', 'refunded', 'failed');
  else
    raise notice '% private request(s) have more than one live booking — unique index not created', v_dupes;
  end if;
end;
$$;
