-- Reference/catalog data for local development. Re-applied on every
-- `supabase db reset`. Deliberately avoids inserting auth.users rows —
-- create test accounts via the Studio Auth UI or supabase.auth.signUp()
-- instead, then use the service role to promote roles as needed.

insert into public.airports (iata_code, icao_code, name, city, country_code, timezone) values
  ('MGQ', 'HCMM', 'Aden Adde International Airport', 'Mogadishu', 'SO', 'Africa/Mogadishu'),
  ('HGA', 'HCMH', 'Hargeisa International Airport', 'Hargeisa', 'SO', 'Africa/Mogadishu'),
  ('BSA', 'HCMB', 'Bosaso International Airport', 'Bosaso', 'SO', 'Africa/Mogadishu'),
  ('DXB', 'OMDB', 'Dubai International Airport', 'Dubai', 'AE', 'Asia/Dubai'),
  ('IST', 'LTFM', 'Istanbul Airport', 'Istanbul', 'TR', 'Europe/Istanbul'),
  ('NBO', 'HKJK', 'Jomo Kenyatta International Airport', 'Nairobi', 'KE', 'Africa/Nairobi'),
  ('ADD', 'HAAB', 'Addis Ababa Bole International Airport', 'Addis Ababa', 'ET', 'Africa/Addis_Ababa'),
  ('CAI', 'HECA', 'Cairo International Airport', 'Cairo', 'EG', 'Africa/Cairo'),
  ('DOH', 'OTHH', 'Hamad International Airport', 'Doha', 'QA', 'Asia/Qatar'),
  ('KUL', 'WMKK', 'Kuala Lumpur International Airport', 'Kuala Lumpur', 'MY', 'Asia/Kuala_Lumpur'),
  ('JED', 'OEJN', 'King Abdulaziz International Airport', 'Jeddah', 'SA', 'Asia/Riyadh'),
  ('MED', 'OEMA', 'Prince Mohammad Bin Abdulaziz Airport', 'Medina', 'SA', 'Asia/Riyadh')
on conflict (iata_code) do nothing;

insert into public.airlines (iata_code, icao_code, name) values
  ('TK', 'THY', 'Turkish Airlines'),
  ('EK', 'UAE', 'Emirates'),
  ('QR', 'QTR', 'Qatar Airways'),
  ('ET', 'ETH', 'Ethiopian Airlines'),
  ('SV', 'SVA', 'Saudia'),
  ('KQ', 'KQA', 'Kenya Airways'),
  ('FZ', 'FDB', 'flydubai')
on conflict (iata_code) do nothing;

-- ----------------------------------------------------------------------------
-- Visa catalog. required_documents drives the wizard's Document Upload step:
-- {key, label, description, required, max_mb}.
-- ----------------------------------------------------------------------------
insert into public.visa_types
  (destination_country_code, name, description, visa_category, entry_type, validity_days, stay_days,
   processing_days_min, processing_days_max, price, currency, is_featured, overview, required_documents, status)
values
  ('AE', 'Tourist Visit Visa – Single Entry', '30-day single entry tourist visa for the UAE',
   'tourist', 'single', 30, 30, 3, 5, 85.00, 'USD', true,
   'Explore Dubai, Abu Dhabi and the Emirates with a straightforward single-entry tourist visa. STS handles submission and follow-up with the UAE immigration authority end to end.',
   '[{"key":"passport_bio","label":"Passport Bio Page","description":"Color copy of passport bio page","required":true,"max_mb":5},
     {"key":"photo","label":"Passport Size Photo","description":"Recent passport size photo with white background","required":true,"max_mb":2},
     {"key":"flight_itinerary","label":"Flight Itinerary","description":"Confirmed flight ticket or itinerary","required":true,"max_mb":5},
     {"key":"hotel_booking","label":"Hotel Booking / Accommodation","description":"Confirmed hotel booking or accommodation proof","required":true,"max_mb":5},
     {"key":"travel_insurance","label":"Travel Insurance","description":"Valid travel insurance document","required":false,"max_mb":5},
     {"key":"additional","label":"Additional Document","description":"Other supporting documents","required":false,"max_mb":5}]',
   'published'),
  ('AE', 'Tourist Visit Visa – Multiple Entry', '60-day multiple entry visit visa for the UAE',
   'tourist', 'multiple', 60, 60, 4, 7, 165.00, 'USD', false,
   'Enter the UAE as often as you need within 60 days — ideal for business trips combined with family visits.',
   '[{"key":"passport_bio","label":"Passport Bio Page","description":"Color copy of passport bio page","required":true,"max_mb":5},
     {"key":"photo","label":"Passport Size Photo","description":"Recent passport size photo with white background","required":true,"max_mb":2},
     {"key":"flight_itinerary","label":"Flight Itinerary","description":"Confirmed flight ticket or itinerary","required":true,"max_mb":5},
     {"key":"hotel_booking","label":"Hotel Booking / Accommodation","description":"Confirmed hotel booking or accommodation proof","required":true,"max_mb":5},
     {"key":"bank_statement","label":"Bank Statement (Last 3 Months)","description":"Recent bank statement","required":false,"max_mb":5}]',
   'published'),
  ('TR', 'Turkey e-Visa', 'Single entry e-Visa for Turkey, 30-day stay',
   'tourist', 'single', 180, 30, 1, 3, 60.00, 'USD', true,
   'Fast electronic visa for Turkey — most applications are decided within 72 hours.',
   '[{"key":"passport_bio","label":"Passport Bio Page","description":"Color copy of passport bio page","required":true,"max_mb":5},
     {"key":"photo","label":"Passport Size Photo","description":"Recent passport size photo with white background","required":true,"max_mb":2}]',
   'published'),
  ('SA', 'Umrah Visa', 'Umrah pilgrimage visa for Saudi Arabia',
   'umrah', 'single', 90, 30, 5, 10, 150.00, 'USD', true,
   'Dedicated Umrah visa processing with vaccination checks and Saudi platform registration handled by our team.',
   '[{"key":"passport_bio","label":"Passport Bio Page","description":"Color copy of passport bio page","required":true,"max_mb":5},
     {"key":"photo","label":"Passport Size Photo","description":"Recent passport size photo with white background","required":true,"max_mb":2},
     {"key":"vaccination_certificate","label":"Vaccination Certificate","description":"Meningitis (ACWY) vaccination certificate","required":true,"max_mb":5},
     {"key":"mahram_proof","label":"Mahram Relationship Proof","description":"Required for women travelling with a mahram","required":false,"max_mb":5}]',
   'published'),
  ('KE', 'Kenya eTA', 'Electronic Travel Authorisation for Kenya, 90-day validity',
   'tourist', 'single', 90, 60, 2, 4, 55.00, 'USD', true,
   'Electronic Travel Authorisation for Kenya — required for all visitors before departure.',
   '[{"key":"passport_bio","label":"Passport Bio Page","description":"Color copy of passport bio page","required":true,"max_mb":5},
     {"key":"photo","label":"Passport Size Photo","description":"Recent passport size photo with white background","required":true,"max_mb":2},
     {"key":"flight_itinerary","label":"Flight Itinerary","description":"Confirmed return ticket","required":true,"max_mb":5},
     {"key":"hotel_booking","label":"Accommodation Proof","description":"Hotel booking or host invitation","required":true,"max_mb":5}]',
   'published'),
  ('ET', 'Ethiopia e-Visa', 'Single entry tourist e-Visa for Ethiopia, 30-day stay',
   'tourist', 'single', 90, 30, 1, 3, 52.00, 'USD', true,
   'Quick online visa for Ethiopia — approved copies delivered straight to your STS account.',
   '[{"key":"passport_bio","label":"Passport Bio Page","description":"Color copy of passport bio page","required":true,"max_mb":5},
     {"key":"photo","label":"Passport Size Photo","description":"Recent passport size photo with white background","required":true,"max_mb":2}]',
   'published'),
  ('EG', 'Egypt Tourist Visa', 'Single entry tourist visa for Egypt, 30-day stay',
   'tourist', 'single', 90, 30, 5, 8, 70.00, 'USD', true,
   'Tourist visa for Egypt with document review by our specialists before submission.',
   '[{"key":"passport_bio","label":"Passport Bio Page","description":"Color copy of passport bio page","required":true,"max_mb":5},
     {"key":"photo","label":"Passport Size Photo","description":"Recent passport size photo with white background","required":true,"max_mb":2},
     {"key":"flight_itinerary","label":"Flight Itinerary","description":"Confirmed flight ticket or itinerary","required":true,"max_mb":5},
     {"key":"bank_statement","label":"Bank Statement (Last 3 Months)","description":"Recent bank statement","required":true,"max_mb":5}]',
   'published'),
  ('MY', 'Malaysia eVisa', 'Single entry eVisa for Malaysia, 30-day stay',
   'tourist', 'single', 90, 30, 3, 7, 95.00, 'USD', true,
   'Malaysia eVisa processing including appointment-free online submission.',
   '[{"key":"passport_bio","label":"Passport Bio Page","description":"Color copy of passport bio page","required":true,"max_mb":5},
     {"key":"photo","label":"Passport Size Photo","description":"Recent passport size photo with white background","required":true,"max_mb":2},
     {"key":"flight_itinerary","label":"Flight Itinerary","description":"Confirmed return ticket","required":true,"max_mb":5},
     {"key":"hotel_booking","label":"Hotel Booking","description":"Confirmed hotel booking for the stay","required":true,"max_mb":5}]',
   'published');

