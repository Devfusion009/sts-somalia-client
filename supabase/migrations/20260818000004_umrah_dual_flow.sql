-- ============================================================================
-- Umrah: two clearly separated booking flows.
--
--   GROUP   — STS designs the package in advance (Basic / Standard / Premium),
--             fixes the per-person price, and schedules dated departures with
--             seat inventory. The customer picks a package + pax + departure
--             and the fixed price applies. This is the product that already
--             existed: umrah_packages + umrah_package_departures. Nothing
--             about it changes here except that it is now named "Group".
--
--   PRIVATE — the customer builds their own trip: travellers, dates, nights in
--             each city, Makkah hotel, Madinah hotel, flight, visa, ground
--             transport, the Makkah<->Madinah leg (bus / Haramain train /
--             private VIP car), and any extra services. Every choice is an
--             admin-priced row in umrah_services, so the total is computed,
--             not quoted from thin air.
--
-- Why the private flow is NOT built by composing the existing verticals
-- (hotels / flights / visa): Saudi hotels are deliberately absent from
-- public.hotels (see 20260809000004 — hotels.partner_id semantics and the
-- B2C /hotels listing), flight inventory is live-search-only and not
-- bookable yet (Duffel), and visa_types are country-scoped products with
-- their own wizard. A dedicated, admin-priced Umrah service catalog is how
-- STS actually sells this: negotiated rates resold as a package.
--
-- Why a private trip still produces a public.umrah_bookings row rather than
-- a parallel booking table: it IS an Umrah sale. Reusing the table means the
-- order/checkout ledger, order_items, invoices, vouchers, the admin booking
-- calendar, agency product permissions ('umrah'), agency markups, the B2C
-- "My Bookings" list and umrah_pilgrims all keep working untouched. The only
-- change they see is that package_id/departure_id can now be null.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Vocabulary
-- ----------------------------------------------------------------------------

-- The customer-facing service groups, mapped 1:1 from the client's brief:
--   "Hotel in Makkah"            -> hotel_makkah
--   "Hotel in Madinah"           -> hotel_madinah
--   "Flight"                     -> flight
--   "Visa"                       -> visa
--   "Transportation"             -> transport   (airport + in-city ground)
--   "Makkah -> Madinah transfer" -> intercity   (ONE leg, several ways to do it)
--   "Train option"               -> an intercity option (Haramain high-speed)
--   "VIP/private transport"      -> a transport / intercity option, and an extra
--   "Other available services"   -> extra
--
-- Train and VIP are options inside a category rather than categories of their
-- own on purpose: they are alternative ways to travel the SAME leg. Modelled
-- as siblings, a customer could buy the train AND the bus AND the private car
-- for one journey and be charged for all three.
create type public.umrah_service_category as enum (
  'hotel_makkah',
  'hotel_madinah',
  'flight',
  'visa',
  'transport',
  'intercity',
  'extra'
);

-- How a service's price scales. Quantity is derived, never typed by staff:
--   per_person            price x travellers                    (visa, flight seat, train ticket)
--   per_person_per_night  price x travellers x nights in that city (hotels, sharing basis)
--   per_night             price x nights in that city             (a whole apartment)
--   per_booking           price, once                             (a private car, a group guide)
create type public.umrah_price_unit as enum (
  'per_person',
  'per_person_per_night',
  'per_night',
  'per_booking'
);

-- The standard/package level the client asked for. Group packages keep the
-- free-text umrah_packages.tier column (it already holds legacy 'economy' and
-- 'vip' values on live rows); this enum governs the private builder, where
-- the tier is a filter/preset over the service catalog.
create type public.umrah_tier as enum ('basic', 'standard', 'premium');

