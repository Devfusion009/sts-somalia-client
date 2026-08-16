-- ============================================================================
-- Manual Somalia inventory + per-person hall pricing
--
-- Client brief (2026-08-17):
--  * Halls price PER PERSON: each venue sets its own rate, the customer enters
--    a guest count, the system shows estimated total = rate x guests, and the
--    venue/STS confirms the FINAL price before the booking completes.
--  * 50 Somali hotels join as MANUAL BOOKING inventory: no live API, a booking
--    is a request (pending) until STS confirms it — never shown as instantly
--    bookable. Later, individual hotels can flip to instant/API mode without
--    a redesign, hence a per-hotel booking_mode instead of a global flag.
--  * base_price = 0 means "price on request" — the client supplies real
--    prices, photos, capacity and facilities later.
-- ============================================================================

-- price_unit is a CHECK constraint (not an enum), so extending it works in
-- the same transaction as the seeds below — no ALTER TYPE ADD VALUE split.
alter table public.event_venues
  drop constraint event_venues_price_unit_check;
alter table public.event_venues
  add constraint event_venues_price_unit_check
  check (price_unit in ('per_event', 'per_day', 'per_hour', 'per_person'));

-- STS-managed catalog hotels have no owning partner — the same pattern
-- event_venues.partner_id already uses (nullable, admin-managed). Every
-- partner RLS policy goes through is_hotel_partner_member(partner_id), which
-- is simply false for null, so unowned rows are admin-only to manage and
-- public to read once published.
alter table public.hotels
  alter column partner_id drop not null;

-- 'manual': booking is a request a human confirms; payment only after
-- confirmation. 'instant': live availability, pay at checkout (future API
-- hotels). Everything existing is manual today — Somali hotels have no APIs.
alter table public.hotels
  add column booking_mode text not null default 'manual'
  check (booking_mode in ('manual', 'instant'));

-- ----------------------------------------------------------------------------
-- Events & Halls: initial Somalia venue inventory (32 venues)
-- Prices/photos/capacity to follow from the client — seeded as per-person,
-- price-on-request, published so they browse immediately.
-- ----------------------------------------------------------------------------
insert into public.event_venues
  (name, slug, tagline, city, address, event_types, base_price, currency, price_unit, status)
