-- ============================================================================
-- Per-property contact/links/reviews store for hotels + event venues
--
-- Client asked (2026-08-18) for one dedicated place per hotel/venue holding
-- links, media, reviews, and phone number — and matched a list of official
-- hotel/venue websites against the manual inventory seeded in
-- 20260817000001_manual_inventory_per_person_pricing.sql. Scope decisions,
-- explained so a future reader isn't left guessing:
--
--  * PHONE: a single scalar value per property — a plain column, not a table.
--  * LINKS: genuinely plural (website, Facebook, Instagram, WhatsApp,
--    Google Maps, ...) — a proper table, one row per link, seeded below with
--    the official website for every property that matched the client's
--    list. Links live in exactly ONE place — there is no separate `website`
--    column anywhere.
--  * MEDIA/PHOTOS: deliberately NOT duplicated into a new table. hotels.images
--    / event_venues.images (jsonb) already IS each property's photo store —
--    it's live in the partner upload flow (partner/hotels/*, venue/venues/*)
--    today. A parallel media table would just be a second, driftable copy of
--    the same data for no functional gain.
--  * REVIEWS: did not exist at all — new table. Deliberately admin-authored
--    for now (`source` records provenance) — no public submission path
--    exists yet, and we are NOT importing reviews from TripAdvisor/etc.
--    (copyright — those belong to the reviewer/platform, not us). `status`
--    lets admin hide a review without deleting it, in case a hidden-review
--    workflow is needed later.
--
-- Both new tables use two nullable FK columns (hotel_id / venue_id) with a
-- CHECK requiring exactly one set, matching this codebase's existing
-- multi-FK convention (see order_items) rather than a polymorphic FK.
-- ============================================================================

alter table public.hotels add column phone text;
alter table public.event_venues add column phone text;

create table public.property_links (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references public.hotels (id) on delete cascade,
  venue_id uuid references public.event_venues (id) on delete cascade,
  label text not null,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint property_links_one_parent check (num_nonnulls(hotel_id, venue_id) = 1)
);

create index property_links_hotel_idx on public.property_links (hotel_id);
create index property_links_venue_idx on public.property_links (venue_id);

create table public.property_reviews (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references public.hotels (id) on delete cascade,
  venue_id uuid references public.event_venues (id) on delete cascade,
  -- Set when a real STS customer who actually booked leaves a review later;
  -- null for admin-entered/staff-verified testimonials.
  customer_id uuid references public.profiles (id),
  author_name text not null,
  rating smallint not null check (rating between 1 and 5),
  body text,
  source text not null default 'manual' check (source in ('manual', 'customer', 'imported')),
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_reviews_one_parent check (num_nonnulls(hotel_id, venue_id) = 1)
);

create index property_reviews_hotel_idx on public.property_reviews (hotel_id);
create index property_reviews_venue_idx on public.property_reviews (venue_id);

create trigger set_property_reviews_updated_at
  before update on public.property_reviews
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Seed: official website for every hotel/venue that matched the client's
-- list by exact name. Everything else in the seed is untouched.
-- ----------------------------------------------------------------------------
insert into public.property_links (hotel_id, label, url)
select id, 'Website', v.url
from public.hotels h
join (values
  ('The Palms Hotel', 'https://thepalmshotel.so/'),
  ('Décale Hotel', 'https://decalehotels.com/'),
  ('Jazeera Palace Hotel', 'https://jazeerapalace.com/'),
  ('Sahafi Hotel', 'https://www.uniqhotels.com/sahafi-hotel-mogadishu/'),
  ('Holiday Hotel', 'http://www.holidayhotel.so/'),
  ('Afrik Hotel & Restaurant', 'https://afrikhotel.so/'),
  ('Hotel Shamo', 'https://www.shaamohotel.com/'),
  ('Peace Hotel', 'https://www.peacehotelsom.com/'),
  ('Serene Sarovar Premiere Hargeisa', 'https://www.sarovarhotels.com/'),
  ('Ambassador Hotel Hargeisa', 'https://www.ambassadorhotelhargeisa.com/'),
  ('Jees Hotel', 'https://jeeshotel.com/'),
  ('Damal Hotel', 'https://www.damalhotel.com/'),
  ('Assod Hotel', 'https://assod-hotel.com/'),
  ('Maan-Soor Hotel', 'https://maan-soor.com/'),
  ('Maamuus Hotel', 'https://maamuushotel.com/'),
  ('Carro Edeg Hotel', 'https://carroedeghotels.com/'),
  ('Hayat Hotel', 'https://hayathotelsomaliland.com/'),
  ('Beder Hotel', 'https://www.bederhotel.com/'),
  ('White Horse Hotel & Apartments', 'https://hotelwhitehorse.com/'),
  ('Ali Jirde Hotel', 'https://alijirdehotel.com/'),
  ('Martisoor Hotel', 'https://martisoorhotel.com/accommodations/'),
  ('Nugaal Hotel', 'https://nugalhotel.com/'),
  ('Maaris Hotel', 'https://maarishotel.so/')
) as v(name, url) on v.name = h.name;

