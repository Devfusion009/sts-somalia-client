-- A fully-configured demo hotel — real location, three priced/counted room
-- types, a real photo gallery — and the demo hotel manager account
-- (20260903000008) moved onto it.
--
-- Ambassador Hotel Hargeisa (the manager's original assignment) has exactly
-- one room and no photos, which makes a thin walkthrough for anyone being
-- shown the Manager Portal. Bosaso hasn't had a catalog entry yet, so this
-- both fills that gap and gives the demo something worth looking at.
--
-- Images reuse an existing, already-uploaded set (Jazeera Palace Hotel's
-- gallery in the public hotel-images bucket) rather than uploading new
-- files from this migration — verified reachable on both local and hosted
-- storage before relying on it here. Reusing a real photo set for a second
-- listing is a demo-data shortcut, not something to carry into real
-- inventory.
do $$
declare
  v_hotel_id uuid := gen_random_uuid();
  v_gallery jsonb := '[
    "b464fdc3-2ec7-410a-908c-f038166a404c/photo-1.png",
    "b464fdc3-2ec7-410a-908c-f038166a404c/photo-2.png",
    "b464fdc3-2ec7-410a-908c-f038166a404c/photo-3.png",
    "b464fdc3-2ec7-410a-908c-f038166a404c/photo-4.png"
  ]'::jsonb;
begin
  insert into public.hotels (
    id, name, slug, description, star_rating, address_line, city, country_code,
    amenities, images, status, booking_mode, phone
  ) values (
    v_hotel_id,
    'Bosaso Bay Hotel',
    'bosaso-bay-hotel',
    'A modern harbourside hotel in Bosaso, the commercial gateway to Puntland.',
    4,
    'Corniche Road, Bosaso',
    'Bosaso',
    'SO',
    '["wifi", "parking", "restaurant", "air_conditioning", "front_desk_24_7", "room_service"]'::jsonb,
    v_gallery,
    'published',
    'manual',
    '+252907700000'
  );

  insert into public.hotel_rooms (
    hotel_id, name, description, max_occupancy, bed_type, amenities, images,
    base_price, currency, status, total_units
  ) values
    (v_hotel_id, 'Standard Room', 'Queen bed, harbour-facing window.',
     2, 'queen', '["wifi", "air_conditioning"]'::jsonb, v_gallery, 70, 'USD', 'published', 8),
    (v_hotel_id, 'Deluxe Room', 'King bed and a private balcony.',
     2, 'king', '["wifi", "air_conditioning", "minibar"]'::jsonb, v_gallery, 95, 'USD', 'published', 5),
    (v_hotel_id, 'Executive Suite', 'Separate living area with two queen beds.',
     4, 'queen', '["wifi", "air_conditioning", "minibar", "room_service"]'::jsonb, v_gallery, 150, 'USD', 'published', 2);

  update public.hotel_managers
  set hotel_id = v_hotel_id
  where profile_id = (select id from auth.users where email = 'demo.manager@stssomalia.com');
end $$;
