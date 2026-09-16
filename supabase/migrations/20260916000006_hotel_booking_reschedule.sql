-- Front Desk phase D: safe date editing / drag-to-reschedule.
--
-- The blocker flagged in every earlier front-desk migration: hotel_bookings'
-- capacity allocator (hotel_bookings_before_insert / _allocate_hotel_booking)
-- only runs on INSERT, so a raw UPDATE of check_in/check_out bypasses
-- capacity checking and displacement entirely. Reimplementing that logic
-- separately would be a second place for it to drift from the real one.
--
-- Instead: _allocate_hotel_booking already takes a whole hotel_bookings row
-- and, via hotel_room_nights' p_exclude_booking parameter, already excludes
-- that row's OWN id from the capacity count it's checking against — which
-- means it's already safe to call with a *candidate* version of an existing
-- booking (same id, proposed new dates) to ask "if this booking moved here,
-- would it fit" without double-counting the booking against itself. This
-- reuses that exact function; it does not reimplement allocation.
create or replace function public.reschedule_hotel_booking(
  p_booking_id uuid,
  p_new_check_in date,
  p_new_check_out date
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_booking hotel_bookings;
  v_candidate hotel_bookings;
  v_outcome text;
begin
  if p_new_check_out <= p_new_check_in then
    raise exception 'check-out date must be after check-in date';
  end if;

  select * into v_booking from hotel_bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking not found';
  end if;
  if v_booking.status not in ('pending', 'confirmed') then
    raise exception 'only a pending or confirmed booking can be rescheduled';
  end if;

  if v_booking.check_in = p_new_check_in and v_booking.check_out = p_new_check_out then
    return 'reserved';
  end if;

  v_candidate := v_booking;
  v_candidate.check_in := p_new_check_in;
  v_candidate.check_out := p_new_check_out;

  -- Runs the exact same advisory-locked capacity check + displacement plan
  -- a fresh insert would, scoped to v_booking.room_id, excluding
  -- v_booking's own id from what it competes against.
  v_outcome := public._allocate_hotel_booking(v_candidate);

  if v_outcome <> 'reserved' then
    raise exception 'not enough rooms available for those dates';
  end if;

  update hotel_bookings
     set check_in = p_new_check_in,
         check_out = p_new_check_out,
         allocated_at = now()
   where id = p_booking_id;

  return v_outcome;
end;
$$;

revoke execute on function public.reschedule_hotel_booking(uuid, date, date) from public, anon;
grant execute on function public.reschedule_hotel_booking(uuid, date, date) to authenticated;