insert into public.property_links (venue_id, label, url)
select id, 'Website', v.url
from public.event_venues ev
join (values
  ('Green Paradise Hotel', 'https://www.greenparadisehotel.so/'),
  ('Amara Hotel Mogadishu', 'https://amarahotel.so/'),
  ('The Villas Event Hall', 'https://www.thevillashotels.com/'),
  ('GuryaSamo Halls', 'https://guryosamo.so/'),
  ('Karmel Halls Restaurant', 'https://karmelrestaurant.blogspot.com/'),
  ('City Center Hotel', 'https://www.citycenterhotelhargeisa.com/'),
  ('The Palms Hotel', 'https://www.thepalmshotel.so/'),
  ('Décalé Hotel', 'https://decalehotels.com/'),
  ('Jazeera Palace Hotel', 'https://jazeerapalace.com/'),
  ('Holiday Hotel', 'http://www.holidayhotel.so/'),
  ('Afrik Hotel & Restaurant', 'https://afrikhotel.so/'),
  ('Serene Sarovar Premiere – Bander-Wanaag Hall', 'https://www.sarovarhotels.com/'),
  ('Serene Sarovar Premiere – Ramad Hall', 'https://www.sarovarhotels.com/'),
  ('Serene Sarovar Premiere – Meeting Rooms', 'https://www.sarovarhotels.com/'),
  ('Ambassador Hotel Hargeisa', 'https://www.ambassadorhotelhargeisa.com/'),
  ('Jees Hotel', 'https://jeeshotel.com/'),
  ('Hayat Hotel', 'https://hayathotelsomaliland.com/'),
  ('Ali Jirde Hotel / Galbis Hall', 'https://alijirdehotel.com/'),
  ('Martisoor Hotel', 'https://martisoorhotel.com/accommodations/')
) as v(name, url) on v.name = ev.name;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.property_links enable row level security;
alter table public.property_reviews enable row level security;

create policy "property_links: public reads for published properties"
  on public.property_links for select to anon, authenticated
  using (
    (hotel_id is not null and exists (select 1 from public.hotels h where h.id = hotel_id and h.status = 'published'))
    or (venue_id is not null and exists (select 1 from public.event_venues v where v.id = venue_id and v.status = 'published'))
  );

create policy "property_links: hotel partner manages own"
  on public.property_links for all to authenticated
  using (hotel_id is not null and exists (select 1 from public.hotels h where h.id = hotel_id and public.is_hotel_partner_member(h.partner_id)))
  with check (hotel_id is not null and exists (select 1 from public.hotels h where h.id = hotel_id and public.is_hotel_partner_member(h.partner_id)));

create policy "property_links: venue partner manages own"
  on public.property_links for all to authenticated
  using (venue_id is not null and exists (select 1 from public.event_venues v where v.id = venue_id and public.is_venue_partner_member(v.partner_id)))
  with check (venue_id is not null and exists (select 1 from public.event_venues v where v.id = venue_id and public.is_venue_partner_member(v.partner_id)));

create policy "property_links: admin manage"
  on public.property_links for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Reviews: public only ever sees published rows. Writing is admin-only —
-- partners are deliberately excluded (a partner shouldn't be able to author
-- their own good reviews).
create policy "property_reviews: public reads published for published properties"
  on public.property_reviews for select to anon, authenticated
  using (
    status = 'published'
    and (
      (hotel_id is not null and exists (select 1 from public.hotels h where h.id = hotel_id and h.status = 'published'))
      or (venue_id is not null and exists (select 1 from public.event_venues v where v.id = venue_id and v.status = 'published'))
    )
  );

create policy "property_reviews: admin manage"
  on public.property_reviews for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