-- ----------------------------------------------------------------------------
-- Demo hotel partner + hotels + rooms
-- ----------------------------------------------------------------------------
with partner as (
  insert into public.hotel_partners (name, contact_email, status)
  values ('Banadir Hospitality Group', 'partners@banadirhospitality.example', 'active')
  returning id
),
hotel as (
  insert into public.hotels (id, partner_id, name, slug, description, star_rating, city, country_code,
                             address_line, latitude, longitude, amenities, images, status)
  select 'a5555555-5555-4555-8555-555555555555', id, 'Mogadishu Beach Hotel', 'mogadishu-beach-hotel',
         'Seafront hotel on Lido Beach with conference facilities, sea-view rooms, and an in-house restaurant.',
         4, 'Mogadishu', 'SO',
         'Lido Beach Road, Abdiaziz District', 2.0469, 45.3182,
         '["free_wifi","24h_reception","restaurant","sea_view","private_beach","free_parking","generator_backup","24h_security","airport_shuttle","family_rooms"]',
         '["a5555555-5555-4555-8555-555555555555/beach-hotel-terrace.webp","a5555555-5555-4555-8555-555555555555/beach-hotel-seaview-room.webp"]',
         'published'::public.listing_status
  from partner
  returning id
)
insert into public.hotel_rooms (hotel_id, name, description, max_occupancy, base_price, currency, status, total_units)
select id, 'Deluxe Double Room', 'Double room with sea view, air conditioning, and workspace.', 2, 120.00, 'USD', 'published'::public.listing_status, 5 from hotel
union all
select id, 'Executive Suite', 'Suite with separate living area and panoramic ocean views.', 3, 220.00, 'USD', 'published'::public.listing_status, 5 from hotel
union all
select id, 'Standard Twin Room', 'Comfortable twin room ideal for colleagues or friends.', 2, 95.00, 'USD', 'published'::public.listing_status, 5 from hotel;

with partner2 as (
  insert into public.hotel_partners (name, contact_email, status)
  values ('Hargeisa Hosts Ltd', 'stay@hargeisahosts.example', 'active')
  returning id
),
hotel2 as (
  insert into public.hotels (id, partner_id, name, slug, description, star_rating, city, country_code,
                             address_line, latitude, longitude, amenities, images, status)
  select 'a6666666-6666-4666-8666-666666666666', id, 'Hargeisa Grand Hotel', 'hargeisa-grand-hotel',
         'Modern business hotel in central Hargeisa with meeting rooms and airport shuttle.',
         3, 'Hargeisa', 'SO',
         'Airport Road, Ahmed Dhagah District', 9.5624, 44.0770,
         '["free_wifi","24h_reception","restaurant","free_parking","generator_backup","24h_security","airport_shuttle","meeting_rooms"]',
         '["a6666666-6666-4666-8666-666666666666/hargeisa-grand-exterior.webp","a6666666-6666-4666-8666-666666666666/hargeisa-grand-room.webp"]',
         'published'::public.listing_status
  from partner2
  returning id
)
insert into public.hotel_rooms (hotel_id, name, description, max_occupancy, base_price, currency, status, total_units)
select id, 'Classic Queen Room', 'Queen bed, breakfast included.', 2, 75.00, 'USD', 'published'::public.listing_status, 5 from hotel2
union all
select id, 'Family Quadruple Room', 'Two double beds, city views — great for families.', 4, 130.00, 'USD', 'published'::public.listing_status, 5 from hotel2;


-- ----------------------------------------------------------------------------
-- Premium hotel inventory.
--
-- These four rows previously existed only in the local database — they were
-- inserted ad hoc and never written back to a file, so `supabase db reset`
-- would have destroyed them and their rooms with no way to recover. Captured
-- here with the same fixed ids their Storage keys are built from.
-- ----------------------------------------------------------------------------

with h as (
  insert into public.hotels (id, partner_id, name, slug, description, star_rating, city, country_code,
                             address_line, latitude, longitude, amenities, images, status)
  select 'a3333333-3333-4333-8333-333333333333',
         (select id from public.hotel_partners where name = 'Banadir Hospitality Group'),
         'Berbera Pearl Resort', 'berbera-pearl-resort',
         'A Red Sea hideaway on the Berbera coast, built around a vaulted stone thermal spa and a candlelit seafront terrace. Diving and dhow excursions are arranged in-house, and the kitchen specialises in the day''s catch.',
         5, 'Berbera', 'SO',
         'Corniche Road, Berbera', 10.434, 45.0143,
         '["private_beach", "spa", "fine_dining", "sea_view", "free_wifi", "airport_shuttle", "generator_backup", "diving_centre", "breakfast_included"]',
         '["a3333333-3333-4333-8333-333333333333/dining-terrace.webp", "a3333333-3333-4333-8333-333333333333/spa-pool.webp"]',
         'published'::public.listing_status
  returning id
)
insert into public.hotel_rooms (hotel_id, name, description, max_occupancy, base_price, currency, status, total_units)
select id, 'Garden Villa', 'Standalone villa opening onto the palm garden.', 3, 130.00, 'USD', 'published'::public.listing_status, 5 from h union all
select id, 'Pearl Sea Suite', 'Top-floor suite with a private plunge pool facing the sea.', 2, 295.00, 'USD', 'published'::public.listing_status, 5 from h;

