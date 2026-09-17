-- Travel details a pilgrim asks about before anything else: which flight, and
-- how many people share a room.
--
-- Flights are per departure, not per package: the same package runs on
-- different carriers and dates across the season. All nullable, because
-- flights are usually ticketed weeks after a departure is scheduled.

alter table public.umrah_package_departures
  add column outbound_airline text,
  add column outbound_flight_number text,
  add column outbound_departs_at timestamptz,
  add column outbound_arrives_at timestamptz,
  add column return_airline text,
  add column return_flight_number text,
  add column return_departs_at timestamptz,
  add column return_arrives_at timestamptz,
  add column baggage_note text;

-- Group packages assign rooms by occupancy; 12 covers dormitory-style economy
-- rooms. Nullable because existing bookings never recorded it.
alter table public.umrah_bookings
  add column room_sharing smallint check (room_sharing between 1 and 12);

-- Private trips are priced per occupancy (single to quad). Quad is the
-- default so a quote starts at the lowest per-person price.
alter table public.umrah_custom_requests
  add column room_sharing smallint not null default 4 check (room_sharing between 1 and 4);

-- Per-occupancy prices for a service (typically a hotel). A service with no
-- rows here keeps using umrah_services.price.
create table public.umrah_service_sharing_prices (
  service_id uuid not null references public.umrah_services (id) on delete cascade,
  sharing smallint not null check (sharing between 1 and 4),
  price numeric(10,2) not null check (price > 0),
  primary key (service_id, sharing)
);

alter table public.umrah_service_sharing_prices enable row level security;

-- Mirrors umrah_services: staff manage, and the price is public exactly when
-- the service it belongs to is.
create policy "umrah_service_sharing_prices: admin manage"
  on public.umrah_service_sharing_prices for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "umrah_service_sharing_prices: public reads published"
  on public.umrah_service_sharing_prices for select to anon, authenticated
  using (
    exists (
      select 1 from public.umrah_services s
      where s.id = umrah_service_sharing_prices.service_id
        and s.status = 'published'
    )
  );
