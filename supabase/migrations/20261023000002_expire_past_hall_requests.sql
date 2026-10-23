-- Hall requests whose event date has passed are closed instead of waiting forever.
--
-- Found in live QA (2026-10-23): pending requests dated 19 and 22 Oct still sat
-- in the admin queue as "New request" days later, and a pending request keeps
-- its slot held. No cron runs on the AWS deploy, so the desks call this when
-- they load: one venue for its manager or owning partner, every venue for admin.
-- Cancelling runs the existing triggers: the unpaid order is closed and the
-- client is told.

create or replace function public.expire_past_hall_requests(p_venue_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner uuid;
  v_count integer;
begin
  if p_venue_id is null then
    if not public.is_admin() then
      return 0;
    end if;
  else
    select partner_id into v_partner from public.event_venues where id = p_venue_id;
    if not (
      public.is_admin()
      or public.is_venue_manager(p_venue_id)
      or (v_partner is not null and public.is_venue_partner_member(v_partner))
    ) then
      return 0;
    end if;
  end if;

  update public.hall_bookings
     set status = 'cancelled'
   where status in ('pending', 'waitlisted')
     and end_date < current_date
     and (p_venue_id is null or venue_id = p_venue_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_past_hall_requests(uuid) from public, anon;
grant execute on function public.expire_past_hall_requests(uuid) to authenticated;

-- Moving or confirming into a taken slot: same allocator check, readable dates
-- ("10 Dec 2026", not "2026-12-10") since this message reaches the screen.
create or replace function public.hall_bookings_before_slot_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  outcome text;
begin
  if public.hall_booking_holds_venue(new.status)
     and (
       not public.hall_booking_holds_venue(old.status)
       or new.start_date is distinct from old.start_date
       or new.end_date is distinct from old.end_date
       or new.start_time is distinct from old.start_time
       or new.end_time is distinct from old.end_time
     ) then
    outcome := public._allocate_hall_booking(new);
    if outcome = 'blocked' then
      raise exception using errcode = 'P0001', message = 'These dates are blocked at this venue.';
    elsif outcome <> 'reserved' then
      raise exception using
        errcode = 'P0001',
        message = case
          when new.start_date = new.end_date then format('This venue is already booked on %s.', to_char(new.start_date, 'FMDD Mon YYYY'))
          else format('This venue is already booked between %s and %s.', to_char(new.start_date, 'FMDD Mon YYYY'), to_char(new.end_date, 'FMDD Mon YYYY'))
        end;
    end if;
    new.allocated_at := now();
    new.displaced_by := null;
    new.displaced_at := null;
  end if;
  return new;
end;
$$;