with h as (
  insert into public.hotels (id, partner_id, name, slug, description, star_rating, city, country_code,
                             address_line, latitude, longitude, amenities, images, status)
  select 'a4444444-4444-4444-8444-444444444444',
         (select id from public.hotel_partners where name = 'Banadir Hospitality Group'),
         'Hargeisa Highland Suites', 'hargeisa-highland-suites',
         'An all-suite hotel in central Hargeisa with a marble atrium lobby and generously sized family suites. A ten-minute drive from Egal International Airport, with a dedicated desk for Umrah and diaspora groups.',
         5, 'Hargeisa', 'SO',
         'Independence Avenue, Hargeisa', 9.56, 44.065,
         '["all_suites", "family_rooms", "free_wifi", "airport_shuttle", "generator_backup", "restaurant", "meeting_rooms", "free_parking", "24h_reception", "breakfast_included"]',
         '["a4444444-4444-4444-8444-444444444444/grand-lobby.webp", "a4444444-4444-4444-8444-444444444444/presidential-suite.webp"]',
         'published'::public.listing_status
  returning id
)
insert into public.hotel_rooms (hotel_id, name, description, max_occupancy, base_price, currency, status, total_units)
select id, 'Highland Suite', 'One-bedroom suite with kitchenette and sitting room.', 3, 95.00, 'USD', 'published'::public.listing_status, 5 from h union all
select id, 'Family Suite', 'Two bedrooms sharing a lounge — sleeps five.', 5, 160.00, 'USD', 'published'::public.listing_status, 5 from h;

with h as (
  insert into public.hotels (id, partner_id, name, slug, description, star_rating, city, country_code,
                             address_line, latitude, longitude, amenities, images, status)
  select 'a1111111-1111-4111-8111-111111111111',
         (select id from public.hotel_partners where name = 'Banadir Hospitality Group'),
         'Liido Beach Resort & Spa', 'liido-beach-resort-and-spa',
         'A five-star oceanfront retreat on Liido Beach with a cliff-edge infinity pool, a full thermal spa and three restaurants. Every suite opens onto a private balcony facing the Indian Ocean, and airport transfers are included on all bookings.',
         5, 'Mogadishu', 'SO',
         'Liido Beach Road, Abdiaziz District', 2.0281, 45.276,
         '["sea_view", "infinity_pool", "spa", "fine_dining", "free_wifi", "airport_shuttle", "generator_backup", "24h_security", "gym", "breakfast_included"]',
         '["a1111111-1111-4111-8111-111111111111/resort-exterior.webp", "a1111111-1111-4111-8111-111111111111/rooftop-pool.webp"]',
         'published'::public.listing_status
  returning id
)
insert into public.hotel_rooms (hotel_id, name, description, max_occupancy, base_price, currency, status, total_units)
select id, 'Ocean Deluxe Room', 'Balcony facing the Indian Ocean, king bed, rain shower.', 2, 145.00, 'USD', 'published'::public.listing_status, 5 from h union all
select id, 'Beachfront Suite', 'Separate living room and a wraparound terrace above the pool deck.', 4, 265.00, 'USD', 'published'::public.listing_status, 5 from h;

with h as (
  insert into public.hotels (id, partner_id, name, slug, description, star_rating, city, country_code,
                             address_line, latitude, longitude, amenities, images, status)
  select 'a2222222-2222-4222-8222-222222222222',
         (select id from public.hotel_partners where name = 'Banadir Hospitality Group'),
         'Shabelle Executive Tower', 'shabelle-executive-tower',
         'Mogadishu''s tallest business hotel, built for executives and delegations. Floors 12 to 18 form a private executive lounge with skyline views, and the conference centre seats 300 with simultaneous-translation booths.',
         5, 'Mogadishu', 'SO',
         'Maka Al Mukarama Road, Hodan District', 2.0392, 45.34,
         '["executive_lounge", "meeting_rooms", "business_centre", "free_wifi", "airport_shuttle", "generator_backup", "gym", "restaurant", "24h_reception", "free_parking"]',
         '["a2222222-2222-4222-8222-222222222222/tower-night.webp", "a2222222-2222-4222-8222-222222222222/exec-lounge.webp"]',
         'published'::public.listing_status
  returning id
)
insert into public.hotel_rooms (hotel_id, name, description, max_occupancy, base_price, currency, status, total_units)
select id, 'Executive King', 'High-floor room with desk, lounge access and skyline views.', 2, 120.00, 'USD', 'published'::public.listing_status, 5 from h union all
select id, 'Diplomatic Suite', 'Corner suite with a private meeting table for six.', 3, 240.00, 'USD', 'published'::public.listing_status, 5 from h;

-- ----------------------------------------------------------------------------
-- Umrah packages
--
-- Nine packages across four tiers, shaped by how Somali and Somaliland
-- operators actually sell Umrah: 7 / 10 / 12 / 14 / 15 / 21-day durations,
-- departures from both Mogadishu and Hargeisa, and sacred-month pricing for
-- Rajab and Ramadan. Prices sit above the ~USD 968 Mogadishu-Jeddah return
-- airfare, so no package is quoted below the cost of its own flight.
--
-- image paths point at repo-committed assets under public/umrah/ rather than
-- the umrah-images bucket: this is marketing photography that has to exist in
-- every environment and survive a db reset, which seeded Storage objects would
-- not. umrahImageUrl() passes root-relative paths straight through.
--
-- is_featured drives BOTH the landing band's ordering and the "Most Popular"
-- badge on the card, so exactly one package carries it.
-- ----------------------------------------------------------------------------

with pk1 as (
  insert into public.umrah_packages
    (id, name, slug, description, tagline, tier, is_featured, duration_days, includes,
     base_price, currency, status, images, origin_iata, destination_iata)
  values ('b1111111-1111-4111-8111-111111111111',
    '7-Day Express Umrah', '7-day-express-umrah',
    'The shortest complete Umrah we run: return flights from Mogadishu, five nights split between Makkah and Madinah, visa processing, and airport and inter-city transfers. Built for working pilgrims who cannot take a fortnight away.',
    'One week, start to finish — for pilgrims who can''t take long off work.', 'economy', false, 7,
    '["flights", "visa", "hotel", "transport"]', 1180.00, 'USD', 'published',
    '["b1111111-1111-4111-8111-111111111111/departure-gate.webp", "b1111111-1111-4111-8111-111111111111/mosque-courtyard-day.webp", "b1111111-1111-4111-8111-111111111111/prayer-hall.webp"]',
    'MGQ', 'JED')
  returning id
), pk1d as (
  insert into public.umrah_package_departures (package_id, departure_date, return_date, total_seats, booked_seats)
  select id, current_date + 21, current_date + 28, 45, 38 from pk1
)
insert into public.umrah_package_hotels (package_id, city, name, star_rating, distance_to_haram_m, nights, room_type, sort_order)
select id, 'makkah', 'Al Masa Hotel', 3, 800, 3, 'Quad sharing', 0 from pk1
union all
select id, 'madinah', 'Al Ansar Golden', 3, 700, 2, 'Quad sharing', 1 from pk1;

