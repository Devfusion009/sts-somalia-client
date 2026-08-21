-- ============================================================================
-- Hotel & venue "professional listing" fields the admin management UI needs
-- (check-in/out, policies, a direct contact email) plus partner booking
-- notifications — nothing currently tells a hotel/venue partner's team that
-- a booking landed on their property; STS admins already get one via
-- notify_admins_new_order (20260815000002), this mirrors that shape.
-- ============================================================================

alter table public.hotels
  add column check_in_time time,
  add column check_out_time time,
  add column policies text,
  add column contact_email text;

alter table public.event_venues
  add column policies text,
  add column contact_email text;

-- ----------------------------------------------------------------------------
-- Partner notification on new booking. Skipped when partner_id is null —
-- that's an STS-managed property, and STS admins are already notified via
-- the order-insert trigger; there's no separate partner team to tell.
-- ----------------------------------------------------------------------------
create or replace function public.notify_partner_new_hotel_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owning_partner_id uuid;
  hotel_name text;
begin
  select h.partner_id, h.name into owning_partner_id, hotel_name
  from public.hotels h where h.id = new.hotel_id;

  if owning_partner_id is null then
    return new;
  end if;

  insert into public.notifications (profile_id, type, title, body, data)
  select m.profile_id,
         'new_booking',
         'New booking — ' || hotel_name,
         'A guest booked ' || new.num_rooms || ' room(s), ' || new.check_in || ' to ' || new.check_out || '.',
         jsonb_build_object('hotel_booking_id', new.id, 'hotel_id', new.hotel_id)
  from public.hotel_partner_members m
  where m.partner_id = owning_partner_id and m.status = 'active';

  return new;
end;
$$;

create trigger hotel_bookings_notify_partner
  after insert on public.hotel_bookings
  for each row execute function public.notify_partner_new_hotel_booking();

create or replace function public.notify_partner_new_hall_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owning_partner_id uuid;
  venue_name text;
begin
  select v.partner_id, v.name into owning_partner_id, venue_name
  from public.event_venues v where v.id = new.venue_id;

  if owning_partner_id is null then
    return new;
  end if;

  insert into public.notifications (profile_id, type, title, body, data)
  select m.profile_id,
         'new_booking',
         'New booking — ' || venue_name,
         'A booking request for ' || new.event_type || ' on ' || new.start_date || ' was placed.',
         jsonb_build_object('hall_booking_id', new.id, 'venue_id', new.venue_id)
  from public.venue_partner_members m
  where m.partner_id = owning_partner_id and m.status = 'active';

  return new;
end;
$$;

create trigger hall_bookings_notify_partner
  after insert on public.hall_bookings
  for each row execute function public.notify_partner_new_hall_booking();
