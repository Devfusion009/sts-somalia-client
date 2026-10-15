-- A new booking the allocator can't seat is refused, not waitlisted.
--
-- Before: an insert for more rooms than a room type has left (or a hall slot
-- already taken) came back as status 'waitlisted', so a customer could
-- request 18 rooms of an 8-room type and the order still went through to the
-- admin queue. Now the insert itself raises with the rooms actually left,
-- the order is never created, and the form shows the message.
--
-- Unchanged: an agency (B2B) request still displaces newer, unpaid pending
-- customer requests when that fully seats it — those displaced bookings are
-- the only way a row becomes 'waitlisted' from here on. Promoting a
-- waitlisted row still re-runs the allocator (before_status_change /
-- before_slot_change).

create or replace function public.hotel_bookings_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_left integer;
begin
  new.channel := case when new.agency_id is not null then 'b2b' else 'b2c' end;
  new.priority := case when new.channel = 'b2b' then 0 else 1 end;
  new.displaced_by := null;
  new.displaced_at := null;

  if public.hotel_booking_holds_units(new.status) then
    if public._allocate_hotel_booking(new) = 'reserved' then
      new.allocated_at := now();
    else
      select coalesce(min(greatest(n.capacity - n.booked, 0)), 0)
        into v_left
        from public.hotel_room_nights(new.room_id, new.check_in, new.check_out, new.id) n
       where n.capacity is not null;

      if v_left = 0 then
        raise exception using
          errcode = 'P0001',
          message = 'No rooms of this type are available for these dates.',
          hint = 'rooms_unavailable';
      end if;
      raise exception using
        errcode = 'P0001',
        message = format(
          'Only %s room%s of this type left for these dates.',
          v_left, case when v_left = 1 then '' else 's' end
        ),
        hint = 'rooms_unavailable';
    end if;
  else
    new.allocated_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.hall_bookings_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  booker record;
  outcome text;
begin
  new.channel := case when new.agency_id is not null then 'b2b' else 'b2c' end;
  new.priority := case when new.channel = 'b2b' then 0 else 1 end;
  new.displaced_by := null;
  new.displaced_at := null;

  if new.contact_name is null then
    select full_name, phone, email into booker from public.profiles where id = new.customer_id;
    new.contact_name := booker.full_name;
    new.contact_phone := coalesce(new.contact_phone, left(booker.phone, 30));
    new.contact_email := coalesce(new.contact_email, left(booker.email::text, 160));
  end if;

  if public.hall_booking_holds_venue(new.status) then
    outcome := public._allocate_hall_booking(new);
    if outcome = 'blocked' then
      raise exception using
        errcode = 'P0001',
        message = 'This venue is not available on these dates.',
        hint = 'venue_unavailable';
    elsif outcome <> 'reserved' then
      raise exception using
        errcode = 'P0001',
        message = 'This venue is already booked for these dates.',
        hint = 'venue_unavailable';
    end if;
    new.allocated_at := now();
  else
    new.allocated_at := null;
  end if;
  return new;
end;
$$;
