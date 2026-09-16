-- Hotel amenities as a real taxonomy, not a flat jsonb string array — the
-- QloApps hotel-management flow this ports from (htl_amenity) models
-- amenities as a parent/child tree (e.g. "General" > "Free WiFi") assignable
-- at both the hotel level and the room-type level, admin-managed rather than
-- a hardcoded constant. This is Phase 1 of that port (see chat) — later
-- phases: refund-rule policies, room-type -> individual numbered rooms,
-- date/feature-based rate rules, guest registration card at booking.
--
-- The existing hotels.amenities / hotel_rooms.amenities jsonb columns are
-- left in place (10 existing consumers read them) rather than dropped in
-- the same migration that introduces their replacement — a live schema
-- change and a full call-site rewrite in one commit is how the deploy broke
-- earlier this session. They become dead weight once every consumer is
-- migrated to the tables below, tracked as its own follow-up.

create table public.amenities (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.amenities (id) on delete cascade,
  -- Which entity this amenity can be attached to. 'both' covers the common
  -- case (e.g. "Free WiFi" makes sense on a hotel and on a single room).
  scope text not null default 'both' check (scope in ('hotel', 'room_type', 'both')),
  name text not null,
  icon text,
  position smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index amenities_parent_idx on public.amenities (parent_id);

create trigger set_amenities_updated_at
  before update on public.amenities
  for each row execute function public.set_updated_at();

create table public.hotel_amenities (
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  amenity_id uuid not null references public.amenities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (hotel_id, amenity_id)
);

create table public.hotel_room_amenities (
  room_id uuid not null references public.hotel_rooms (id) on delete cascade,
  amenity_id uuid not null references public.amenities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (room_id, amenity_id)
);

-- ----------------------------------------------------------------------------
-- RLS — amenities are a shared catalog (admin-managed, publicly readable,
-- same shape as visa_types: everyone reads active rows, only admin writes).
-- The junction tables follow the same ownership as the row they attach to:
-- readable wherever the hotel/room itself is readable, writable by admin or
-- the owning partner (mirrors hotel_rooms' own policies below).
-- ----------------------------------------------------------------------------
alter table public.amenities enable row level security;
alter table public.hotel_amenities enable row level security;
alter table public.hotel_room_amenities enable row level security;

create policy "amenities: public reads active"
  on public.amenities for select
  using (active or public.is_admin());

create policy "amenities: admin manage"
  on public.amenities for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Same ownership shape as hotel_rooms' own policies (is_hotel_partner_member,
-- is_hotel_manager + hotel_manager_has_permission) — reusing those existing
-- functions rather than inventing a new ownership check for this table.
create policy "hotel_amenities: public reads"
  on public.hotel_amenities for select
  using (true);

create policy "hotel_amenities: admin manages"
  on public.hotel_amenities for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "hotel_amenities: partner manages own"
  on public.hotel_amenities for all to authenticated
  using (exists (
    select 1 from public.hotels h
    where h.id = hotel_id and public.is_hotel_partner_member(h.partner_id)
  ))
  with check (exists (
    select 1 from public.hotels h
    where h.id = hotel_id and public.is_hotel_partner_member(h.partner_id)
  ));

create policy "hotel_amenities: manager writes when permitted"
  on public.hotel_amenities for all to authenticated
  using (public.hotel_manager_has_permission(hotel_id, 'rooms'))
  with check (public.hotel_manager_has_permission(hotel_id, 'rooms'));

create policy "hotel_room_amenities: public reads"
  on public.hotel_room_amenities for select
  using (true);

create policy "hotel_room_amenities: admin manages"
  on public.hotel_room_amenities for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "hotel_room_amenities: partner manages own"
  on public.hotel_room_amenities for all to authenticated
  using (exists (
    select 1 from public.hotel_rooms r
    join public.hotels h on h.id = r.hotel_id
    where r.id = room_id and public.is_hotel_partner_member(h.partner_id)
  ))
  with check (exists (
    select 1 from public.hotel_rooms r
    join public.hotels h on h.id = r.hotel_id
    where r.id = room_id and public.is_hotel_partner_member(h.partner_id)
  ));

create policy "hotel_room_amenities: manager writes when permitted"
  on public.hotel_room_amenities for all to authenticated
  using (exists (
    select 1 from public.hotel_rooms r
    where r.id = room_id and public.hotel_manager_has_permission(r.hotel_id, 'rooms')
  ))
  with check (exists (
    select 1 from public.hotel_rooms r
    where r.id = room_id and public.hotel_manager_has_permission(r.hotel_id, 'rooms')
  ));

-- ----------------------------------------------------------------------------
-- Seed: a starter tree so the admin tree-picker isn't empty on first load.
-- Room-level entries carry over the existing ROOM_AMENITIES constant
-- (modules/hotels/constants.ts) so nothing customers already see regresses;
-- hotel-level entries are the common property-wide amenities QloApps ships
-- (htl_amenity default data) that this schema had no place for at all.
-- ----------------------------------------------------------------------------
with parents as (
  insert into public.amenities (name, scope, position) values
    ('General', 'both', 0),
    ('Room comfort', 'room_type', 1),
    ('Property facilities', 'hotel', 2),
    ('Accessibility', 'both', 3)
  returning id, name
)
insert into public.amenities (parent_id, name, scope, position)
select p.id, v.name, v.scope, v.position
from (values
  ('General', 'Free WiFi', 'both', 0),
  ('General', 'Air conditioning', 'both', 1),
  ('General', 'Non-smoking', 'both', 2),
  ('General', 'Breakfast included', 'both', 3),
  ('Room comfort', 'Balcony', 'room_type', 0),
  ('Room comfort', 'Sea view', 'room_type', 1),
  ('Room comfort', 'City view', 'room_type', 2),
  ('Room comfort', 'Garden view', 'room_type', 3),
  ('Room comfort', 'Private bathroom', 'room_type', 4),
  ('Room comfort', 'Minibar', 'room_type', 5),
  ('Room comfort', 'Safe box', 'room_type', 6),
  ('Room comfort', 'Flat-screen TV', 'room_type', 7),
  ('Room comfort', 'Work desk', 'room_type', 8),
  ('Room comfort', 'Bathtub', 'room_type', 9),
  ('Room comfort', 'Connecting rooms', 'room_type', 10),
  ('Room comfort', 'Kitchenette', 'room_type', 11),
  ('Room comfort', 'Soundproofing', 'room_type', 12),
  ('Property facilities', 'Swimming pool', 'hotel', 0),
  ('Property facilities', 'Fitness center', 'hotel', 1),
  ('Property facilities', 'Restaurant', 'hotel', 2),
  ('Property facilities', 'Free parking', 'hotel', 3),
  ('Property facilities', 'Airport shuttle', 'hotel', 4),
  ('Property facilities', 'Laundry service', 'hotel', 5),
  ('Property facilities', '24-hour front desk', 'hotel', 6),
  ('Property facilities', 'Conference room', 'hotel', 7),
  ('Accessibility', 'Wheelchair accessible', 'both', 0)
) as v(parent_name, name, scope, position)
join parents p on p.name = v.parent_name;
