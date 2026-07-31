-- ============================================================================
-- Flight Booking (International & Local)
-- Airports/airlines are reference data. flight_offers is a short-lived cache
-- of external GDS/NDC provider search results (Amadeus/Duffel/etc.) written
-- server-side with the service role from an API route. flight_bookings is
-- the confirmed reservation record tied back to the provider's PNR.
-- ============================================================================

create type public.trip_type as enum ('one_way', 'round_trip', 'multi_city');
create type public.passenger_type as enum ('adult', 'child', 'infant');

create table public.airports (
  id uuid primary key default gen_random_uuid(),
  iata_code char(3) not null unique,
  icao_code char(4),
  name text not null,
  city text not null,
  country_code text not null,
  latitude numeric(9,6),
  longitude numeric(9,6),
  timezone text
);

create table public.airlines (
  id uuid primary key default gen_random_uuid(),
  iata_code char(2) not null unique,
  icao_code char(3),
  name text not null,
  logo_url text
);

-- Ephemeral search-result cache. Populated server-side (service role) from
-- the flight search API route; never written to directly by clients.
create table public.flight_offers (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_offer_id text not null,
  origin_iata char(3) not null references public.airports (iata_code),
  destination_iata char(3) not null references public.airports (iata_code),
  depart_at timestamptz not null,
  arrive_at timestamptz not null,
  airline_id uuid references public.airlines (id),
  flight_number text,
  cabin_class text not null default 'economy',
  price numeric(10,2) not null check (price >= 0),
  currency text not null default 'USD',
  raw_payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_offer_id)
);

create index flight_offers_route_idx on public.flight_offers (origin_iata, destination_iata, depart_at);
create index flight_offers_expires_idx on public.flight_offers (expires_at);

create table public.flight_bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id),
  booked_by uuid not null references public.profiles (id),
  agency_id uuid references public.agencies (id),
  provider text not null,
  provider_booking_ref text,
  trip_type public.trip_type not null default 'one_way',
  origin_iata char(3) not null references public.airports (iata_code),
  destination_iata char(3) not null references public.airports (iata_code),
  depart_at timestamptz not null,
  return_at timestamptz,
  cabin_class text not null default 'economy',
  status public.booking_status not null default 'pending',
  total_price numeric(10,2) not null check (total_price >= 0),
  currency text not null default 'USD',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index flight_bookings_customer_idx on public.flight_bookings (customer_id);
create index flight_bookings_agency_idx on public.flight_bookings (agency_id);

create trigger set_flight_bookings_updated_at
  before update on public.flight_bookings
  for each row execute function public.set_updated_at();

create table public.flight_passengers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.flight_bookings (id) on delete cascade,
  passenger_type public.passenger_type not null default 'adult',
  full_name text not null,
  date_of_birth date,
  passport_number text,
  passport_expiry date,
  nationality text,
  meal_preference text,
  seat_preference text
);

create index flight_passengers_booking_idx on public.flight_passengers (booking_id);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.airports enable row level security;
alter table public.airlines enable row level security;
alter table public.flight_offers enable row level security;
alter table public.flight_bookings enable row level security;
alter table public.flight_passengers enable row level security;

create policy "airports: public read"
  on public.airports for select to anon, authenticated using (true);

create policy "airlines: public read"
  on public.airlines for select to anon, authenticated using (true);

create policy "airports: admin manage"
  on public.airports for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "airlines: admin manage"
  on public.airlines for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Offers are cache rows written by the service role from a trusted API
-- route; clients only ever read non-expired ones.
create policy "flight_offers: public reads unexpired"
  on public.flight_offers for select to anon, authenticated
  using (expires_at > now());

create policy "flight_offers: admin manage"
  on public.flight_offers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "flight_bookings: customer reads own"
  on public.flight_bookings for select to authenticated
  using (customer_id = auth.uid() or booked_by = auth.uid());

create policy "flight_bookings: agency reads its bookings"
  on public.flight_bookings for select to authenticated
  using (agency_id is not null and public.is_agency_member(agency_id));

create policy "flight_bookings: admin manage"
  on public.flight_bookings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "flight_bookings: customer creates own booking"
  on public.flight_bookings for insert to authenticated
  with check (booked_by = auth.uid() and (customer_id = auth.uid() or (agency_id is not null and public.is_agency_member(agency_id))));

create policy "flight_bookings: customer cancels own pending booking"
  on public.flight_bookings for update to authenticated
  using ((customer_id = auth.uid() or booked_by = auth.uid()) and status = 'pending')
  with check (status in ('pending', 'cancelled'));

create policy "flight_passengers: follow parent booking read access"
  on public.flight_passengers for select to authenticated
  using (exists (
    select 1 from public.flight_bookings b
    where b.id = booking_id
      and (b.customer_id = auth.uid() or b.booked_by = auth.uid()
           or (b.agency_id is not null and public.is_agency_member(b.agency_id))
           or public.is_admin())
  ));

create policy "flight_passengers: booking owner manages passengers"
  on public.flight_passengers for all to authenticated
  using (exists (
    select 1 from public.flight_bookings b
    where b.id = booking_id and (b.customer_id = auth.uid() or b.booked_by = auth.uid() or public.is_admin())
  ))
  with check (exists (
    select 1 from public.flight_bookings b
    where b.id = booking_id and (b.customer_id = auth.uid() or b.booked_by = auth.uid() or public.is_admin())
  ));
