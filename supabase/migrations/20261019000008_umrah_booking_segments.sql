-- Per-booking travel segments: flights, hotels, transfers and trains that
-- belong to one booking rather than to a departure.
--
-- Private bookings have no departure row, so their flights and hotel
-- confirmations had nowhere to live outside an uploaded PDF. Group bookings
-- can use the same rows for a pilgrim-specific change (a different return
-- flight). Times are wall-clock times tagged UTC, the same convention as
-- umrah_package_departures.

create table if not exists public.umrah_booking_segments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.umrah_bookings (id) on delete cascade,
  kind text not null check (kind in ('flight', 'hotel', 'transfer', 'train')),
  title text not null check (length(btrim(title)) between 1 and 120),
  provider text,
  reference text,
  starts_at timestamptz,
  ends_at timestamptz,
  city text check (city in ('makkah', 'madinah', 'jeddah', 'other')),
  notes text,
  sort_order smallint not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint umrah_booking_segments_time_order check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index if not exists umrah_booking_segments_booking_idx
  on public.umrah_booking_segments (booking_id, starts_at nulls last, sort_order);

drop trigger if exists set_umrah_booking_segments_updated_at on public.umrah_booking_segments;
create trigger set_umrah_booking_segments_updated_at
  before update on public.umrah_booking_segments
  for each row execute function public.set_updated_at();

alter table public.umrah_booking_segments enable row level security;

drop policy if exists "umrah_booking_segments: admin manage" on public.umrah_booking_segments;
create policy "umrah_booking_segments: admin manage"
  on public.umrah_booking_segments for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "umrah_booking_segments: read via parent booking" on public.umrah_booking_segments;
create policy "umrah_booking_segments: read via parent booking"
  on public.umrah_booking_segments for select to authenticated
  using (
    exists (
      select 1 from public.umrah_bookings b
      where b.id = umrah_booking_segments.booking_id
        and (b.customer_id = (select auth.uid()) or b.booked_by = (select auth.uid())
             or b.agency_id = any ((select public.my_agency_ids())::uuid[]))
    )
  );

-- A new or changed flight segment tells the traveller.
create or replace function public.umrah_segments_notify_flight()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bk public.umrah_bookings;
  v_order_id uuid;
begin
  if new.kind <> 'flight' then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.starts_at is not distinct from old.starts_at
     and new.ends_at is not distinct from old.ends_at
     and new.reference is not distinct from old.reference
     and new.title is not distinct from old.title then
    return new;
  end if;

  select * into bk from public.umrah_bookings where id = new.booking_id;
  if bk.status not in ('pending', 'confirmed') then
    return new;
  end if;
  select o.id into v_order_id
    from public.order_items oi join public.orders o on o.id = oi.order_id
   where oi.umrah_booking_id = bk.id
   order by o.created_at desc limit 1;

  insert into public.notifications (profile_id, type, title, body, data)
  select distinct r.profile_id, 'umrah_departure_changed',
         case when tg_op = 'INSERT' then 'Umrah flight added' else 'Umrah flight changed' end,
         new.title,
         jsonb_build_object('bookingId', bk.id, 'orderId', v_order_id)
  from (
    select bk.customer_id as profile_id
    union select bk.booked_by
    union select m.profile_id from public.agency_members m
           where bk.agency_id is not null and m.agency_id = bk.agency_id and m.status = 'active'
  ) r
  where r.profile_id is not null;
  return new;
end;
$$;

revoke execute on function public.umrah_segments_notify_flight() from public, anon, authenticated;

drop trigger if exists umrah_segments_notify_flight on public.umrah_booking_segments;
create trigger umrah_segments_notify_flight
  after insert or update on public.umrah_booking_segments
  for each row execute function public.umrah_segments_notify_flight();
