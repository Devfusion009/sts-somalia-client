-- Departure manifest and rooming list.
--
-- With 40 pilgrims on one departure, staff could not see who is missing a
-- passport, who still owes money, or who shares which room. The manifest and
-- the departures overview are aggregated in SQL (PostgREST returns at most
-- 1000 rows a request), admin only.

-- ----------------------------------------------------------------------------
-- 1. Rooms
-- ----------------------------------------------------------------------------
create table if not exists public.umrah_room_assignments (
  id uuid primary key default gen_random_uuid(),
  departure_id uuid not null references public.umrah_package_departures (id) on delete cascade,
  city text not null check (city in ('makkah', 'madinah')),
  room_label text not null check (length(btrim(room_label)) between 1 and 40),
  capacity smallint not null check (capacity between 1 and 12),
  gender text check (gender in ('male', 'female', 'family')),
  created_at timestamptz not null default now(),
  unique (departure_id, city, room_label)
);

create table if not exists public.umrah_room_occupants (
  room_id uuid not null references public.umrah_room_assignments (id) on delete cascade,
  pilgrim_id uuid not null references public.umrah_pilgrims (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (room_id, pilgrim_id)
);

create index if not exists umrah_room_occupants_pilgrim_idx on public.umrah_room_occupants (pilgrim_id);

-- One room per pilgrim per city, the pilgrim must be on this departure, and
-- the room cannot overfill. The room row is locked so two concurrent adds
-- cannot both take the last bed.
create or replace function public.umrah_room_occupants_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  room public.umrah_room_assignments;
  v_count int;
begin
  select * into room from public.umrah_room_assignments where id = new.room_id for update;
  if not found then
    raise exception 'room not found';
  end if;

  if not exists (
    select 1 from public.umrah_pilgrims p
      join public.umrah_bookings b on b.id = p.booking_id
     where p.id = new.pilgrim_id
       and b.departure_id = room.departure_id
       and b.status not in ('cancelled', 'refunded', 'failed')
  ) then
    raise exception 'pilgrim is not on this departure';
  end if;

  if exists (
    select 1 from public.umrah_room_occupants o
      join public.umrah_room_assignments r on r.id = o.room_id
     where o.pilgrim_id = new.pilgrim_id
       and r.departure_id = room.departure_id
       and r.city = room.city
       and o.room_id <> new.room_id
  ) then
    raise exception 'pilgrim already has a room in this city';
  end if;

  select count(*) into v_count from public.umrah_room_occupants where room_id = new.room_id;
  if v_count >= room.capacity then
    raise exception 'room is full';
  end if;

  return new;
end;
$$;

revoke execute on function public.umrah_room_occupants_check() from public, anon, authenticated;

drop trigger if exists umrah_room_occupants_check on public.umrah_room_occupants;
create trigger umrah_room_occupants_check
  before insert on public.umrah_room_occupants
  for each row execute function public.umrah_room_occupants_check();

-- A room cannot shrink below the pilgrims already in it.
create or replace function public.umrah_room_capacity_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.capacity < (select count(*) from public.umrah_room_occupants where room_id = new.id) then
    raise exception 'room is full';
  end if;
  return new;
end;
$$;

revoke execute on function public.umrah_room_capacity_check() from public, anon, authenticated;

drop trigger if exists umrah_room_capacity_check on public.umrah_room_assignments;
create trigger umrah_room_capacity_check
  before update of capacity on public.umrah_room_assignments
  for each row execute function public.umrah_room_capacity_check();

alter table public.umrah_room_assignments enable row level security;
alter table public.umrah_room_occupants enable row level security;

drop policy if exists "umrah_room_assignments: admin manage" on public.umrah_room_assignments;
create policy "umrah_room_assignments: admin manage"
  on public.umrah_room_assignments for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "umrah_room_occupants: admin manage" on public.umrah_room_occupants;
create policy "umrah_room_occupants: admin manage"
  on public.umrah_room_occupants for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Travellers see their own pilgrims' rooms only.
drop policy if exists "umrah_room_occupants: read own pilgrims" on public.umrah_room_occupants;
create policy "umrah_room_occupants: read own pilgrims"
  on public.umrah_room_occupants for select to authenticated
  using (exists (
    select 1 from public.umrah_pilgrims p
      join public.umrah_bookings b on b.id = p.booking_id
     where p.id = umrah_room_occupants.pilgrim_id
       and (b.customer_id = (select auth.uid()) or b.booked_by = (select auth.uid())
            or b.agency_id = any ((select public.my_agency_ids())::uuid[]))
  ));

drop policy if exists "umrah_room_assignments: read own rooms" on public.umrah_room_assignments;
create policy "umrah_room_assignments: read own rooms"
  on public.umrah_room_assignments for select to authenticated
  using (exists (
    select 1 from public.umrah_room_occupants o
      join public.umrah_pilgrims p on p.id = o.pilgrim_id
      join public.umrah_bookings b on b.id = p.booking_id
     where o.room_id = umrah_room_assignments.id
       and (b.customer_id = (select auth.uid()) or b.booked_by = (select auth.uid())
            or b.agency_id = any ((select public.my_agency_ids())::uuid[]))
  ));

-- ----------------------------------------------------------------------------
-- 2. Manifest: one row per pilgrim on a departure
-- ----------------------------------------------------------------------------
create or replace function public.umrah_departure_manifest(p_departure_id uuid)
returns table (
  booking_id uuid,
  booking_status text,
  fulfillment_stage text,
  room_sharing smallint,
  order_id uuid,
  order_number text,
  order_status text,
  order_total numeric,
  paid numeric,
  balance numeric,
  currency text,
  agency_name text,
  guest_name text,
  customer_name text,
  customer_phone text,
  pilgrim_id uuid,
  full_name text,
  gender text,
  date_of_birth date,
  nationality text,
  passport_number text,
  passport_expiry date,
  mahram_name text,
  phone text,
  missing text[],
  warnings text[],
  room_makkah text,
  room_madinah text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  return query
  with bookings as (
    select b.*
      from public.umrah_bookings b
     where b.departure_id = p_departure_id
       and b.status not in ('cancelled', 'refunded', 'failed')
  ),
  latest_order as (
    select distinct on (oi.umrah_booking_id)
           oi.umrah_booking_id, o.id, o.order_number, o.status, o.total, o.currency, o.agency_customer_id
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
     where oi.umrah_booking_id in (select id from bookings)
     order by oi.umrah_booking_id, o.created_at desc
  ),
  paid as (
    select p.order_id, sum(p.amount) as amount
      from public.payments p
     where p.status = 'succeeded'
       and p.order_id in (select id from latest_order)
     group by p.order_id
  ),
  readiness as (
    select r.*
      from bookings b
      cross join lateral public._umrah_pilgrim_readiness(b.id) r
  ),
  rooms as (
    select o.pilgrim_id,
           max(r.room_label) filter (where r.city = 'makkah') as makkah,
           max(r.room_label) filter (where r.city = 'madinah') as madinah
      from public.umrah_room_occupants o
      join public.umrah_room_assignments r on r.id = o.room_id
     where r.departure_id = p_departure_id
     group by o.pilgrim_id
  )
  select b.id,
         b.status::text,
         b.fulfillment_stage::text,
         b.room_sharing,
         lo.id,
         lo.order_number,
         lo.status::text,
         lo.total,
         coalesce(pd.amount, 0),
         greatest(coalesce(lo.total, 0) - coalesce(pd.amount, 0), 0),
         coalesce(lo.currency, b.currency),
         ag.name,
         ac.full_name,
         pr.full_name,
         pr.phone,
         pl.id,
         pl.full_name,
         pl.gender::text,
         pl.date_of_birth,
         pl.nationality,
         pl.passport_number,
         pl.passport_expiry,
         pl.mahram_name,
         pl.phone,
         coalesce(rd.missing, '{}'),
         coalesce(rd.warnings, '{}'),
         rm.makkah,
         rm.madinah
    from bookings b
    join public.umrah_pilgrims pl on pl.booking_id = b.id
    left join latest_order lo on lo.umrah_booking_id = b.id
    left join paid pd on pd.order_id = lo.id
    left join public.agencies ag on ag.id = b.agency_id
    left join public.agency_customers ac on ac.id = lo.agency_customer_id
    left join public.profiles pr on pr.id = b.customer_id
    left join readiness rd on rd.pilgrim_id = pl.id
    left join rooms rm on rm.pilgrim_id = pl.id
   order by coalesce(ac.full_name, pr.full_name), b.created_at, pl.full_name;
end;
$$;

revoke execute on function public.umrah_departure_manifest(uuid) from public, anon;
grant execute on function public.umrah_departure_manifest(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Departures overview: one row per departure from p_from on
-- ----------------------------------------------------------------------------
create or replace function public.umrah_departures_overview(p_from date default current_date)
returns table (
  departure_id uuid,
  package_id uuid,
  package_name text,
  departure_date date,
  return_date date,
  status text,
  total_seats integer,
  booked_seats integer,
  offline_seats integer,
  bookings integer,
  pilgrims integer,
  pilgrims_ready integer,
  balance_outstanding numeric,
  currency text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  return query
  with deps as (
    select d.*, p.name as package_name, p.currency as pkg_currency
      from public.umrah_package_departures d
      join public.umrah_packages p on p.id = d.package_id
     where d.departure_date >= p_from
  ),
  live as (
    select b.id, b.departure_id
      from public.umrah_bookings b
     where b.departure_id in (select id from deps)
       and b.status not in ('cancelled', 'refunded', 'failed')
  ),
  ready as (
    select l.departure_id,
           count(*)::int as pilgrims,
           count(*) filter (where cardinality(r.missing) = 0)::int as ready
      from live l
      cross join lateral public._umrah_pilgrim_readiness(l.id) r
     group by l.departure_id
  ),
  balances as (
    select l.departure_id, sum(greatest(o.total - coalesce(pd.amount, 0), 0)) as outstanding
      from live l
      join public.order_items oi on oi.umrah_booking_id = l.id
      join public.orders o on o.id = oi.order_id
      left join lateral (
        select sum(p.amount) as amount from public.payments p
         where p.order_id = o.id and p.status = 'succeeded'
      ) pd on true
     where o.status in ('pending_payment', 'held', 'partially_paid')
     group by l.departure_id
  ),
  counts as (
    select departure_id, count(*)::int as n from live group by departure_id
  )
  select d.id, d.package_id, d.package_name, d.departure_date, d.return_date, d.status,
         d.total_seats, d.booked_seats, d.offline_seats,
         coalesce(c.n, 0), coalesce(r.pilgrims, 0), coalesce(r.ready, 0),
         coalesce(bl.outstanding, 0), d.pkg_currency
    from deps d
    left join counts c on c.departure_id = d.id
    left join ready r on r.departure_id = d.id
    left join balances bl on bl.departure_id = d.id
   order by d.departure_date, d.package_name;
end;
$$;

revoke execute on function public.umrah_departures_overview(date) from public, anon;
grant execute on function public.umrah_departures_overview(date) to authenticated;
