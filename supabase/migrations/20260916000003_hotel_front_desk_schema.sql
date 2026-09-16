-- Front Desk grid, phase A schema (read-only board — see chat for the
-- 3-phase plan; phase C, drag-and-drop reschedule, deliberately routes
-- through the existing advisory-lock allocator rather than a raw date
-- UPDATE, and is NOT part of this migration).

-- ----------------------------------------------------------------------------
-- Room disable dates — a room out of service for a date range, with a
-- reason (maintenance, etc). This replaces the plan to reuse
-- hotel_room_units.status as a standing on/off flag for this purpose: the
-- reference flow disables a room for a *range*, not indefinitely, and a
-- room can have several non-overlapping disabled ranges over time (repeat
-- maintenance) that a single status column can't represent. status stays
-- for a genuinely standing state (a room pulled from service entirely);
-- this table is for scheduled unavailability.
-- ----------------------------------------------------------------------------
create table public.hotel_room_disable_dates (
  id uuid primary key default gen_random_uuid(),
  room_unit_id uuid not null references public.hotel_room_units (id) on delete cascade,
  date_start date not null,
  date_end date not null,
  reason text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (date_end >= date_start)
);

create index hotel_room_disable_dates_unit_idx on public.hotel_room_disable_dates (room_unit_id, date_start, date_end);

alter table public.hotel_room_disable_dates enable row level security;

create policy "hotel_room_disable_dates: public reads"
  on public.hotel_room_disable_dates for select
  using (true);

create policy "hotel_room_disable_dates: admin manages"
  on public.hotel_room_disable_dates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "hotel_room_disable_dates: partner manages own"
  on public.hotel_room_disable_dates for all to authenticated
  using (exists (
    select 1 from public.hotel_room_units u
    join public.hotels h on h.id = u.hotel_id
    where u.id = room_unit_id and public.is_hotel_partner_member(h.partner_id)
  ))
  with check (exists (
    select 1 from public.hotel_room_units u
    join public.hotels h on h.id = u.hotel_id
    where u.id = room_unit_id and public.is_hotel_partner_member(h.partner_id)
  ));

create policy "hotel_room_disable_dates: manager writes when permitted"
  on public.hotel_room_disable_dates for all to authenticated
  using (exists (
    select 1 from public.hotel_room_units u
    where u.id = room_unit_id and public.hotel_manager_has_permission(u.hotel_id, 'rooms')
  ))
  with check (exists (
    select 1 from public.hotel_room_units u
    where u.id = room_unit_id and public.hotel_manager_has_permission(u.hotel_id, 'rooms')
  ));

-- ----------------------------------------------------------------------------
-- Stop Room Move — a manually-assigned room that should not be swept up by
-- a future reallocation pass. Lives on the assignment row, not the booking:
-- it describes "don't move this specific room out from under this booking",
-- which only means something once a room has actually been assigned.
-- ----------------------------------------------------------------------------
alter table public.hotel_booking_room_units
  add column locked boolean not null default false;