values
  -- Mogadishu
  ('Urban Space Mogadishu', 'urban-space-mogadishu', 'Weddings, conferences & events', 'Mogadishu', 'KM5, Wadada Masarida', '["wedding","conference","corporate_event"]', 0, 'USD', 'per_person', 'published'),
  ('Sahal Hall', 'sahal-hall', 'Events, weddings & gatherings', 'Mogadishu', 'KM4, agagaarka Garoonka Diyaaradaha', '["wedding","community_event"]', 0, 'USD', 'per_person', 'published'),
  ('Armaan Hall', 'armaan-hall', 'Weddings & events', 'Mogadishu', 'Hodan, agagaarka Digfer Hospital', '["wedding","community_event"]', 0, 'USD', 'per_person', 'published'),
  ('Istanbul Restaurant & Event Halls', 'istanbul-restaurant-event-halls', 'Weddings, parties & events', 'Mogadishu', 'Digfer Road', '["wedding","birthday","community_event"]', 0, 'USD', 'per_person', 'published'),
  ('Karmel Halls Restaurant', 'karmel-halls-restaurant', 'Weddings, celebrations & events', 'Mogadishu', 'KM4', '["wedding","community_event"]', 0, 'USD', 'per_person', 'published'),
  ('GuryaSamo Halls', 'guryasamo-halls', 'Weddings, celebrations & events', 'Mogadishu', 'Mogadishu', '["wedding","community_event"]', 0, 'USD', 'per_person', 'published'),
  ('The Villas Event Hall', 'the-villas-event-hall', 'Weddings, private parties, conferences & NGO events', 'Mogadishu', 'The Villas compound, near Aden Adde Airport', '["wedding","conference","ngo_summit","birthday"]', 0, 'USD', 'per_person', 'published'),
  ('The Palms Hotel', 'the-palms-hotel', 'Conferences, meetings, workshops & corporate events', 'Mogadishu', 'AAIA Zone, next to airport runway', '["conference","seminar","training","corporate_event"]', 0, 'USD', 'per_person', 'published'),
  ('Amara Hotel Mogadishu', 'amara-hotel-mogadishu', 'Conferences, meetings & events', 'Mogadishu', 'Marina Gate Road, Aden Adde Airport area', '["conference","corporate_event"]', 0, 'USD', 'per_person', 'published'),
  ('Décalé Hotel', 'decale-hotel', 'Conferences, business meetings & events', 'Mogadishu', 'Wadada Jazeera, near Aden Adde Airport', '["conference","corporate_event"]', 0, 'USD', 'per_person', 'published'),
  ('Afrik Hotel & Restaurant', 'afrik-hotel-restaurant', 'Meetings, seminars, workshops & weddings', 'Mogadishu', 'Mogadishu', '["seminar","training","wedding"]', 0, 'USD', 'per_person', 'published'),
  ('Holiday Hotel', 'holiday-hotel', 'Conferences, events & meetings', 'Mogadishu', 'KM4', '["conference","corporate_event"]', 0, 'USD', 'per_person', 'published'),
  ('City Star Hotel', 'city-star-hotel', 'Weddings, conferences, private functions & meetings', 'Mogadishu', 'Mogadishu', '["wedding","conference","corporate_event"]', 0, 'USD', 'per_person', 'published'),
  ('Jazeera Palace Hotel', 'jazeera-palace-hotel', 'Conferences, meetings & events', 'Mogadishu', 'Mogadishu', '["conference","corporate_event"]', 0, 'USD', 'per_person', 'published'),
  ('Green Paradise Hotel', 'green-paradise-hotel', 'Banquets & events', 'Mogadishu', 'Mogadishu', '["gala_dinner","community_event"]', 0, 'USD', 'per_person', 'published'),
  ('Java Coffee Garden – Taleex', 'java-coffee-garden-taleex', 'Weddings, banquets, birthdays & training', 'Mogadishu', 'Taleex, KM4, next to Istanbul Hotel', '["wedding","gala_dinner","birthday","training"]', 0, 'USD', 'per_person', 'published'),
  ('Shariif Saalah Theater Hall', 'shariif-saalah-theater-hall', 'Conferences, training, meetings & ceremonies', 'Mogadishu', 'Mogadishu', '["conference","training","graduation"]', 0, 'USD', 'per_person', 'published'),
  ('DREAMS-INN', 'dreams-inn', 'Weddings & events', 'Mogadishu', 'Jalle Siyaad Road', '["wedding","community_event"]', 0, 'USD', 'per_person', 'published'),
  ('City Gate Halls & Apartments', 'city-gate-halls-apartments', 'Weddings, gatherings & events', 'Mogadishu', 'Ex-Control Afgooye', '["wedding","community_event"]', 0, 'USD', 'per_person', 'published'),
  ('Summer Halls', 'summer-halls', 'Weddings & events', 'Mogadishu', 'Mogadishu', '["wedding","community_event"]', 0, 'USD', 'per_person', 'published'),
  ('Hirey Kasim Halls', 'hirey-kasim-halls', 'Weddings, celebrations & gatherings', 'Mogadishu', 'Mogadishu', '["wedding","community_event"]', 0, 'USD', 'per_person', 'published'),
  -- Hargeisa
  ('Ambassador Hotel Hargeisa', 'ambassador-hotel-hargeisa', 'Conferences, government events, corporate gatherings & meetings', 'Hargeisa', 'Hargeisa', '["conference","corporate_event","ngo_summit"]', 0, 'USD', 'per_person', 'published'),
  ('Serene Sarovar Premiere – Bander-Wanaag Hall', 'serene-sarovar-bander-wanaag-hall', 'Weddings, large events, conferences & receptions', 'Hargeisa', 'East Masala', '["wedding","conference","gala_dinner"]', 0, 'USD', 'per_person', 'published'),
  ('Serene Sarovar Premiere – Ramad Hall', 'serene-sarovar-ramad-hall', 'Workshops, training, presentations & private events', 'Hargeisa', 'East Masala', '["training","seminar","corporate_event"]', 0, 'USD', 'per_person', 'published'),
  ('Serene Sarovar Premiere – Meeting Rooms', 'serene-sarovar-meeting-rooms', 'Business meetings & executive gatherings', 'Hargeisa', 'East Masala', '["corporate_event","seminar"]', 0, 'USD', 'per_person', 'published'),
  ('City Center Hotel', 'city-center-hotel', 'Weddings, meetings & events', 'Hargeisa', 'Downtown Hargeisa', '["wedding","corporate_event"]', 0, 'USD', 'per_person', 'published'),
  ('Hayat Hotel', 'hayat-hotel-hargeisa', 'Conferences, seminars, meetings & social events', 'Hargeisa', 'Hargeisa city center', '["conference","seminar","community_event"]', 0, 'USD', 'per_person', 'published'),
  ('Ali Jirde Hotel / Galbis Hall', 'ali-jirde-galbis-hall', 'Weddings, conferences, business & social events', 'Hargeisa', 'Hargeisa', '["wedding","conference","corporate_event"]', 0, 'USD', 'per_person', 'published'),
  ('Rayid Hotel & Restaurant', 'rayid-hotel-restaurant', 'Wedding hall & conference hall', 'Hargeisa', 'Warancade, New Hargeisa', '["wedding","conference"]', 0, 'USD', 'per_person', 'published'),
  ('Jees Hotel', 'jees-hotel-hargeisa', 'Events & banquets', 'Hargeisa', 'Hargeisa', '["gala_dinner","community_event"]', 0, 'USD', 'per_person', 'published'),
  -- Garowe
  ('Martisoor Hotel', 'martisoor-hotel', 'Conferences, workshops, seminars & banquets', 'Garowe', 'State House Road / Jidka Wasaaradaha', '["conference","seminar","training","gala_dinner"]', 0, 'USD', 'per_person', 'published'),
  ('DOOKH Theater', 'dookh-theater', 'Conferences, screenings, performances & cultural events', 'Garowe', 'Meeraysane Road', '["conference","community_event","corporate_event"]', 0, 'USD', 'per_person', 'published')
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- Hotels: initial Somalia manual-booking inventory (50 hotels)
-- Unowned (partner_id null), manual mode, published. Star tiers from the
-- client's list: Premium -> 5, 4* -> 4, 3* -> 3, 2* -> 2, Standard -> null.
-- ----------------------------------------------------------------------------
insert into public.hotels
  (name, slug, city, country_code, address_line, star_rating, status, booking_mode, partner_id)