with pk2 as (
  insert into public.umrah_packages
    (id, name, slug, description, tagline, tier, is_featured, duration_days, includes,
     base_price, currency, status, images, origin_iata, destination_iata)
  values ('b2222222-2222-4222-8222-222222222222',
    '10-Day Economy Umrah', '10-day-economy-umrah',
    'Flights from Mogadishu, 3-star hotels within walking distance of the Haram, visa processing, and ground transport.',
    'The essentials, done properly — for first-time pilgrims.', 'economy', false, 10,
    '["flights", "visa", "hotel", "transport"]', 1250.00, 'USD', 'published',
    '["b2222222-2222-4222-8222-222222222222/pilgrims-courtyard.webp", "b2222222-2222-4222-8222-222222222222/prayer-hall.webp", "b2222222-2222-4222-8222-222222222222/dates-and-water.webp"]',
    'MGQ', 'JED')
  returning id
), pk2d as (
  insert into public.umrah_package_departures (package_id, departure_date, return_date, total_seats, booked_seats)
  select id, current_date + 27, current_date + 37, 45, 0 from pk2
  union all
  select id, current_date + 57, current_date + 67, 45, 0 from pk2
)
insert into public.umrah_package_hotels (package_id, city, name, star_rating, distance_to_haram_m, nights, room_type, sort_order)
select id, 'makkah', 'Al Kiswah Towers', 3, 900, 5, 'Quad sharing', 0 from pk2
union all
select id, 'madinah', 'Al Eiman Taibah', 3, 650, 4, 'Quad sharing', 1 from pk2;

with pk3 as (
  insert into public.umrah_packages
    (id, name, slug, description, tagline, tier, is_featured, duration_days, includes,
     base_price, currency, status, images, origin_iata, destination_iata)
  values ('b3333333-3333-4333-8333-333333333333',
    '12-Day Rajab Umrah', '12-day-rajab-umrah',
    'Umrah in the sacred month of Rajab, when the Haram is far quieter than in Ramadan. Return flights from Mogadishu, 4-star hotels in both cities, visa, transport, and guided ziyarah at a relaxed pace.',
    'A quieter Haram in the sacred month, at off-peak prices.', 'standard', false, 12,
    '["flights", "visa", "hotel", "transport", "ziyarat_tours"]', 1420.00, 'USD', 'published',
    '["b3333333-3333-4333-8333-333333333333/mosque-courtyard-day.webp", "b3333333-3333-4333-8333-333333333333/prayer-hall.webp", "b3333333-3333-4333-8333-333333333333/dates-and-water.webp"]',
    'MGQ', 'JED')
  returning id
), pk3d as (
  insert into public.umrah_package_departures (package_id, departure_date, return_date, total_seats, booked_seats)
  select id, current_date + 52, current_date + 64, 40, 12 from pk3
)
insert into public.umrah_package_hotels (package_id, city, name, star_rating, distance_to_haram_m, nights, room_type, sort_order)
select id, 'makkah', 'Makkah Millennium', 4, 250, 6, 'Triple sharing', 0 from pk3
union all
select id, 'madinah', 'Al Haram Hotel', 4, 350, 5, 'Triple sharing', 1 from pk3;

with pk4 as (
  insert into public.umrah_packages
    (id, name, slug, description, tagline, tier, is_featured, duration_days, includes,
     base_price, currency, status, images, origin_iata, destination_iata)
  values ('b4444444-4444-4444-8444-444444444444',
    '12-Day Standard Umrah', '12-day-standard-umrah',
    'Flights from Mogadishu, 4-star hotels within a short walk of both Harams, visa processing, air-conditioned ground transport, and guided ziyarah in Makkah and Madinah.',
    'Closer hotels and guided ziyarah, without the VIP price.', 'standard', false, 12,
    '["flights", "visa", "hotel", "transport", "ziyarat_tours"]', 1550.00, 'USD', 'published',
    '["b4444444-4444-4444-8444-444444444444/mosque-sunrise.webp", "b4444444-4444-4444-8444-444444444444/prayer-hall.webp", "b4444444-4444-4444-8444-444444444444/hotel-suite.webp", "b4444444-4444-4444-8444-444444444444/dates-and-water.webp"]',
    'MGQ', 'JED')
  returning id
), pk4d as (
  insert into public.umrah_package_departures (package_id, departure_date, return_date, total_seats, booked_seats)
  select id, current_date + 38, current_date + 50, 40, 32 from pk4
)
insert into public.umrah_package_hotels (package_id, city, name, star_rating, distance_to_haram_m, nights, room_type, sort_order)
select id, 'makkah', 'Elaf Ajyad', 4, 450, 6, 'Triple sharing', 0 from pk4
union all
select id, 'madinah', 'Millennium Al Aqeeq', 4, 300, 5, 'Triple sharing', 1 from pk4;

with pk5 as (
  insert into public.umrah_packages
    (id, name, slug, description, tagline, tier, is_featured, duration_days, includes,
     base_price, currency, status, images, origin_iata, destination_iata)
  values ('b5555555-5555-4555-8555-555555555555',
    '15-Day Umrah from Hargeisa', '15-day-umrah-hargeisa',
    'Our Somaliland departure: return flights from Hargeisa, eight nights in Makkah and six in Madinah at 4-star hotels, visa processing, ground transport, and guided ziyarah in both cities.',
    'Departing Hargeisa — no need to route through Mogadishu.', 'standard', false, 15,
    '["flights", "visa", "hotel", "transport", "ziyarat_tours"]', 1750.00, 'USD', 'published',
    '["b5555555-5555-4555-8555-555555555555/mosque-aerial-dusk.webp", "b5555555-5555-4555-8555-555555555555/prayer-hall.webp", "b5555555-5555-4555-8555-555555555555/hotel-suite.webp"]',
    'HGA', 'JED')
  returning id
), pk5d as (
  insert into public.umrah_package_departures (package_id, departure_date, return_date, total_seats, booked_seats)
  select id, current_date + 41, current_date + 56, 35, 20 from pk5
)
insert into public.umrah_package_hotels (package_id, city, name, star_rating, distance_to_haram_m, nights, room_type, sort_order)
select id, 'makkah', 'Hilton Suites Makkah', 4, 220, 8, 'Triple sharing', 0 from pk5
union all
select id, 'madinah', 'Al Eiman Royal', 4, 280, 6, 'Triple sharing', 1 from pk5;

with pk6 as (
  insert into public.umrah_packages
    (id, name, slug, description, tagline, tier, is_featured, duration_days, includes,
     base_price, currency, status, images, origin_iata, destination_iata)
  values ('b6666666-6666-4666-8666-666666666666',
    '14-Day Premium Umrah', '14-day-premium-umrah',
    'Flights, 5-star hotels in Makkah & Madinah, visa, guided ziyarat tours, and daily meals.',
    'Five-star stays in both cities, with guided ziyarah throughout.', 'premium', true, 14,
    '["flights", "visa", "hotel", "transport", "ziyarat_tours", "meals"]', 1850.00, 'USD', 'published',
    '["b6666666-6666-4666-8666-666666666666/madinah-courtyard.webp", "b6666666-6666-4666-8666-666666666666/hotel-suite.webp", "b6666666-6666-4666-8666-666666666666/prayer-hall.webp", "b6666666-6666-4666-8666-666666666666/dates-and-water.webp"]',
    'MGQ', 'JED')
  returning id
), pk6d as (
  insert into public.umrah_package_departures (package_id, departure_date, return_date, total_seats, booked_seats)
  select id, current_date + 42, current_date + 56, 40, 0 from pk6
  union all
  select id, current_date + 72, current_date + 86, 40, 0 from pk6
)
insert into public.umrah_package_hotels (package_id, city, name, star_rating, distance_to_haram_m, nights, room_type, sort_order)
select id, 'makkah', 'Swissotel Al Maqam', 5, 180, 7, 'Double sharing', 0 from pk6
union all
select id, 'madinah', 'The Oberoi Madinah', 5, 120, 6, 'Double sharing', 1 from pk6;