-- ----------------------------------------------------------------------------
-- 2) The private-flow service catalog
--
-- tier IS NULL means "offered at every level" — the Umrah visa costs what it
-- costs whether the trip is Basic or Premium. A tiered row (a 5-star hotel
-- 200m from the Haram) shows up when that tier is selected and is still
-- reachable via the builder's "show all options" toggle, so the tier is a
-- starting point rather than a cage.
-- ----------------------------------------------------------------------------
create table public.umrah_services (
  id uuid primary key default gen_random_uuid(),
  category public.umrah_service_category not null,
  name text not null,
  description text,
  tier public.umrah_tier,
  price numeric(10,2) not null check (price >= 0),
  currency text not null default 'USD',
  price_unit public.umrah_price_unit not null,
  -- Hotel display fields. Null for every non-hotel category; kept on the same
  -- table rather than a hotel-only side table because they are pure display
  -- and every other column is shared.
  star_rating smallint check (star_rating between 1 and 5),
  distance_to_haram_m integer check (distance_to_haram_m >= 0),
  -- Pre-selected when the customer picks this row's tier. At most one default
  -- per (category, tier) — enforced below.
  is_default boolean not null default false,
  sort_order smallint not null default 0,
  status public.listing_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index umrah_services_category_idx on public.umrah_services (category, sort_order);
create index umrah_services_status_idx on public.umrah_services (status);

-- Two defaults in one (category, tier) would make the builder's preselection
-- arbitrary — whichever row the query happened to return first.
create unique index umrah_services_one_default_per_tier_idx
  on public.umrah_services (category, tier)
  where is_default and status = 'published';

create trigger set_umrah_services_updated_at
  before update on public.umrah_services
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3) The customer's build
--
-- A draft row created the moment the customer starts, then advanced step by
-- step — the same shape as visa_applications (status + current_step), so a
-- half-built trip survives a closed tab, and for the same reason: this form
-- is far too long to lose.
-- ----------------------------------------------------------------------------
create sequence public.umrah_request_ref_seq;

create or replace function public.generate_umrah_request_ref()
returns text
language sql
as $$
  select 'STS-UM-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.umrah_request_ref_seq')::text, 6, '0');
$$;

create table public.umrah_custom_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default public.generate_umrah_request_ref(),
  customer_id uuid not null references public.profiles (id),
  booked_by uuid not null references public.profiles (id),
  agency_id uuid references public.agencies (id),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'cancelled')),
  current_step smallint not null default 1 check (current_step between 1 and 4),
  tier public.umrah_tier not null default 'standard',
  num_pilgrims integer not null default 1 check (num_pilgrims > 0),
  departure_date date,
  -- Nights per city rather than one "duration": hotel cost is per city, and
  -- the total trip length is derivable from these two (plus travel days)
  -- while the reverse is not.
  nights_makkah smallint not null default 4 check (nights_makkah >= 0),
  nights_madinah smallint not null default 3 check (nights_madinah >= 0),
  notes text,
  -- Pilgrim details are captured a step BEFORE the booking exists, so they are
  -- staged here as jsonb (the same shape visa_applications uses for
  -- traveler_details) and materialised into public.umrah_pilgrims at submit.
  -- Without this, closing the tab on the last step would lose every passport
  -- number the customer had just typed.
  pilgrims jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index umrah_custom_requests_customer_idx on public.umrah_custom_requests (customer_id);
create index umrah_custom_requests_agency_idx on public.umrah_custom_requests (agency_id);
create index umrah_custom_requests_status_idx on public.umrah_custom_requests (status, created_at);

create trigger set_umrah_custom_requests_updated_at
  before update on public.umrah_custom_requests
  for each row execute function public.set_updated_at();

-- Chosen services, with name/unit/price SNAPSHOTTED at selection time. An
-- admin repricing a hotel next week must not silently change what a customer
-- already reviewed and agreed to — the same reason order_items carries its
-- own unit_price instead of joining back to the catalog.
create table public.umrah_custom_request_services (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.umrah_custom_requests (id) on delete cascade,
  service_id uuid references public.umrah_services (id) on delete set null,
  category public.umrah_service_category not null,
  name text not null,
  price_unit public.umrah_price_unit not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index umrah_custom_request_services_request_idx
  on public.umrah_custom_request_services (request_id, category);

-- Every category except 'extra' is a pick-one: two Makkah hotels on one trip
-- is not a configuration, it is a bug. 'extra' is deliberately excluded — it
-- is the multi-select bucket.
create unique index umrah_custom_request_services_single_choice_idx
  on public.umrah_custom_request_services (request_id, category)
  where category <> 'extra';

-- ----------------------------------------------------------------------------
-- 4) umrah_bookings serves both flows
--
-- package_id/departure_id become nullable and a private booking points at its
-- request instead. booking_kind is not derivable-only-by-null-checking on
-- purpose: it is what every read site filters and labels on, and it makes the
-- constraint below readable.
-- ----------------------------------------------------------------------------
alter table public.umrah_bookings alter column package_id drop not null;
alter table public.umrah_bookings alter column departure_id drop not null;

alter table public.umrah_bookings
  add column booking_kind text not null default 'group'
    check (booking_kind in ('group', 'private'));

