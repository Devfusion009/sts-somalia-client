-- Front desk / room-status board (QloApps port, phase 3 — see chat history
-- on the amenities-tree migration for phases 1-2 and the remaining roadmap).
--
-- hotel_rooms is a ROOM TYPE (name, base_price, total_units as a plain
-- count) and hotel_room_inventory is per-date COUNT availability — that
-- pair is the proven, concurrency-tested B2B-over-B2C allocator and this
-- migration does not touch either. A front desk board needs a different
-- thing: which PHYSICAL room (GR-101, floor 3) is a given booking actually
-- in, and whether that physical room is usable at all right now (Out of
-- Order). That's additive identity + assignment on top of the existing
-- count model, not a replacement of it — a booking still reserves a count
-- against hotel_room_inventory the same way it always has; assigning it to
-- a specific numbered room is a separate, later, front-desk action (the
-- "Reallocate/Swap" button), same relationship QloApps itself has between
-- booking a room TYPE and assigning a physical room.
--
-- ----------------------------------------------------------------------------
-- 1) Physical rooms — the "input rooms with floors" step
-- ----------------------------------------------------------------------------
create type public.hotel_room_unit_status as enum ('active', 'out_of_order', 'inactive');

create table public.hotel_room_units (
  id uuid primary key default gen_random_uuid(),
  room_type_id uuid not null references public.hotel_rooms (id) on delete cascade,
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  room_number text not null,
  floor text,
  status public.hotel_room_unit_status not null default 'active',
  out_of_order_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, room_number)
);

create index hotel_room_units_room_type_idx on public.hotel_room_units (room_type_id);
create index hotel_room_units_hotel_idx on public.hotel_room_units (hotel_id);

create trigger set_hotel_room_units_updated_at
  before update on public.hotel_room_units
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2) Physical check-in/check-out — a front-desk action, distinct from
-- booking.status (payment/confirmation state). A booking can be 'confirmed'
-- for a week before the guest physically walks in; the front desk board's
-- Check-in / Occupied / Due Out / Check-out states are computed from these
-- timestamps plus check_in/check_out dates, not stored as a status enum,
-- so they can never drift out of sync with the dates they describe.
-- ----------------------------------------------------------------------------
alter table public.hotel_bookings
  add column checked_in_at timestamptz,
  add column checked_out_at timestamptz;

-- ----------------------------------------------------------------------------
-- 3) Which physical unit(s) a booking sits in. Nullable and separate from
-- the booking row itself: num_rooms can be > 1 (one booking, several units
-- of the same type), and a booking is valid — reserved, payable, confirmable
-- — before any physical room is assigned to it at all.
-- ----------------------------------------------------------------------------
create table public.hotel_booking_room_units (
  booking_id uuid not null references public.hotel_bookings (id) on delete cascade,
  room_unit_id uuid not null references public.hotel_room_units (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles (id),
  primary key (booking_id, room_unit_id)
);

create index hotel_booking_room_units_unit_idx on public.hotel_booking_room_units (room_unit_id);

-- ----------------------------------------------------------------------------
-- 4) Front-desk display status for one booking, as of a given date — the
-- exact seven states requested: reserved, confirmed_reserved, check_in,
-- occupied, due_out, check_out, plus the room-level out_of_order (which is
-- a hotel_room_units.status, not a booking state, and is folded in by the
-- caller — see get_hotel_front_desk_board below).
-- ----------------------------------------------------------------------------
create or replace function public.hotel_booking_front_desk_status(
  p_status public.booking_status,
  p_check_in date,
  p_check_out date,
  p_checked_in_at timestamptz,
  p_checked_out_at timestamptz,
  p_as_of date default current_date
)
returns text
language sql
immutable
as $$
  select case
    when p_status not in ('pending', 'confirmed') then null
    when p_checked_out_at is not null then 'check_out'
    when p_checked_in_at is not null and p_as_of >= p_check_out then 'due_out'
    when p_checked_in_at is not null then 'occupied'
    when p_status = 'pending' then 'reserved'
    when p_as_of >= p_check_in then 'check_in'
    else 'confirmed_reserved'
  end;
$$;

-- ----------------------------------------------------------------------------
-- RLS — same ownership shape as hotel_rooms/hotel_bookings throughout this
-- schema (admin, owning partner via is_hotel_partner_member, hotel manager
-- via hotel_manager_has_permission).
-- ----------------------------------------------------------------------------
alter table public.hotel_room_units enable row level security;
alter table public.hotel_booking_room_units enable row level security;

create policy "hotel_room_units: admin manages"
  on public.hotel_room_units for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "hotel_room_units: partner manages own"
  on public.hotel_room_units for all to authenticated
  using (public.is_hotel_partner_member((select partner_id from public.hotels where id = hotel_id)))
  with check (public.is_hotel_partner_member((select partner_id from public.hotels where id = hotel_id)));

create policy "hotel_room_units: manager reads assigned hotel"
  on public.hotel_room_units for select to authenticated
  using (public.is_hotel_manager(hotel_id));

create policy "hotel_room_units: manager writes when permitted"
  on public.hotel_room_units for all to authenticated
  using (public.hotel_manager_has_permission(hotel_id, 'rooms'))
  with check (public.hotel_manager_has_permission(hotel_id, 'rooms'));

create policy "hotel_booking_room_units: admin manages"
  on public.hotel_booking_room_units for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "hotel_booking_room_units: partner manages own hotel's bookings"
  on public.hotel_booking_room_units for all to authenticated
  using (exists (
    select 1 from public.hotel_bookings b
    where b.id = booking_id and public.is_hotel_partner_member(
      (select partner_id from public.hotels where id = b.hotel_id)
    )
  ))
  with check (exists (
    select 1 from public.hotel_bookings b
    where b.id = booking_id and public.is_hotel_partner_member(
      (select partner_id from public.hotels where id = b.hotel_id)
    )
  ));

create policy "hotel_booking_room_units: manager manages when permitted"
  on public.hotel_booking_room_units for all to authenticated
  using (exists (
    select 1 from public.hotel_bookings b
    where b.id = booking_id and public.hotel_manager_has_permission(b.hotel_id, 'bookings')
  ))
  with check (exists (
    select 1 from public.hotel_bookings b
    where b.id = booking_id and public.hotel_manager_has_permission(b.hotel_id, 'bookings')
  ));