with pk7 as (
  insert into public.umrah_packages
    (id, name, slug, description, tagline, tier, is_featured, duration_days, includes,
     base_price, currency, status, images, origin_iata, destination_iata)
  values ('b7777777-7777-4777-8777-777777777777',
    '14-Day Family Umrah', '14-day-family-umrah',
    'Designed around families travelling together: connecting family rooms in both cities, reduced pricing for children under twelve, a slower ziyarah schedule, and a group leader who stays with the family throughout.',
    'Connecting family rooms and reduced fares for children.', 'premium', false, 14,
    '["flights", "visa", "hotel", "transport", "ziyarat_tours", "meals"]', 1890.00, 'USD', 'published',
    '["b7777777-7777-4777-8777-777777777777/family-room.webp", "b7777777-7777-4777-8777-777777777777/mosque-courtyard-day.webp", "b7777777-7777-4777-8777-777777777777/dates-and-water.webp"]',
    'MGQ', 'JED')
  returning id
), pk7d as (
  insert into public.umrah_package_departures (package_id, departure_date, return_date, total_seats, booked_seats)
  select id, current_date + 66, current_date + 80, 30, 9 from pk7
)
insert into public.umrah_package_hotels (package_id, city, name, star_rating, distance_to_haram_m, nights, room_type, sort_order)
select id, 'makkah', 'Pullman ZamZam Makkah', 5, 150, 7, 'Family room', 0 from pk7
union all
select id, 'madinah', 'Anwar Al Madinah Movenpick', 5, 100, 6, 'Family room', 1 from pk7;

with pk8 as (
  insert into public.umrah_packages
    (id, name, slug, description, tagline, tier, is_featured, duration_days, includes,
     base_price, currency, status, images, origin_iata, destination_iata)
  values ('b8888888-8888-4888-8888-888888888888',
    '10-Day Ramadan Umrah', '10-day-ramadan-umrah',
    'The first ten nights of Ramadan, when hotel rates are still well below the final ten. Return flights from Mogadishu, 4-star hotels close to both Harams, visa, transport, and full board so fasting and iftar are taken care of.',
    'The first ten nights of Ramadan — the affordable half of the month.', 'premium', false, 10,
    '["flights", "visa", "hotel", "transport", "ziyarat_tours", "meals"]', 2250.00, 'USD', 'published',
    '["b8888888-8888-4888-8888-888888888888/ramadan-lanterns.webp", "b8888888-8888-4888-8888-888888888888/prayer-hall.webp", "b8888888-8888-4888-8888-888888888888/dates-and-water.webp"]',
    'MGQ', 'JED')
  returning id
), pk8d as (
  insert into public.umrah_package_departures (package_id, departure_date, return_date, total_seats, booked_seats)
  select id, current_date + 84, current_date + 94, 50, 44 from pk8
)
insert into public.umrah_package_hotels (package_id, city, name, star_rating, distance_to_haram_m, nights, room_type, sort_order)
select id, 'makkah', 'Jabal Omar Marriott', 4, 200, 5, 'Double sharing', 0 from pk8
union all
select id, 'madinah', 'Madinah Hilton', 4, 150, 4, 'Double sharing', 1 from pk8;

with pk9 as (
  insert into public.umrah_packages
    (id, name, slug, description, tagline, tier, is_featured, duration_days, includes,
     base_price, currency, status, images, origin_iata, destination_iata)
  values ('b9999999-9999-4999-8999-999999999999',
    '21-Day VIP Ramadan Umrah', '21-day-vip-ramadan-umrah',
    'Haram-view suites, private transport, VIP fast-track visa, personal guide, and full board throughout Ramadan.',
    'The last ten nights of Ramadan, with a Haram-view suite.', 'vip', false, 21,
    '["flights", "visa", "hotel", "transport", "meals", "ziyarat_tours", "private_guide"]', 3400.00, 'USD', 'published',
    '["b9999999-9999-4999-8999-999999999999/mosque-night.webp", "b9999999-9999-4999-8999-999999999999/hotel-suite.webp", "b9999999-9999-4999-8999-999999999999/prayer-hall.webp", "b9999999-9999-4999-8999-999999999999/dates-and-water.webp"]',
    'MGQ', 'JED')
  returning id
), pk9d as (
  insert into public.umrah_package_departures (package_id, departure_date, return_date, total_seats, booked_seats)
  select id, current_date + 87, current_date + 108, 30, 0 from pk9
)
insert into public.umrah_package_hotels (package_id, city, name, star_rating, distance_to_haram_m, nights, room_type, sort_order)
select id, 'makkah', 'Raffles Makkah Palace', 5, 50, 12, 'Haram-view suite', 0 from pk9
union all
select id, 'madinah', 'Dar Al Taqwa', 5, 80, 8, 'Executive suite', 1 from pk9;


-- ----------------------------------------------------------------------------
-- Meal plan, named contact, day-by-day itinerary and the sharing rate card.
--
-- Each of these drives a section of /umrah/[slug] that renders nothing when
-- empty. meal_plan is kept consistent with the `includes` array: a package
-- that lists "meals" must not also say meal_plan = 'none'.
-- ----------------------------------------------------------------------------
update public.umrah_packages set
  meal_plan = 'none', meals_note = null,
  contact_person_name = 'Abdirahman Nur', contact_person_phone = '+252 611 444 420',
  contact_person_email = 'info@scoutsts.com', contact_whatsapp = '+252611444420'
where slug = '7-day-express-umrah';
update public.umrah_packages set
  meal_plan = 'none', meals_note = null,
  contact_person_name = 'Abdirahman Nur', contact_person_phone = '+252 611 444 420',
  contact_person_email = 'info@scoutsts.com', contact_whatsapp = '+252611444420'
where slug = '10-day-economy-umrah';
update public.umrah_packages set
  meal_plan = 'none', meals_note = null,
  contact_person_name = 'Abdirahman Nur', contact_person_phone = '+252 611 444 420',
  contact_person_email = 'info@scoutsts.com', contact_whatsapp = '+252611444420'
where slug = '12-day-rajab-umrah';
update public.umrah_packages set
  meal_plan = 'none', meals_note = null,
  contact_person_name = 'Abdirahman Nur', contact_person_phone = '+252 611 444 420',
  contact_person_email = 'info@scoutsts.com', contact_whatsapp = '+252611444420'
where slug = '12-day-standard-umrah';
update public.umrah_packages set
  meal_plan = 'none', meals_note = null,
  contact_person_name = 'Khadra Ismail', contact_person_phone = '+254 711 620 420',
  contact_person_email = 'info@scoutsts.com', contact_whatsapp = '+254711620420'
where slug = '15-day-umrah-hargeisa';
update public.umrah_packages set
  meal_plan = 'half_board', meals_note = 'Breakfast and dinner served daily in the hotel; lunch on guided ziyarah days.',
  contact_person_name = 'Abdirahman Nur', contact_person_phone = '+252 611 444 420',
  contact_person_email = 'info@scoutsts.com', contact_whatsapp = '+252611444420'
where slug = '14-day-premium-umrah';
update public.umrah_packages set
  meal_plan = 'half_board', meals_note = 'Breakfast and dinner daily, with children''s portions and early sittings for younger families.',
  contact_person_name = 'Abdirahman Nur', contact_person_phone = '+252 611 444 420',
  contact_person_email = 'info@scoutsts.com', contact_whatsapp = '+252611444420'
