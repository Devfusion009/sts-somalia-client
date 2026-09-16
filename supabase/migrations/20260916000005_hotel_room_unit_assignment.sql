-- Front Desk phase C (careful subset — see chat for what's deliberately NOT
-- in this migration and why): Reallocate/Swap needs an atomic overlap check
-- so two bookings can never land on the same physical room on overlapping
-- nights — a plain app-side "check then insert" has a race between the two
-- steps under concurrent front-desk use, the same class of bug the existing
-- hotel_bookings capacity allocator was built to avoid at the room-type
-- level. This does the equivalent at the room-UNIT level, in one statement.
--
-- Deliberately NOT covered here: editing check_in/check_out on an existing
-- booking. hotel_bookings' capacity allocator only runs on INSERT and on
-- UPDATE OF status (confirmed by inspecting its triggers) — a raw UPDATE of
-- the date columns bypasses it entirely and does not re-validate capacity,
-- and a booking with a real order (order_items.hotel_booking_id) can't
-- safely be replaced with a new row without also repointing that link.
-- Reschedule-by-drag and date-editing stay out of scope until that's solved
-- properly, not silently.
create or replace function public.assign_hotel_booking_room_unit(
  p_booking_id uuid,
  p_room_unit_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_booking hotel_bookings;
  v_unit_hotel_id uuid;
begin
  select * into v_booking from hotel_bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking not found';
  end if;

  select hotel_id into v_unit_hotel_id from hotel_room_units where id = p_room_unit_id;
  if v_unit_hotel_id is null then
    raise exception 'room not found';
  end if;
  if v_unit_hotel_id <> v_booking.hotel_id then
    raise exception 'room belongs to a different hotel';
  end if;

  -- Lock the target unit's existing assignments so a concurrent assign
  -- can't slip in between this check and the insert below.
  perform 1 from hotel_booking_room_units bru
    join hotel_bookings b on b.id = bru.booking_id
    where bru.room_unit_id = p_room_unit_id
      and bru.booking_id <> p_booking_id
      and b.status in ('pending', 'confirmed')
      and b.check_in < v_booking.check_out
      and b.check_out > v_booking.check_in
    for update of bru;

  if found then
    raise exception 'this room is already assigned to another booking for an overlapping date';
  end if;

  delete from hotel_booking_room_units where booking_id = p_booking_id;
  insert into hotel_booking_room_units (booking_id, room_unit_id, assigned_by)
  values (p_booking_id, p_room_unit_id, auth.uid());
end;
$$;

revoke execute on function public.assign_hotel_booking_room_unit(uuid, uuid) from public, anon;
grant execute on function public.assign_hotel_booking_room_unit(uuid, uuid) to authenticated;
