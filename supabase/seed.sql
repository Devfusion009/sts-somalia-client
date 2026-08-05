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
   'tourist', 'single', 90, 60, 2, 4, 55.00, 'USD', false,
   'Electronic Travel Authorisation for Kenya — required for all visitors before departure.',
   '[{"key":"passport_bio","label":"Passport Bio Page","description":"Color copy of passport bio page","required":true,"max_mb":5},
     {"key":"photo","label":"Passport Size Photo","description":"Recent passport size photo with white background","required":true,"max_mb":2},
     {"key":"flight_itinerary","label":"Flight Itinerary","description":"Confirmed return ticket","required":true,"max_mb":5},
     {"key":"hotel_booking","label":"Accommodation Proof","description":"Hotel booking or host invitation","required":true,"max_mb":5}]',
   'published'),
  ('ET', 'Ethiopia e-Visa', 'Single entry tourist e-Visa for Ethiopia, 30-day stay',
   'tourist', 'single', 90, 30, 1, 3, 52.00, 'USD', false,
   'Quick online visa for Ethiopia — approved copies delivered straight to your STS account.',
   '[{"key":"passport_bio","label":"Passport Bio Page","description":"Color copy of passport bio page","required":true,"max_mb":5},
     {"key":"photo","label":"Passport Size Photo","description":"Recent passport size photo with white background","required":true,"max_mb":2}]',
   'published'),
  ('EG', 'Egypt Tourist Visa', 'Single entry tourist visa for Egypt, 30-day stay',
   'tourist', 'single', 90, 30, 5, 8, 70.00, 'USD', false,
   'Tourist visa for Egypt with document review by our specialists before submission.',
   '[{"key":"passport_bio","label":"Passport Bio Page","description":"Color copy of passport bio page","required":true,"max_mb":5},
     {"key":"photo","label":"Passport Size Photo","description":"Recent passport size photo with white background","required":true,"max_mb":2},
     {"key":"flight_itinerary","label":"Flight Itinerary","description":"Confirmed flight ticket or itinerary","required":true,"max_mb":5},
     {"key":"bank_statement","label":"Bank Statement (Last 3 Months)","description":"Recent bank statement","required":true,"max_mb":5}]',
   'published'),
  ('MY', 'Malaysia eVisa', 'Single entry eVisa for Malaysia, 30-day stay',
   'tourist', 'single', 90, 30, 3, 7, 95.00, 'USD', false,
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
  insert into public.hotels (partner_id, name, slug, description, star_rating, city, country_code, status)
  select id, 'Mogadishu Beach Hotel', 'mogadishu-beach-hotel',
         'Seafront hotel on Lido Beach with conference facilities, sea-view rooms, and an in-house restaurant.',
         4, 'Mogadishu', 'SO', 'published'::public.listing_status
  from partner
  returning id
)
insert into public.hotel_rooms (hotel_id, name, description, max_occupancy, base_price, currency, status)
select id, 'Deluxe Double Room', 'Double room with sea view, air conditioning, and workspace.', 2, 120.00, 'USD', 'published'::public.listing_status from hotel
union all
select id, 'Executive Suite', 'Suite with separate living area and panoramic ocean views.', 3, 220.00, 'USD', 'published'::public.listing_status from hotel
union all
select id, 'Standard Twin Room', 'Comfortable twin room ideal for colleagues or friends.', 2, 95.00, 'USD', 'published'::public.listing_status from hotel;

with partner2 as (
  insert into public.hotel_partners (name, contact_email, status)
  values ('Hargeisa Hosts Ltd', 'stay@hargeisahosts.example', 'active')
  returning id
),
hotel2 as (
  insert into public.hotels (partner_id, name, slug, description, star_rating, city, country_code, status)
  select id, 'Hargeisa Grand Hotel', 'hargeisa-grand-hotel',
         'Modern business hotel in central Hargeisa with meeting rooms and airport shuttle.',
         3, 'Hargeisa', 'SO', 'published'::public.listing_status
  from partner2
  returning id
)
insert into public.hotel_rooms (hotel_id, name, description, max_occupancy, base_price, currency, status)
select id, 'Classic Queen Room', 'Queen bed, breakfast included.', 2, 75.00, 'USD', 'published'::public.listing_status from hotel2
union all
select id, 'Family Quadruple Room', 'Two double beds, city views — great for families.', 4, 130.00, 'USD', 'published'::public.listing_status from hotel2;

