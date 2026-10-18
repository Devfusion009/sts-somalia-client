-- Phase 3: rate rules and room blocks.
--
-- Rate rules: seasonal / weekday price adjustments per hotel or room type.
-- A night's price is, in order: the per-date override the hotel typed in, else
-- the best matching rate rule, else the room's base price.
--
-- Room blocks: a room unit marked out of order / inactive, or blocked for a
-- date range (hotel_room_disable_dates), now removes one sellable room from
-- capacity for those nights. Until now both were front-desk decoration only
-- and a blocked room could still be sold online.

-- ----------------------------------------------------------------------------
-- Rate rules
-- ----------------------------------------------------------------------------
create table public.hotel_rate_rules (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  -- null = applies to every room type of the hotel
  room_id uuid references public.hotel_rooms (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  date_start date not null,
  date_end date not null,
  -- 0 = Sunday ... 6 = Saturday; null = every day
  weekdays smallint[] check (weekdays is null or (cardinality(weekdays) > 0 and weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])),
  adjustment text not null check (adjustment in ('percent', 'fixed')),
  -- percent: signed change on the base price. fixed: the nightly price itself.
  value numeric(10,2) not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (date_end >= date_start),
  check (adjustment <> 'percent' or (value > -100 and value <= 1000)),
  check (adjustment <> 'fixed' or value > 0)
);

create index hotel_rate_rules_hotel_idx on public.hotel_rate_rules (hotel_id, date_start, date_end);
create index hotel_rate_rules_room_idx on public.hotel_rate_rules (room_id) where room_id is not null;

alter table public.hotel_rate_rules enable row level security;

create policy "hotel_rate_rules: public reads"
  on public.hotel_rate_rules for select
  using (true);

create policy "hotel_rate_rules: admin manages"
  on public.hotel_rate_rules for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "hotel_rate_rules: partner manages own"
  on public.hotel_rate_rules for all to authenticated
  using (public.is_hotel_partner_member((select partner_id from public.hotels where id = hotel_id)))
  with check (public.is_hotel_partner_member((select partner_id from public.hotels where id = hotel_id)));

create policy "hotel_rate_rules: manager writes when permitted"
  on public.hotel_rate_rules for all to authenticated
  using (public.hotel_manager_has_permission(hotel_id, 'rooms'))
  with check (public.hotel_manager_has_permission(hotel_id, 'rooms'));

-- A room-specific rule must belong to the same hotel as the rule.
create or replace function public.hotel_rate_rules_check_room()
returns trigger
language plpgsql
as $$
begin
  if new.room_id is not null
     and not exists (select 1 from public.hotel_rooms r where r.id = new.room_id and r.hotel_id = new.hotel_id) then
    raise exception 'Room type does not belong to this hotel.';
  end if;
  return new;
end;
$$;

create trigger hotel_rate_rules_check_room
  before insert or update on public.hotel_rate_rules
  for each row execute function public.hotel_rate_rules_check_room();

-- ----------------------------------------------------------------------------
-- Effective nightly rate
-- ----------------------------------------------------------------------------
-- Public (prices are public): one row per room per night. source says where the
-- figure came from: 'override' (typed per date), 'rule' (rate rule) or 'base'.
-- When several rules match a night, a room-specific rule beats a hotel-wide
-- one, then the most recently created rule wins. Rules never stack.
create or replace function public.hotel_nightly_rates(p_room_ids uuid[], p_from date, p_to date)
returns table (room_id uuid, night date, rate numeric, source text, rule_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_to <= p_from or p_to - p_from > 60 then
    raise exception 'stay must be 1 to 60 nights';
  end if;
  if coalesce(array_length(p_room_ids, 1), 0) > 50 then
    raise exception 'too many rooms';
  end if;

  return query
  select r.id,
         n.night,
         case
           when inv.price_override is not null then inv.price_override
           when rr.id is not null and rr.adjustment = 'fixed' then rr.value
           when rr.id is not null then round(r.base_price * (1 + rr.value / 100), 2)
           else r.base_price
         end,
         case
           when inv.price_override is not null then 'override'
           when rr.id is not null then 'rule'
           else 'base'
         end,
         rr.name
    from unnest(p_room_ids) rid
    join public.hotel_rooms r on r.id = rid
   cross join lateral (
     select g::date as night
       from generate_series(p_from::timestamp, (p_to - 1)::timestamp, interval '1 day') g
   ) n
    left join public.hotel_room_inventory inv
      on inv.room_id = r.id and inv.date = n.night
    left join lateral (
      select ru.id, ru.name, ru.adjustment, ru.value
        from public.hotel_rate_rules ru
       where ru.hotel_id = r.hotel_id
         and (ru.room_id is null or ru.room_id = r.id)
         and n.night between ru.date_start and ru.date_end
         and (ru.weekdays is null or extract(dow from n.night)::smallint = any (ru.weekdays))
       order by (ru.room_id is not null) desc, ru.created_at desc
       limit 1
    ) rr on true
   where r.status = 'published'
      or public.is_admin()
      or r.hotel_id in (select public.my_operable_hotel_ids())
   order by r.id, n.night;
end;
$$;

grant execute on function public.hotel_nightly_rates(uuid[], date, date) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Capacity net of blocked rooms
-- ----------------------------------------------------------------------------
-- Same function as 20260903000001 with one change: capacity loses one room for
-- every unit of this room type that is not active, or is blocked on that night
-- (date_start <= night < date_end, the same end-exclusive reading the front
-- desk day stats use).
create or replace function public.hotel_room_nights(
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
         case
           when coalesce(inv.total_units, r.total_units) is null then null
           else greatest(
             coalesce(inv.total_units, r.total_units) - (
               select count(*)
                 from public.hotel_room_units u
                where u.room_type_id = p_room_id
                  and (
                    u.status <> 'active'
                    or exists (
                      select 1
                        from public.hotel_room_disable_dates d
                       where d.room_unit_id = u.id
                         and d.date_start <= n.night
                         and d.date_end > n.night
                    )
                  )
             ),
             0
           )::integer
         end as capacity,
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
