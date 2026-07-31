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
  ('JED', 'OEJN', 'King Abdulaziz International Airport', 'Jeddah', 'SA', 'Asia/Riyadh'),
  ('MED', 'OEMA', 'Prince Mohammad Bin Abdulaziz Airport', 'Medina', 'SA', 'Asia/Riyadh')
on conflict (iata_code) do nothing;

insert into public.airlines (iata_code, icao_code, name) values
  ('TK', 'THY', 'Turkish Airlines'),
  ('EK', 'UAE', 'Emirates'),
  ('QR', 'QTR', 'Qatar Airways'),
  ('ET', 'ETH', 'Ethiopian Airlines'),
  ('SV', 'SVA', 'Saudia')
on conflict (iata_code) do nothing;

insert into public.visa_types (destination_country_code, name, description, processing_days_min, processing_days_max, price, currency, required_documents, status) values
  ('AE', 'UAE Tourist e-Visa', '30-day single entry tourist visa', 3, 5, 95.00, 'USD', '["passport_scan","photo"]', 'published'),
  ('TR', 'Turkey e-Visa', 'Single entry e-Visa for Turkey', 1, 3, 60.00, 'USD', '["passport_scan"]', 'published'),
  ('SA', 'Saudi Arabia Umrah Visa', 'Umrah pilgrimage visa', 5, 10, 150.00, 'USD', '["passport_scan","photo","vaccination_certificate"]', 'published')
on conflict do nothing;

-- Demo hotel partner + hotel + rooms (created_by left null; no auth user needed)
with partner as (
  insert into public.hotel_partners (name, contact_email, status)
  values ('Banadir Hospitality Group', 'partners@banadirhospitality.example', 'active')
  returning id
),
hotel as (
  insert into public.hotels (partner_id, name, slug, description, star_rating, city, country_code, status)
  select id, 'Mogadishu Beach Hotel', 'mogadishu-beach-hotel', 'Seafront hotel in Mogadishu with conference facilities.', 4, 'Mogadishu', 'SO', 'published'::public.listing_status
  from partner
  returning id
)
insert into public.hotel_rooms (hotel_id, name, description, max_occupancy, base_price, currency, status)
select id, 'Deluxe Double Room', 'Double room with sea view.', 2, 120.00, 'USD', 'published'::public.listing_status from hotel
union all
select id, 'Executive Suite', 'Suite with separate living area.', 3, 220.00, 'USD', 'published'::public.listing_status from hotel;

-- Demo Umrah package with an upcoming departure
with package as (
  insert into public.umrah_packages (name, slug, description, duration_days, includes, base_price, currency, status)
  values (
    '14-Day Premium Umrah Package',
    '14-day-premium-umrah',
    'Flights, 5-star hotels in Makkah & Madinah, visa, and guided ziyarat.',
    14,
    '["flights","visa","hotel","transport","ziyarat_tours"]',
    1850.00,
    'USD',
    'published'
  )
  returning id
)
insert into public.umrah_package_departures (package_id, departure_date, return_date, total_seats)
select id, current_date + 45, current_date + 59, 40 from package;