where slug = '14-day-family-umrah';
update public.umrah_packages set
  meal_plan = 'full_board', meals_note = 'Suhoor and iftar served daily in the hotel for the whole of your stay.',
  contact_person_name = 'Abdirahman Nur', contact_person_phone = '+252 611 444 420',
  contact_person_email = 'info@scoutsts.com', contact_whatsapp = '+252611444420'
where slug = '10-day-ramadan-umrah';
update public.umrah_packages set
  meal_plan = 'full_board', meals_note = 'Suhoor and iftar served daily in the hotel throughout Ramadan, plus lunch on ziyarah days.',
  contact_person_name = 'Abdirahman Nur', contact_person_phone = '+252 611 444 420',
  contact_person_email = 'info@scoutsts.com', contact_whatsapp = '+252611444420'
where slug = '21-day-vip-ramadan-umrah';

insert into public.umrah_package_pricing (package_id, sharing, price) values
  ('b1111111-1111-4111-8111-111111111111', 1, 1960.00),
  ('b1111111-1111-4111-8111-111111111111', 2, 1520.00),
  ('b1111111-1111-4111-8111-111111111111', 3, 1300.00),
  ('b1111111-1111-4111-8111-111111111111', 4, 1180.00),
  ('b2222222-2222-4222-8222-222222222222', 1, 2030.00),
  ('b2222222-2222-4222-8222-222222222222', 2, 1590.00),
  ('b2222222-2222-4222-8222-222222222222', 3, 1370.00),
  ('b2222222-2222-4222-8222-222222222222', 4, 1250.00),
  ('b3333333-3333-4333-8333-333333333333', 1, 2200.00),
  ('b3333333-3333-4333-8333-333333333333', 2, 1760.00),
  ('b3333333-3333-4333-8333-333333333333', 3, 1540.00),
  ('b3333333-3333-4333-8333-333333333333', 4, 1420.00),
  ('b4444444-4444-4444-8444-444444444444', 1, 2330.00),
  ('b4444444-4444-4444-8444-444444444444', 2, 1890.00),
  ('b4444444-4444-4444-8444-444444444444', 3, 1670.00),
  ('b4444444-4444-4444-8444-444444444444', 4, 1550.00),
  ('b5555555-5555-4555-8555-555555555555', 1, 2530.00),
  ('b5555555-5555-4555-8555-555555555555', 2, 2090.00),
  ('b5555555-5555-4555-8555-555555555555', 3, 1870.00),
  ('b5555555-5555-4555-8555-555555555555', 4, 1750.00),
  ('b6666666-6666-4666-8666-666666666666', 1, 2630.00),
  ('b6666666-6666-4666-8666-666666666666', 2, 2190.00),
  ('b6666666-6666-4666-8666-666666666666', 3, 1970.00),
  ('b6666666-6666-4666-8666-666666666666', 4, 1850.00),
  ('b7777777-7777-4777-8777-777777777777', 1, 2670.00),
  ('b7777777-7777-4777-8777-777777777777', 2, 2230.00),
  ('b7777777-7777-4777-8777-777777777777', 3, 2010.00),
  ('b7777777-7777-4777-8777-777777777777', 4, 1890.00),
  ('b8888888-8888-4888-8888-888888888888', 1, 3030.00),
  ('b8888888-8888-4888-8888-888888888888', 2, 2590.00),
  ('b8888888-8888-4888-8888-888888888888', 3, 2370.00),
  ('b8888888-8888-4888-8888-888888888888', 4, 2250.00),
  ('b9999999-9999-4999-8999-999999999999', 1, 4180.00),
  ('b9999999-9999-4999-8999-999999999999', 2, 3740.00),
  ('b9999999-9999-4999-8999-999999999999', 3, 3520.00),
  ('b9999999-9999-4999-8999-999999999999', 4, 3400.00);