values
  -- Mogadishu
  ('Aven Premier International', 'aven-premier-international', 'Mogadishu', 'SO', 'Airport / AAIA area', 4, 'published', 'manual', null),
  ('The Palms Hotel', 'the-palms-hotel', 'Mogadishu', 'SO', 'AAIA Zone', 5, 'published', 'manual', null),
  ('Jazeera Palace Hotel', 'jazeera-palace-hotel', 'Mogadishu', 'SO', 'Airport Road', 5, 'published', 'manual', null),
  ('Décale Hotel', 'decale-hotel', 'Mogadishu', 'SO', 'Jazeera Road', 5, 'published', 'manual', null),
  ('Sahafi Hotel', 'sahafi-hotel', 'Mogadishu', 'SO', 'Mogadishu', 5, 'published', 'manual', null),
  ('City Star Hotel', 'city-star-hotel', 'Mogadishu', 'SO', 'Mogadishu', 4, 'published', 'manual', null),
  ('Amira Castle Hotel', 'amira-castle-hotel', 'Mogadishu', 'SO', 'Mogadishu', 5, 'published', 'manual', null),
  ('Afrik Hotel & Restaurant', 'afrik-hotel-restaurant', 'Mogadishu', 'SO', 'Mogadishu', 3, 'published', 'manual', null),
  ('Hotel Shamo', 'hotel-shamo', 'Mogadishu', 'SO', 'KM4', 3, 'published', 'manual', null),
  ('Ramada Hotel & Restaurant', 'ramada-hotel-restaurant', 'Mogadishu', 'SO', 'Mogadishu', 3, 'published', 'manual', null),
  ('Ocean Hotel', 'ocean-hotel', 'Mogadishu', 'SO', 'Airport area', 3, 'published', 'manual', null),
  ('Holiday Hotel', 'holiday-hotel', 'Mogadishu', 'SO', 'KM4', 3, 'published', 'manual', null),
  ('Muna Hotel', 'muna-hotel', 'Mogadishu', 'SO', 'Mogadishu', 3, 'published', 'manual', null),
  ('Safari Hotel', 'safari-hotel', 'Mogadishu', 'SO', 'Mogadishu', 3, 'published', 'manual', null),
  ('Peace Hotel', 'peace-hotel', 'Mogadishu', 'SO', 'Mogadishu', 2, 'published', 'manual', null),
  ('Oriental Hotel', 'oriental-hotel', 'Mogadishu', 'SO', 'Mogadishu', 2, 'published', 'manual', null),
  ('Hotel Guuleed', 'hotel-guuleed', 'Mogadishu', 'SO', 'Mogadishu', 2, 'published', 'manual', null),
  ('Hotel Taleex', 'hotel-taleex', 'Mogadishu', 'SO', 'Mogadishu', 2, 'published', 'manual', null),
  ('Hotel Towfiq', 'hotel-towfiq', 'Mogadishu', 'SO', 'Mogadishu', 2, 'published', 'manual', null),
  ('Benadir Hotel', 'benadir-hotel', 'Mogadishu', 'SO', 'Mogadishu', null, 'published', 'manual', null),
  -- Hargeisa
  ('Serene Sarovar Premiere Hargeisa', 'serene-sarovar-premiere-hargeisa', 'Hargeisa', 'SO', 'East Masala', 5, 'published', 'manual', null),
  ('Ambassador Hotel Hargeisa', 'ambassador-hotel-hargeisa', 'Hargeisa', 'SO', 'Hargeisa', 5, 'published', 'manual', null),
  ('Carro Edeg Hotel', 'carro-edeg-hotel', 'Hargeisa', 'SO', 'Hargeisa', 5, 'published', 'manual', null),
  ('Maamuus Hotel', 'maamuus-hotel', 'Hargeisa', 'SO', 'Hargeisa', 5, 'published', 'manual', null),
  ('Safari Hotel Hargeisa', 'safari-hotel-hargeisa', 'Hargeisa', 'SO', 'Hargeisa', 5, 'published', 'manual', null),
  ('Damal Hotel', 'damal-hotel', 'Hargeisa', 'SO', 'Waheen Highway', 3, 'published', 'manual', null),
  ('Maan-Soor Hotel', 'maan-soor-hotel', 'Hargeisa', 'SO', 'Hargeisa', 3, 'published', 'manual', null),
  ('Hayat Hotel', 'hayat-hotel', 'Hargeisa', 'SO', 'Airport Road', 3, 'published', 'manual', null),
  ('Beder Hotel', 'beder-hotel', 'Hargeisa', 'SO', 'Wadada Timacade', 3, 'published', 'manual', null),
  ('Diamond Hotel', 'diamond-hotel', 'Hargeisa', 'SO', 'Hargeisa', 3, 'published', 'manual', null),
  ('Jees Hotel', 'jees-hotel', 'Hargeisa', 'SO', 'Hargeisa', 3, 'published', 'manual', null),
  ('Assod Hotel', 'assod-hotel', 'Hargeisa', 'SO', 'Hargeisa', 3, 'published', 'manual', null),
  ('Bandare Hotel', 'bandare-hotel', 'Hargeisa', 'SO', 'Hargeisa', 3, 'published', 'manual', null),
  ('Egan Hotel Apartments', 'egan-hotel-apartments', 'Hargeisa', 'SO', 'Hargeisa', null, 'published', 'manual', null),
  ('Pride Hotel Apartments', 'pride-hotel-apartments', 'Hargeisa', 'SO', 'Hargeisa', null, 'published', 'manual', null),
  ('White Horse Hotel & Apartments', 'white-horse-hotel-apartments', 'Hargeisa', 'SO', 'Hargeisa', null, 'published', 'manual', null),
  ('Oriental Hotel Hargeisa', 'oriental-hotel-hargeisa', 'Hargeisa', 'SO', 'Hargeisa', 2, 'published', 'manual', null),
  ('Ali Jirde Hotel', 'ali-jirde-hotel', 'Hargeisa', 'SO', 'Hargeisa', 2, 'published', 'manual', null),
  ('Deero Hotel', 'deero-hotel', 'Hargeisa', 'SO', 'Hargeisa', 2, 'published', 'manual', null),
  ('Gulf Star Hotel Hargeisa', 'gulf-star-hotel-hargeisa', 'Hargeisa', 'SO', 'Hargeisa', 2, 'published', 'manual', null),
  -- Garowe
  ('Martisoor Hotel', 'martisoor-hotel', 'Garowe', 'SO', 'State House Road / Jidka Wasaaradaha', 5, 'published', 'manual', null),
  ('Dayax Hotel', 'dayax-hotel', 'Garowe', 'SO', 'Garowe', 5, 'published', 'manual', null),
  ('Dreampoint Hotel', 'dreampoint-hotel', 'Garowe', 'SO', 'Garowe', 3, 'published', 'manual', null),
  ('Nugaal Hotel', 'nugaal-hotel', 'Garowe', 'SO', 'Garowe', 3, 'published', 'manual', null),
  ('Emeral Hotel', 'emeral-hotel', 'Garowe', 'SO', 'Garowe', 3, 'published', 'manual', null),
  ('Maaris Hotel', 'maaris-hotel', 'Garowe', 'SO', 'Garowe', 3, 'published', 'manual', null),
  ('Eyl Beach Hotel', 'eyl-beach-hotel', 'Garowe', 'SO', 'Garowe', null, 'published', 'manual', null),
  ('Aaran Hotel', 'aaran-hotel', 'Garowe', 'SO', 'Garowe', 3, 'published', 'manual', null),
  ('Daawad Hotel', 'daawad-hotel', 'Garowe', 'SO', 'H. Wadaag Street', 2, 'published', 'manual', null),
  ('Hotel Meereysane', 'hotel-meereysane', 'Garowe', 'SO', 'Meereysane', 2, 'published', 'manual', null)
on conflict (slug) do nothing;

-- One bookable room per seeded hotel so the request flow works from day one.
-- base_price 0 = price on request; STS quotes the real price before
-- confirming (updateHotelBookingPrice). The client will replace these with
-- real room types and rates later.
insert into public.hotel_rooms (hotel_id, name, description, max_occupancy, base_price, currency, status)
select h.id, 'Standard Room', 'Room type and rate confirmed by STS when your booking request is processed.', 2, 0, 'USD', 'published'
from public.hotels h
where h.partner_id is null
  and h.booking_mode = 'manual'
  and not exists (select 1 from public.hotel_rooms r where r.hotel_id = h.id);
