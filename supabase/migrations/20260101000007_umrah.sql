-- ============================================================================
-- Umrah Management
-- Packages are curated/operated in-house (admin), scheduled as dated
-- departures with seat inventory, and booked by customers or B2B agents.
-- ============================================================================

create table public.umrah_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  duration_days smallint not null,
  hotel_makkah_id uuid references public.hotels (id),
  hotel_madinah_id uuid references public.hotels (id),
  includes jsonb not null default '[]'::jsonb, -- e.g. ["flights","visa","transport","meals"]
  base_price numeric(10,2) not null check (base_price >= 0),
  currency text not null default 'USD',
  images jsonb not null default '[]'::jsonb,
  status public.listing_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index umrah_packages_status_idx on public.umrah_packages (status);

create trigger set_umrah_packages_updated_at
  before update on public.umrah_packages
  for each row execute function public.set_updated_at();

create table public.umrah_package_departures (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.umrah_packages (id) on delete cascade,
  departure_date date not null,
  return_date date not null check (return_date > departure_date),
  total_seats integer not null check (total_seats > 0),
  booked_seats integer not null default 0 check (booked_seats >= 0),
  price_override numeric(10,2),
  created_at timestamptz not null default now()
);

create index umrah_departures_package_idx on public.umrah_package_departures (package_id);
create index umrah_departures_date_idx on public.umrah_package_departures (departure_date);

create table public.umrah_bookings (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.umrah_packages (id),
  departure_id uuid not null references public.umrah_package_departures (id),
  customer_id uuid not null references public.profiles (id),
  booked_by uuid not null references public.profiles (id),
  agency_id uuid references public.agencies (id),
  num_pilgrims integer not null check (num_pilgrims > 0),
  total_price numeric(10,2) not null check (total_price >= 0),
  currency text not null default 'USD',
  special_requests text,
  status public.booking_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index umrah_bookings_customer_idx on public.umrah_bookings (customer_id);
create index umrah_bookings_agency_idx on public.umrah_bookings (agency_id);
create index umrah_bookings_departure_idx on public.umrah_bookings (departure_id);

create trigger set_umrah_bookings_updated_at
  before update on public.umrah_bookings
  for each row execute function public.set_updated_at();

create type public.pilgrim_gender as enum ('male', 'female');

create table public.umrah_pilgrims (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.umrah_bookings (id) on delete cascade,
  full_name text not null,
  gender public.pilgrim_gender not null,
  date_of_birth date,
  nationality text,
  passport_number text,
  passport_expiry date,
  mahram_name text, -- required for female pilgrims per Umrah regulations
  mahram_relation text
);

create index umrah_pilgrims_booking_idx on public.umrah_pilgrims (booking_id);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.umrah_packages enable row level security;
alter table public.umrah_package_departures enable row level security;
alter table public.umrah_bookings enable row level security;
alter table public.umrah_pilgrims enable row level security;

create policy "umrah_packages: public reads published"
  on public.umrah_packages for select to anon, authenticated
  using (status = 'published');

create policy "umrah_packages: admin manage"
  on public.umrah_packages for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "umrah_departures: public reads for published packages"
  on public.umrah_package_departures for select to anon, authenticated
  using (exists (select 1 from public.umrah_packages p where p.id = package_id and p.status = 'published'));

create policy "umrah_departures: admin manage"
  on public.umrah_package_departures for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "umrah_bookings: customer reads own"
  on public.umrah_bookings for select to authenticated
  using (customer_id = auth.uid() or booked_by = auth.uid());

create policy "umrah_bookings: agency reads its bookings"
  on public.umrah_bookings for select to authenticated
  using (agency_id is not null and public.is_agency_member(agency_id));

create policy "umrah_bookings: admin manage"
  on public.umrah_bookings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "umrah_bookings: customer creates own booking"
  on public.umrah_bookings for insert to authenticated
  with check (booked_by = auth.uid() and (customer_id = auth.uid() or (agency_id is not null and public.is_agency_member(agency_id))));

create policy "umrah_bookings: customer cancels own pending booking"
  on public.umrah_bookings for update to authenticated
  using ((customer_id = auth.uid() or booked_by = auth.uid()) and status = 'pending')
  with check (status in ('pending', 'cancelled'));

create policy "umrah_pilgrims: read via parent booking"
  on public.umrah_pilgrims for select to authenticated
  using (exists (
    select 1 from public.umrah_bookings b
    where b.id = booking_id
      and (b.customer_id = auth.uid() or b.booked_by = auth.uid()
           or (b.agency_id is not null and public.is_agency_member(b.agency_id))
           or public.is_admin())
  ));

create policy "umrah_pilgrims: booking owner manages pilgrims"
  on public.umrah_pilgrims for all to authenticated
  using (exists (
    select 1 from public.umrah_bookings b
    where b.id = booking_id and (b.customer_id = auth.uid() or b.booked_by = auth.uid() or public.is_admin())
  ))
  with check (exists (
    select 1 from public.umrah_bookings b
    where b.id = booking_id and (b.customer_id = auth.uid() or b.booked_by = auth.uid() or public.is_admin())
  ));
