-- ============================================================================
-- Event & Hall Booking
-- STS rents out event venues/halls (weddings, conferences, corporate events).
-- Venues are an admin-managed catalog (like visa types / umrah packages);
-- bookings are date-based requests that staff confirm, and they settle
-- through the same orders/payments ledger as every other vertical.
-- ============================================================================

create table public.event_venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  tagline text,
  description text,
  city text not null,
  country_code text not null default 'SO',
  address text,
  capacity_seated integer check (capacity_seated > 0),
  capacity_standing integer check (capacity_standing > 0),
  size_sqm numeric(8,1),
  amenities jsonb not null default '[]'::jsonb,
  images jsonb not null default '[]'::jsonb,
  event_types jsonb not null default '[]'::jsonb, -- suggested uses: wedding, conference, ...
  base_price numeric(12,2) not null check (base_price >= 0),
  currency text not null default 'USD',
  price_unit text not null default 'per_event'
    check (price_unit in ('per_event', 'per_day', 'per_hour')),
  is_featured boolean not null default false,
  status public.listing_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index event_venues_city_idx on public.event_venues (city);
create index event_venues_status_idx on public.event_venues (status);

create trigger set_event_venues_updated_at
  before update on public.event_venues
  for each row execute function public.set_updated_at();

create sequence public.hall_booking_ref_seq;

create or replace function public.generate_hall_booking_ref()
returns text
language sql
as $$
  select 'STS-EVT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.hall_booking_ref_seq')::text, 6, '0');
$$;

create table public.hall_bookings (
  id uuid primary key default gen_random_uuid(),
  booking_ref text not null unique default public.generate_hall_booking_ref(),
  venue_id uuid not null references public.event_venues (id),
  customer_id uuid not null references public.profiles (id),
  booked_by uuid not null references public.profiles (id),
  agency_id uuid references public.agencies (id),
  event_type text not null,
  event_name text,
  event_date date not null,
  start_time time,
  end_time time,
  expected_guests integer check (expected_guests > 0),
  setup_requirements text,
  price numeric(12,2) not null default 0 check (price >= 0),
  currency text not null default 'USD',
  status public.booking_status not null default 'pending',
  customer_notes text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index hall_bookings_venue_idx on public.hall_bookings (venue_id, event_date);
create index hall_bookings_customer_idx on public.hall_bookings (customer_id);
create index hall_bookings_status_idx on public.hall_bookings (status);

create trigger set_hall_bookings_updated_at
  before update on public.hall_bookings
  for each row execute function public.set_updated_at();

create trigger hall_bookings_audit
  after insert or update or delete on public.hall_bookings
  for each row execute function public.audit_log_row_change();

-- Venue photo storage (public, admin-managed like umrah-images)
insert into storage.buckets (id, name, public) values ('venue-images', 'venue-images', true)
on conflict (id) do nothing;

create policy "venue_images: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'venue-images');

create policy "venue_images: admin manage"
  on storage.objects for all to authenticated
  using (bucket_id = 'venue-images' and public.is_admin())
  with check (bucket_id = 'venue-images' and public.is_admin());

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.event_venues enable row level security;
alter table public.hall_bookings enable row level security;

create policy "event_venues: public reads published"
  on public.event_venues for select to anon, authenticated
  using (status = 'published');

create policy "event_venues: admin manage"
  on public.event_venues for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "hall_bookings: reads via ownership/agency/admin"
  on public.hall_bookings for select to authenticated
  using (
    customer_id = auth.uid()
    or booked_by = auth.uid()
    or (agency_id is not null and public.is_agency_member(agency_id))
    or public.is_admin()
  );

create policy "hall_bookings: creator creates own"
  on public.hall_bookings for insert to authenticated
  with check (
    booked_by = auth.uid()
    and (customer_id = auth.uid() or (agency_id is not null and public.is_agency_member(agency_id)))
  );

create policy "hall_bookings: admin manage"
  on public.hall_bookings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Joins the unified order ledger; the value is wired into order_items in the
-- next migration (a new enum value can't be referenced in the transaction
-- that adds it).
alter type public.order_item_type add value if not exists 'hall';