alter table public.umrah_bookings
  add column custom_request_id uuid references public.umrah_custom_requests (id);

create index umrah_bookings_custom_request_idx on public.umrah_bookings (custom_request_id);

alter table public.umrah_bookings add constraint umrah_bookings_kind_target check (
  (booking_kind = 'group'
     and package_id is not null
     and departure_id is not null
     and custom_request_id is null)
  or
  (booking_kind = 'private'
     and custom_request_id is not null
     and package_id is null
     and departure_id is null)
);

-- ----------------------------------------------------------------------------
-- 5) RLS
--
-- The catalog is public marketing data for published rows (the builder has to
-- show prices before anyone signs in). A request is private to the customer
-- who built it, the agency that placed it, and admins — mirroring
-- umrah_bookings exactly.
-- ----------------------------------------------------------------------------
alter table public.umrah_services enable row level security;
alter table public.umrah_custom_requests enable row level security;
alter table public.umrah_custom_request_services enable row level security;

create policy "umrah_services: public reads published"
  on public.umrah_services for select to anon, authenticated
  using (status = 'published');

create policy "umrah_services: admin manage"
  on public.umrah_services for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "umrah_custom_requests: owner reads own"
  on public.umrah_custom_requests for select to authenticated
  using (customer_id = auth.uid() or booked_by = auth.uid());

create policy "umrah_custom_requests: agency reads its requests"
  on public.umrah_custom_requests for select to authenticated
  using (agency_id is not null and public.is_agency_member(agency_id));

create policy "umrah_custom_requests: admin manage"
  on public.umrah_custom_requests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "umrah_custom_requests: owner creates own"
  on public.umrah_custom_requests for insert to authenticated
  with check (
    booked_by = auth.uid()
    and (customer_id = auth.uid() or (agency_id is not null and public.is_agency_member(agency_id)))
  );

-- Editing stops at submission: once STS is working the request, the priced
-- lines the customer agreed to are frozen.
create policy "umrah_custom_requests: owner edits own draft"
  on public.umrah_custom_requests for update to authenticated
  using ((customer_id = auth.uid() or booked_by = auth.uid()) and status = 'draft')
  with check (status in ('draft', 'submitted', 'cancelled'));

create policy "umrah_custom_request_services: read via parent request"
  on public.umrah_custom_request_services for select to authenticated
  using (exists (
    select 1 from public.umrah_custom_requests r
    where r.id = request_id
      and (r.customer_id = auth.uid() or r.booked_by = auth.uid()
           or (r.agency_id is not null and public.is_agency_member(r.agency_id))
           or public.is_admin())
  ));

create policy "umrah_custom_request_services: owner manages draft lines"
  on public.umrah_custom_request_services for all to authenticated
  using (exists (
    select 1 from public.umrah_custom_requests r
    where r.id = request_id
      and (r.customer_id = auth.uid() or r.booked_by = auth.uid())
      and r.status = 'draft'
  ))
  with check (exists (
    select 1 from public.umrah_custom_requests r
    where r.id = request_id
      and (r.customer_id = auth.uid() or r.booked_by = auth.uid())
      and r.status = 'draft'
  ));

create policy "umrah_custom_request_services: admin manage"
  on public.umrah_custom_request_services for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6) Starter catalog
--
-- The private builder is unusable with an empty catalog, so it ships with a
-- working set of real options across all seven categories and all three
-- tiers — the same reasoning as the seeded manual hotels/venues in
-- 20260817000001. Prices are placeholders for STS to replace in
-- /admin/catalog/umrah/services; the shape (unit, tier, defaults) is what
-- matters and is what the pricing engine reads.
-- ----------------------------------------------------------------------------
insert into public.umrah_services
  (category, name, description, tier, price, price_unit, star_rating, distance_to_haram_m, is_default, sort_order, status)
