-- ============================================================================
-- Shared room-type catalog. hotel_rooms.name stays free text (unchanged) —
-- this is a suggestion list, not a foreign key: the admin room form offers
-- it via a combobox (pick a listed type, or type a new one), and saving a
-- room with a name not yet in the list adds it here so it's offered on every
-- other hotel from then on. citext gives case-insensitive uniqueness
-- ("Deluxe Room" and "deluxe room" are the same type) — same pattern this
-- codebase already uses for email columns.
-- ============================================================================

create table public.hotel_room_types (
  id uuid primary key default gen_random_uuid(),
  name citext not null unique,
  created_at timestamptz not null default now()
);

alter table public.hotel_room_types enable row level security;

create policy "hotel_room_types: anyone reads"
  on public.hotel_room_types for select to anon, authenticated
  using (true);

create policy "hotel_room_types: admin manage"
  on public.hotel_room_types for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into public.hotel_room_types (name) values
  ('Standard Room'), ('Deluxe Room'), ('Superior Room'), ('Executive Room'),
  ('Family Room'), ('Single Room'), ('Twin Room'), ('Triple/Quad Room'),
  ('Junior Suite'), ('Suite'), ('Presidential Suite'),
  ('Villa'), ('Bungalow/Cottage'), ('Ocean View Room'), ('Garden View Room'), ('Pool View Room'),
  ('Economy Room'), ('Dormitory/Shared Room'), ('Accessible Room');