-- ----------------------------------------------------------------------------
-- Umrah packages (three tiers, each with upcoming departures)
-- ----------------------------------------------------------------------------
with p1 as (
  insert into public.umrah_packages (name, slug, description, duration_days, includes, base_price, currency, status)
  values ('10-Day Economy Umrah', '10-day-economy-umrah',
    'Flights from Mogadishu, 3-star hotels within walking distance of the Haram, visa processing, and ground transport.',
    10, '["flights","visa","hotel","transport"]', 1250.00, 'USD', 'published')
  returning id
)
insert into public.umrah_package_departures (package_id, departure_date, return_date, total_seats)
select id, current_date + 30, current_date + 40, 45 from p1
union all
select id, current_date + 60, current_date + 70, 45 from p1;

with p2 as (
  insert into public.umrah_packages (name, slug, description, duration_days, includes, base_price, currency, status)
  values ('14-Day Premium Umrah', '14-day-premium-umrah',
    'Flights, 5-star hotels in Makkah & Madinah, visa, guided ziyarat tours, and daily meals.',
    14, '["flights","visa","hotel","transport","ziyarat_tours","meals"]', 1850.00, 'USD', 'published')
  returning id
)
insert into public.umrah_package_departures (package_id, departure_date, return_date, total_seats)
select id, current_date + 45, current_date + 59, 40 from p2
union all
select id, current_date + 75, current_date + 89, 40 from p2;

with p3 as (
  insert into public.umrah_packages (name, slug, description, duration_days, includes, base_price, currency, status)
  values ('21-Day VIP Ramadan Umrah', '21-day-vip-ramadan-umrah',
    'Haram-view suites, private transport, VIP fast-track visa, personal guide, and full board throughout Ramadan.',
    21, '["flights","visa","hotel","transport","ziyarat_tours","meals","private_guide"]', 3400.00, 'USD', 'published')
  returning id
)
insert into public.umrah_package_departures (package_id, departure_date, return_date, total_seats)
select id, current_date + 90, current_date + 111, 30 from p3;

-- ----------------------------------------------------------------------------
-- Event venues & halls
-- ----------------------------------------------------------------------------
insert into public.event_venues
  (name, slug, tagline, description, city, address, capacity_seated, capacity_standing, size_sqm,
   amenities, event_types, base_price, currency, price_unit, is_featured, status)
values
  ('Sultan Grand Ballroom', 'sultan-grand-ballroom',
   'Mogadishu''s most elegant wedding venue',
   'A 900-seat ballroom in Sultan Business Park with crystal chandeliers, a bridal suite, and full catering kitchens. Our events team handles decor, sound, and staging end to end.',
   'Mogadishu', 'Sultan Business Park, Waaberi District, 21 Oct Street',
   900, 1200, 1450.0,
   '["stage","led_screens","sound_system","catering_kitchen","bridal_suite","vip_lounge","parking","generator_backup","prayer_rooms"]',
   '["wedding","engagement","gala_dinner","graduation"]',
   2500.00, 'USD', 'per_event', true, 'published'),
  ('STS Conference Center', 'sts-conference-center',
   'Professional conferences and corporate summits',
   'A modern 350-seat auditorium with breakout rooms, simultaneous-translation booths, gigabit Wi-Fi, and livestream-ready AV — purpose-built for conferences, product launches, and NGO summits.',
   'Mogadishu', 'Airport Road, Wadajir District',
   350, 500, 800.0,
   '["projector","led_screens","sound_system","translation_booths","breakout_rooms","high_speed_wifi","catering_service","parking","generator_backup"]',
   '["conference","seminar","product_launch","training","ngo_summit"]',
   1200.00, 'USD', 'per_day', true, 'published'),
  ('Laasgeel Garden Hall', 'laasgeel-garden-hall',
   'Open-air celebrations under the stars',
   'Landscaped gardens and a covered pavilion for up to 400 guests in Hargeisa — a favourite for aroos celebrations, Eid gatherings, and community fundraisers.',
   'Hargeisa', 'Jigjiga Yar District',
   400, 600, 2000.0,
   '["garden","covered_pavilion","sound_system","catering_service","kids_area","parking","generator_backup"]',
   '["wedding","eid_celebration","fundraiser","birthday","community_event"]',
   900.00, 'USD', 'per_event', false, 'published');