values
  -- Makkah hotels: per person per night, on a sharing basis.
  ('hotel_makkah', 'Al Kiswah Towers',        'Clean, well-run hotel with a free shuttle to the Haram.',            'basic',    28,  'per_person_per_night', 3, 3200, true,  10, 'published'),
  ('hotel_makkah', 'Elaf Al Mashaer',         'Walking distance to the Haram via the pedestrian tunnel.',           'standard', 55,  'per_person_per_night', 4, 900,  true,  20, 'published'),
  ('hotel_makkah', 'Swissotel Al Maqam',      'Abraj Al Bait complex — steps from the Haram courtyard.',            'premium',  120, 'per_person_per_night', 5, 150,  true,  30, 'published'),
  ('hotel_makkah', 'Pullman ZamZam Makkah',   'Clock Tower, direct Haram views on higher floors.',                  'premium',  165, 'per_person_per_night', 5, 100,  false, 31, 'published'),

  -- Madinah hotels.
  ('hotel_madinah', 'Al Eiman Taibah',        'Comfortable base a short walk from the Prophet''s Mosque.',          'basic',    24,  'per_person_per_night', 3, 700,  true,  10, 'published'),
  ('hotel_madinah', 'Millennium Al Aqeeq',    'Modern rooms with a shuttle to the Haram.',                          'standard', 48,  'per_person_per_night', 4, 550,  true,  20, 'published'),
  ('hotel_madinah', 'Anwar Al Madinah Movenpick', 'Facing the Prophet''s Mosque, direct courtyard access.',         'premium',  105, 'per_person_per_night', 5, 120,  true,  30, 'published'),

  -- Flights. Per person; a return ticket, so the trip length does not change it.
  ('flight', 'Return flight — Mogadishu (MGQ) to Jeddah (JED)', 'Economy, one checked bag, one stop.',              null,       520, 'per_person', null, null, true,  10, 'published'),
  ('flight', 'Return flight — Hargeisa (HGA) to Jeddah (JED)',  'Economy, one checked bag, one stop.',              null,       540, 'per_person', null, null, false, 20, 'published'),
  ('flight', 'Return flight — Jeddah, business class',          'Lie-flat where available, extra baggage.',         'premium',  1450,'per_person', null, null, false, 30, 'published'),

  -- Visa.
  ('visa', 'Umrah visa processing', 'Application, biometrics support and issuance, handled end to end by STS.',     null,       185, 'per_person', null, null, true,  10, 'published'),

  -- Ground transport: airport transfers and moving around each city.
  ('transport', 'Shared coach transfers',   'Airport pickup and drop-off on a shared group coach.',                 'basic',    45,  'per_person',  null, null, true,  10, 'published'),
  ('transport', 'Private car transfers',    'A car reserved for your party for every airport transfer.',            'standard', 260, 'per_booking', null, null, true,  20, 'published'),
  ('transport', 'VIP GMC with driver',      'Private GMC and driver on call for the whole trip.',                   'premium',  890, 'per_booking', null, null, true,  30, 'published'),

  -- The Makkah <-> Madinah leg. One journey, four ways to make it.
  ('intercity', 'Shared bus, Makkah to Madinah',        'Scheduled coach, roughly 6 hours.',                        'basic',    35,  'per_person',  null, null, true,  10, 'published'),
  ('intercity', 'Haramain high-speed train, economy',   'About 2 hours, station transfers included.',               'standard', 95,  'per_person',  null, null, true,  20, 'published'),
  ('intercity', 'Haramain high-speed train, business',  'Business cabin, about 2 hours, station transfers included.','premium',  165, 'per_person',  null, null, false, 30, 'published'),
  ('intercity', 'Private VIP car, Makkah to Madinah',   'Your party alone, door to door, stops on request.',        'premium',  480, 'per_booking', null, null, true,  40, 'published'),

  -- Extras: the multi-select bucket.
  ('extra', 'Guided ziyarat — Makkah',       'Half-day tour of the historic sites with a guide.',                   null, 40,  'per_person',  null, null, false, 10, 'published'),
  ('extra', 'Guided ziyarat — Madinah',      'Half-day tour of the historic sites with a guide.',                   null, 40,  'per_person',  null, null, false, 20, 'published'),
  ('extra', 'Full board meal plan',          'Breakfast, lunch and dinner throughout the stay.',                    null, 22,  'per_person_per_night', null, null, false, 30, 'published'),
  ('extra', 'Dedicated Somali-speaking guide','A guide assigned to your party for the whole journey.',              null, 640, 'per_booking', null, null, false, 40, 'published'),
  ('extra', 'Wheelchair assistance',         'Wheelchair and an attendant at the Haram and airports.',              null, 120, 'per_person',  null, null, false, 50, 'published'),
  ('extra', 'Ihram and travel kit',          'Ihram garments, prayer mat, belt bag and a guidebook.',               null, 45,  'per_person',  null, null, false, 60, 'published'),
  ('extra', 'ZamZam water, 5 litres',        'Sealed and cleared for the flight home.',                             null, 18,  'per_person',  null, null, false, 70, 'published');