insert into public.umrah_itinerary_days (package_id, day_number, title, description) values
  ('b1111111-1111-4111-8111-111111111111', 1, 'Depart Mogadishu · arrive in Makkah', 'Fly Mogadishu to Jeddah, where an STS representative meets the group at the airport. Enter ihram before landing, then transfer by private coach to your hotel in Makkah.'),
  ('b1111111-1111-4111-8111-111111111111', 2, 'Perform Umrah', 'Your group leader walks you through tawaf around the Kaaba and sa''i between Safa and Marwah, then the closing of ihram. Nothing is left for you to work out alone.'),
  ('b1111111-1111-4111-8111-111111111111', 3, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b1111111-1111-4111-8111-111111111111', 4, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b1111111-1111-4111-8111-111111111111', 5, 'Travel to Madinah', 'Check out after Fajr and travel to Madinah by coach, arriving at a hotel a short walk from Masjid an-Nabawi.'),
  ('b1111111-1111-4111-8111-111111111111', 6, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b1111111-1111-4111-8111-111111111111', 7, 'Return to Mogadishu', 'Transfer to the airport for your return flight to Mogadishu. Your group leader travels with you.'),
  ('b2222222-2222-4222-8222-222222222222', 1, 'Depart Mogadishu · arrive in Makkah', 'Fly Mogadishu to Jeddah, where an STS representative meets the group at the airport. Enter ihram before landing, then transfer by private coach to your hotel in Makkah.'),
  ('b2222222-2222-4222-8222-222222222222', 2, 'Perform Umrah', 'Your group leader walks you through tawaf around the Kaaba and sa''i between Safa and Marwah, then the closing of ihram. Nothing is left for you to work out alone.'),
  ('b2222222-2222-4222-8222-222222222222', 3, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b2222222-2222-4222-8222-222222222222', 4, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b2222222-2222-4222-8222-222222222222', 5, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b2222222-2222-4222-8222-222222222222', 6, 'Travel to Madinah', 'Check out after Fajr and travel to Madinah by coach, arriving at a hotel a short walk from Masjid an-Nabawi.'),
  ('b2222222-2222-4222-8222-222222222222', 7, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b2222222-2222-4222-8222-222222222222', 8, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b2222222-2222-4222-8222-222222222222', 9, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b2222222-2222-4222-8222-222222222222', 10, 'Return to Mogadishu', 'Transfer to the airport for your return flight to Mogadishu. Your group leader travels with you.'),
  ('b3333333-3333-4333-8333-333333333333', 1, 'Depart Mogadishu · arrive in Makkah', 'Fly Mogadishu to Jeddah, where an STS representative meets the group at the airport. Enter ihram before landing, then transfer by private coach to your hotel in Makkah.'),
  ('b3333333-3333-4333-8333-333333333333', 2, 'Perform Umrah', 'Your group leader walks you through tawaf around the Kaaba and sa''i between Safa and Marwah, then the closing of ihram. Nothing is left for you to work out alone.'),
  ('b3333333-3333-4333-8333-333333333333', 3, 'Ziyarah in Makkah', 'Guided visit to Jabal al-Nour and the cave of Hira, Jabal Thawr, and the plains of Mina and Arafat, with the history explained in Somali as you go.'),
  ('b3333333-3333-4333-8333-333333333333', 4, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b3333333-3333-4333-8333-333333333333', 5, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b3333333-3333-4333-8333-333333333333', 6, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b3333333-3333-4333-8333-333333333333', 7, 'Travel to Madinah', 'Check out after Fajr and travel to Madinah by coach, arriving at a hotel a short walk from Masjid an-Nabawi.'),
  ('b3333333-3333-4333-8333-333333333333', 8, 'Ziyarah in Madinah', 'Guided visit to the Quba Mosque, the site of the Battle of Uhud, and Masjid al-Qiblatain.'),
  ('b3333333-3333-4333-8333-333333333333', 9, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b3333333-3333-4333-8333-333333333333', 10, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b3333333-3333-4333-8333-333333333333', 11, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b3333333-3333-4333-8333-333333333333', 12, 'Return to Mogadishu', 'Transfer to the airport for your return flight to Mogadishu. Your group leader travels with you.'),
  ('b4444444-4444-4444-8444-444444444444', 1, 'Depart Mogadishu · arrive in Makkah', 'Fly Mogadishu to Jeddah, where an STS representative meets the group at the airport. Enter ihram before landing, then transfer by private coach to your hotel in Makkah.'),
  ('b4444444-4444-4444-8444-444444444444', 2, 'Perform Umrah', 'Your group leader walks you through tawaf around the Kaaba and sa''i between Safa and Marwah, then the closing of ihram. Nothing is left for you to work out alone.'),
  ('b4444444-4444-4444-8444-444444444444', 3, 'Ziyarah in Makkah', 'Guided visit to Jabal al-Nour and the cave of Hira, Jabal Thawr, and the plains of Mina and Arafat, with the history explained in Somali as you go.'),
  ('b4444444-4444-4444-8444-444444444444', 4, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b4444444-4444-4444-8444-444444444444', 5, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b4444444-4444-4444-8444-444444444444', 6, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b4444444-4444-4444-8444-444444444444', 7, 'Travel to Madinah', 'Check out after Fajr and travel to Madinah by coach, arriving at a hotel a short walk from Masjid an-Nabawi.'),
  ('b4444444-4444-4444-8444-444444444444', 8, 'Ziyarah in Madinah', 'Guided visit to the Quba Mosque, the site of the Battle of Uhud, and Masjid al-Qiblatain.'),
  ('b4444444-4444-4444-8444-444444444444', 9, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b4444444-4444-4444-8444-444444444444', 10, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b4444444-4444-4444-8444-444444444444', 11, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b4444444-4444-4444-8444-444444444444', 12, 'Return to Mogadishu', 'Transfer to the airport for your return flight to Mogadishu. Your group leader travels with you.'),
  ('b5555555-5555-4555-8555-555555555555', 1, 'Depart Hargeisa · arrive in Makkah', 'Fly Hargeisa to Jeddah, where an STS representative meets the group at the airport. Enter ihram before landing, then transfer by private coach to your hotel in Makkah.'),
  ('b5555555-5555-4555-8555-555555555555', 2, 'Perform Umrah', 'Your group leader walks you through tawaf around the Kaaba and sa''i between Safa and Marwah, then the closing of ihram. Nothing is left for you to work out alone.'),
  ('b5555555-5555-4555-8555-555555555555', 3, 'Ziyarah in Makkah', 'Guided visit to Jabal al-Nour and the cave of Hira, Jabal Thawr, and the plains of Mina and Arafat, with the history explained in Somali as you go.'),
  ('b5555555-5555-4555-8555-555555555555', 4, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b5555555-5555-4555-8555-555555555555', 5, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b5555555-5555-4555-8555-555555555555', 6, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b5555555-5555-4555-8555-555555555555', 7, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b5555555-5555-4555-8555-555555555555', 8, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b5555555-5555-4555-8555-555555555555', 9, 'Travel to Madinah', 'Check out after Fajr and travel to Madinah by coach, arriving at a hotel a short walk from Masjid an-Nabawi.'),
  ('b5555555-5555-4555-8555-555555555555', 10, 'Ziyarah in Madinah', 'Guided visit to the Quba Mosque, the site of the Battle of Uhud, and Masjid al-Qiblatain.'),
  ('b5555555-5555-4555-8555-555555555555', 11, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b5555555-5555-4555-8555-555555555555', 12, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b5555555-5555-4555-8555-555555555555', 13, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b5555555-5555-4555-8555-555555555555', 14, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b5555555-5555-4555-8555-555555555555', 15, 'Return to Hargeisa', 'Transfer to the airport for your return flight to Hargeisa. Your group leader travels with you.'),
  ('b6666666-6666-4666-8666-666666666666', 1, 'Depart Mogadishu · arrive in Makkah', 'Fly Mogadishu to Jeddah, where an STS representative meets the group at the airport. Enter ihram before landing, then transfer by private coach to your hotel in Makkah.'),
  ('b6666666-6666-4666-8666-666666666666', 2, 'Perform Umrah', 'Your group leader walks you through tawaf around the Kaaba and sa''i between Safa and Marwah, then the closing of ihram. Nothing is left for you to work out alone.'),
  ('b6666666-6666-4666-8666-666666666666', 3, 'Ziyarah in Makkah', 'Guided visit to Jabal al-Nour and the cave of Hira, Jabal Thawr, and the plains of Mina and Arafat, with the history explained in Somali as you go.'),
  ('b6666666-6666-4666-8666-666666666666', 4, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b6666666-6666-4666-8666-666666666666', 5, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b6666666-6666-4666-8666-666666666666', 6, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b6666666-6666-4666-8666-666666666666', 7, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b6666666-6666-4666-8666-666666666666', 8, 'Travel to Madinah', 'Check out after Fajr and travel to Madinah by coach, arriving at a hotel a short walk from Masjid an-Nabawi.'),
  ('b6666666-6666-4666-8666-666666666666', 9, 'Ziyarah in Madinah', 'Guided visit to the Quba Mosque, the site of the Battle of Uhud, and Masjid al-Qiblatain.'),
  ('b6666666-6666-4666-8666-666666666666', 10, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b6666666-6666-4666-8666-666666666666', 11, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b6666666-6666-4666-8666-666666666666', 12, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b6666666-6666-4666-8666-666666666666', 13, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b6666666-6666-4666-8666-666666666666', 14, 'Return to Mogadishu', 'Transfer to the airport for your return flight to Mogadishu. Your group leader travels with you.'),
  ('b7777777-7777-4777-8777-777777777777', 1, 'Depart Mogadishu · arrive in Makkah', 'Fly Mogadishu to Jeddah, where an STS representative meets the group at the airport. Enter ihram before landing, then transfer by private coach to your hotel in Makkah.'),
  ('b7777777-7777-4777-8777-777777777777', 2, 'Perform Umrah', 'Your group leader walks you through tawaf around the Kaaba and sa''i between Safa and Marwah, then the closing of ihram. Nothing is left for you to work out alone.'),
  ('b7777777-7777-4777-8777-777777777777', 3, 'Ziyarah in Makkah', 'Guided visit to Jabal al-Nour and the cave of Hira, Jabal Thawr, and the plains of Mina and Arafat, with the history explained in Somali as you go.'),
  ('b7777777-7777-4777-8777-777777777777', 4, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b7777777-7777-4777-8777-777777777777', 5, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b7777777-7777-4777-8777-777777777777', 6, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b7777777-7777-4777-8777-777777777777', 7, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b7777777-7777-4777-8777-777777777777', 8, 'Travel to Madinah', 'Check out after Fajr and travel to Madinah by coach, arriving at a hotel a short walk from Masjid an-Nabawi.'),
  ('b7777777-7777-4777-8777-777777777777', 9, 'Ziyarah in Madinah', 'Guided visit to the Quba Mosque, the site of the Battle of Uhud, and Masjid al-Qiblatain.'),
  ('b7777777-7777-4777-8777-777777777777', 10, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b7777777-7777-4777-8777-777777777777', 11, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b7777777-7777-4777-8777-777777777777', 12, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b7777777-7777-4777-8777-777777777777', 13, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b7777777-7777-4777-8777-777777777777', 14, 'Return to Mogadishu', 'Transfer to the airport for your return flight to Mogadishu. Your group leader travels with you.'),
  ('b8888888-8888-4888-8888-888888888888', 1, 'Depart Mogadishu · arrive in Makkah', 'Fly Mogadishu to Jeddah, where an STS representative meets the group at the airport. Enter ihram before landing, then transfer by private coach to your hotel in Makkah.'),
  ('b8888888-8888-4888-8888-888888888888', 2, 'Perform Umrah', 'Your group leader walks you through tawaf around the Kaaba and sa''i between Safa and Marwah, then the closing of ihram. Nothing is left for you to work out alone.'),
  ('b8888888-8888-4888-8888-888888888888', 3, 'Ziyarah in Makkah', 'Guided visit to Jabal al-Nour and the cave of Hira, Jabal Thawr, and the plains of Mina and Arafat, with the history explained in Somali as you go.'),
  ('b8888888-8888-4888-8888-888888888888', 4, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b8888888-8888-4888-8888-888888888888', 5, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b8888888-8888-4888-8888-888888888888', 6, 'Travel to Madinah', 'Check out after Fajr and travel to Madinah by coach, arriving at a hotel a short walk from Masjid an-Nabawi.'),
  ('b8888888-8888-4888-8888-888888888888', 7, 'Ziyarah in Madinah', 'Guided visit to the Quba Mosque, the site of the Battle of Uhud, and Masjid al-Qiblatain.'),
  ('b8888888-8888-4888-8888-888888888888', 8, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b8888888-8888-4888-8888-888888888888', 9, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b8888888-8888-4888-8888-888888888888', 10, 'Return to Mogadishu', 'Transfer to the airport for your return flight to Mogadishu. Your group leader travels with you.'),
  ('b9999999-9999-4999-8999-999999999999', 1, 'Depart Mogadishu · arrive in Makkah', 'Fly Mogadishu to Jeddah, where an STS representative meets the group at the airport. Enter ihram before landing, then transfer by private coach to your hotel in Makkah.'),
  ('b9999999-9999-4999-8999-999999999999', 2, 'Perform Umrah', 'Your group leader walks you through tawaf around the Kaaba and sa''i between Safa and Marwah, then the closing of ihram. Nothing is left for you to work out alone.'),
  ('b9999999-9999-4999-8999-999999999999', 3, 'Ziyarah in Makkah', 'Guided visit to Jabal al-Nour and the cave of Hira, Jabal Thawr, and the plains of Mina and Arafat, with the history explained in Somali as you go.'),
  ('b9999999-9999-4999-8999-999999999999', 4, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b9999999-9999-4999-8999-999999999999', 5, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b9999999-9999-4999-8999-999999999999', 6, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b9999999-9999-4999-8999-999999999999', 7, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b9999999-9999-4999-8999-999999999999', 8, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b9999999-9999-4999-8999-999999999999', 9, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b9999999-9999-4999-8999-999999999999', 10, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b9999999-9999-4999-8999-999999999999', 11, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b9999999-9999-4999-8999-999999999999', 12, 'Worship at the Haram', 'A free day to pray at Masjid al-Haram at your own pace and perform additional tawaf. Your group leader stays reachable throughout.'),
  ('b9999999-9999-4999-8999-999999999999', 13, 'Travel to Madinah', 'Check out after Fajr and travel to Madinah by coach, arriving at a hotel a short walk from Masjid an-Nabawi.'),
  ('b9999999-9999-4999-8999-999999999999', 14, 'Ziyarah in Madinah', 'Guided visit to the Quba Mosque, the site of the Battle of Uhud, and Masjid al-Qiblatain.'),
  ('b9999999-9999-4999-8999-999999999999', 15, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b9999999-9999-4999-8999-999999999999', 16, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b9999999-9999-4999-8999-999999999999', 17, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b9999999-9999-4999-8999-999999999999', 18, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b9999999-9999-4999-8999-999999999999', 19, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b9999999-9999-4999-8999-999999999999', 20, 'Prayers at Masjid an-Nabawi', 'Time for prayer in the Prophet''s Mosque and to visit the Rawdah, at your own pace.'),
  ('b9999999-9999-4999-8999-999999999999', 21, 'Return to Mogadishu', 'Transfer to the airport for your return flight to Mogadishu. Your group leader travels with you.');

-- ----------------------------------------------------------------------------
-- Event venues & halls
-- ----------------------------------------------------------------------------
insert into public.event_venues
  (id, name, slug, tagline, description, city, address, capacity_seated, capacity_standing, size_sqm,
   amenities, event_types, base_price, currency, price_unit, is_featured, status, images)
values
  ('c1111111-1111-4111-8111-111111111111', 'Sultan Grand Ballroom', 'sultan-grand-ballroom',
   'Mogadishu''s most elegant wedding venue',
   'A 900-seat ballroom in Sultan Business Park with crystal chandeliers, a bridal suite, and full catering kitchens. Our events team handles decor, sound, and staging end to end.',
   'Mogadishu', 'Sultan Business Park, Waaberi District, 21 Oct Street',
   900, 1200, 1450.0,
   '["stage","led_screens","sound_system","catering_kitchen","bridal_suite","vip_lounge","parking","generator_backup","prayer_rooms"]',
   '["wedding","engagement","gala_dinner","graduation"]',
   2500.00, 'USD', 'per_event', true, 'published',
   '["c1111111-1111-4111-8111-111111111111/ballroom.webp","c1111111-1111-4111-8111-111111111111/banquet-setting.webp","c1111111-1111-4111-8111-111111111111/event-stage.webp"]'),
  ('c2222222-2222-4222-8222-222222222222', 'STS Conference Center', 'sts-conference-center',
   'Professional conferences and corporate summits',
   'A modern 350-seat auditorium with breakout rooms, simultaneous-translation booths, gigabit Wi-Fi, and livestream-ready AV — purpose-built for conferences, product launches, and NGO summits.',
   'Mogadishu', 'Airport Road, Wadajir District',
   350, 500, 800.0,
   '["projector","led_screens","sound_system","translation_booths","breakout_rooms","high_speed_wifi","catering_service","parking","generator_backup"]',
   '["conference","seminar","product_launch","training","ngo_summit"]',
   1200.00, 'USD', 'per_day', true, 'published',
   '["c2222222-2222-4222-8222-222222222222/conference-hall.webp","c2222222-2222-4222-8222-222222222222/event-stage.webp","c2222222-2222-4222-8222-222222222222/banquet-setting.webp"]'),
  ('c3333333-3333-4333-8333-333333333333', 'Laasgeel Garden Hall', 'laasgeel-garden-hall',
   'Open-air celebrations under the stars',
   'Landscaped gardens and a covered pavilion for up to 400 guests in Hargeisa — a favourite for aroos celebrations, Eid gatherings, and community fundraisers.',
   'Hargeisa', 'Jigjiga Yar District',
   400, 600, 2000.0,
   '["garden","covered_pavilion","sound_system","catering_service","kids_area","parking","generator_backup"]',
   '["wedding","eid_celebration","fundraiser","birthday","community_event"]',
   900.00, 'USD', 'per_event', false, 'published',
   '["c3333333-3333-4333-8333-333333333333/garden-hall.webp","c3333333-3333-4333-8333-333333333333/banquet-setting.webp","c3333333-3333-4333-8333-333333333333/event-stage.webp"]');
