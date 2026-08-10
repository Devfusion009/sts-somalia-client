-- ============================================================================
-- Umrah packages: full admin-configurable product.
--
-- Before this, a package was little more than name/description/duration/
-- price/includes — the admin catalog form could not express what an Umrah
-- product actually IS: which Makkah/Madinah hotels and how far from the
-- Haram, the day-by-day plan, sharing-based per-person rates, meals, who to
-- call, or which local agencies handle it on the ground.
--
-- Four child tables (hotels, itinerary, pricing, agencies) rather than more
-- jsonb blobs: each is independently editable in the admin UI, orderable,
-- and — for pricing — needs real numeric aggregation (base_price is derived
-- from the cheapest sharing rate; see recalcUmrahBasePrice in
-- modules/umrah/admin-actions.ts).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Package-level fields
-- ----------------------------------------------------------------------------
alter table public.umrah_packages add column tagline text;
alter table public.umrah_packages add column tier text;
alter table public.umrah_packages add column is_featured boolean not null default false;
alter table public.umrah_packages add column origin_iata text;
alter table public.umrah_packages add column destination_iata text;

-- Strikethrough / "was" price. Display-only: base_price stays the amount
-- actually charged (see modules/umrah/actions.ts booking flow).
alter table public.umrah_packages add column original_price numeric(10,2)
  check (original_price is null or original_price >= 0);

alter table public.umrah_packages add column meal_plan text not null default 'none'
  check (meal_plan in ('none', 'breakfast', 'half_board', 'full_board'));
alter table public.umrah_packages add column meals_note text;

alter table public.umrah_packages add column contact_person_name text;
alter table public.umrah_packages add column contact_person_phone text;
alter table public.umrah_packages add column contact_person_email text;
alter table public.umrah_packages add column contact_whatsapp text;

-- hotel_makkah_id / hotel_madinah_id are dropped in favour of
-- umrah_package_hotels below. Verified safe before dropping: both columns
-- are NULL on every existing row and are referenced nowhere in application
-- code (only in the generated database.types.ts). They also couldn't carry
-- what this product needs — distance-from-Haram and nights are
-- Umrah-specific and absent from public.hotels — and hotels.partner_id is
-- NOT NULL, so linking a Saudi hotel would have forced a fake
-- hotel_partners row and leaked that hotel into the B2C /hotels listing.
alter table public.umrah_packages drop column hotel_makkah_id;
alter table public.umrah_packages drop column hotel_madinah_id;

-- ----------------------------------------------------------------------------
-- 2) Hotels on the package (Makkah / Madinah legs)
-- hotel_id is an OPTIONAL link to a real partner property; name/star_rating
-- are stored directly so a Saudi hotel STS doesn't partner with can still be
-- listed (the common case).
-- ----------------------------------------------------------------------------
create table public.umrah_package_hotels (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.umrah_packages (id) on delete cascade,
  city text not null check (city in ('makkah', 'madinah', 'other')),
  hotel_id uuid references public.hotels (id) on delete set null,
  name text not null,
  star_rating smallint check (star_rating between 1 and 5),
  distance_to_haram_m integer check (distance_to_haram_m >= 0),
  nights smallint check (nights > 0),
  room_type text,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create index umrah_package_hotels_package_idx on public.umrah_package_hotels (package_id, sort_order);

-- ----------------------------------------------------------------------------
-- 3) Day-by-day plan
-- ----------------------------------------------------------------------------
create table public.umrah_itinerary_days (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.umrah_packages (id) on delete cascade,
  day_number smallint not null check (day_number > 0),
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (package_id, day_number)
);

create index umrah_itinerary_days_package_idx on public.umrah_itinerary_days (package_id, day_number);

-- ----------------------------------------------------------------------------
-- 4) Per-person rate card by room sharing
-- `sharing` is the number of pilgrims per room (2 = double, 4 = quad, and
-- larger group rates like the 5-sharing rates competitors advertise), not a
-- fixed enum.
-- ----------------------------------------------------------------------------
create table public.umrah_package_pricing (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.umrah_packages (id) on delete cascade,
  sharing smallint not null check (sharing between 1 and 12),
  price numeric(10,2) not null check (price >= 0),
  created_at timestamptz not null default now(),
  unique (package_id, sharing)
);

create index umrah_package_pricing_package_idx on public.umrah_package_pricing (package_id, sharing);

-- ----------------------------------------------------------------------------
-- 5) Local agencies handling this package (operational assignment)
-- Deliberately NOT public: `agencies` itself is readable only by its own
-- members and admins, so exposing this to anon would leak B2B relationships
-- and return null joins anyway. Admins manage it; a linked agency can see
-- its own assignment.
-- ----------------------------------------------------------------------------
create table public.umrah_package_agencies (
  package_id uuid not null references public.umrah_packages (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  primary key (package_id, agency_id)
);

create index umrah_package_agencies_agency_idx on public.umrah_package_agencies (agency_id);

-- ----------------------------------------------------------------------------
-- RLS — marketing content (hotels/itinerary/pricing) is publicly readable
-- for published packages, mirroring "umrah_departures: public reads for
-- published packages". The agency linkage is not.
-- ----------------------------------------------------------------------------
alter table public.umrah_package_hotels enable row level security;
alter table public.umrah_itinerary_days enable row level security;
alter table public.umrah_package_pricing enable row level security;
alter table public.umrah_package_agencies enable row level security;

create policy "umrah_package_hotels: public reads for published packages"
  on public.umrah_package_hotels for select to anon, authenticated
  using (exists (select 1 from public.umrah_packages p where p.id = package_id and p.status = 'published'));

create policy "umrah_package_hotels: admin manage"
  on public.umrah_package_hotels for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "umrah_itinerary_days: public reads for published packages"
  on public.umrah_itinerary_days for select to anon, authenticated
  using (exists (select 1 from public.umrah_packages p where p.id = package_id and p.status = 'published'));

create policy "umrah_itinerary_days: admin manage"
  on public.umrah_itinerary_days for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "umrah_package_pricing: public reads for published packages"
  on public.umrah_package_pricing for select to anon, authenticated
  using (exists (select 1 from public.umrah_packages p where p.id = package_id and p.status = 'published'));

create policy "umrah_package_pricing: admin manage"
  on public.umrah_package_pricing for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "umrah_package_agencies: admin or linked agency reads"
  on public.umrah_package_agencies for select to authenticated
  using (public.is_admin() or public.is_agency_member(agency_id));

create policy "umrah_package_agencies: admin manage"
  on public.umrah_package_agencies for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
