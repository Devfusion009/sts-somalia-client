-- ============================================================================
-- Admin-authored calendar events (meetings, tasks) — distinct from
-- hall_bookings/hotel_bookings/etc, which are customer bookings the admin
-- Booking Calendar only reads. This is admin's OWN schedule: "agency owner
-- meeting", personal reminders, anything with a start/end time and an
-- optional reminder before it starts.
-- ============================================================================

create table public.admin_calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reminder_minutes_before integer check (reminder_minutes_before >= 0),
  reminder_sent_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_calendar_events_time_range check (end_at > start_at)
);

create index admin_calendar_events_start_idx on public.admin_calendar_events (start_at);

-- Reminder-firing sweeps for "not yet sent, due soon" — see
-- fireDueEventReminders in src/modules/admin/calendar-reminders.ts.
create index admin_calendar_events_pending_reminder_idx
  on public.admin_calendar_events (start_at)
  where reminder_sent_at is null and reminder_minutes_before is not null;

create trigger set_admin_calendar_events_updated_at
  before update on public.admin_calendar_events
  for each row execute function public.set_updated_at();

alter table public.admin_calendar_events enable row level security;

-- Admin-only in every direction — this is the operator console's own
-- schedule, never customer-facing, so there's no public/agency read policy
-- the way bookings or venues have.
create policy "admin_calendar_events: admin manage"
  on public.admin_calendar_events for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
