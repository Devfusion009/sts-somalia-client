-- ============================================================================
-- Hall bookings: real multi-day date ranges + an anonymized cross-agency
-- occupancy check for the agent portal's event calendar.
--
-- hall_bookings previously stored a single `event_date` — no way to
-- represent a multi-day event (e.g. a 3-day wedding: setup, event,
-- teardown). Renamed to start_date/end_date (end_date = start_date for
-- every existing row, so this is a lossless backfill).
-- ============================================================================

alter table public.hall_bookings rename column event_date to start_date;
alter table public.hall_bookings add column end_date date;
update public.hall_bookings set end_date = start_date;
alter table public.hall_bookings alter column end_date set not null;
alter table public.hall_bookings add constraint hall_bookings_date_range_check check (end_date >= start_date);

drop index if exists public.hall_bookings_venue_idx;
create index hall_bookings_venue_idx on public.hall_bookings (venue_id, start_date, end_date);

-- ----------------------------------------------------------------------------
-- Cross-agency availability, without leaking cross-agency data.
-- Normal RLS ("hall_bookings: reads via ownership/agency/admin") scopes an
-- agent to their OWN agency's bookings only — by design, so one agency can
-- never see another's customer names, event details, or pricing. But that
-- also means an agent has no way to know a venue is already booked by a
-- DIFFERENT agency on a given date, short of their own booking attempt
-- getting rejected. This function is the deliberate, narrow exception: it
-- returns only start_date/end_date/status for a venue's active bookings —
-- never customer_id, event_name, agency_id, or price — so any authenticated
-- user can check "is this date free" without seeing whose booking it is.
-- ----------------------------------------------------------------------------
create or replace function public.get_venue_occupied_ranges(
  target_venue_id uuid,
  from_date date,
  to_date date
)
returns table (start_date date, end_date date, status public.booking_status)
language sql
security definer
stable
set search_path = public
as $$
  select hb.start_date, hb.end_date, hb.status
  from public.hall_bookings hb
  where hb.venue_id = target_venue_id
    and hb.status in ('pending', 'confirmed')
    and hb.start_date <= to_date
    and hb.end_date >= from_date;
$$;

grant execute on function public.get_venue_occupied_ranges(uuid, date, date) to authenticated;
