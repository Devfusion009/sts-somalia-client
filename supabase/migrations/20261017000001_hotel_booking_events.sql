-- Per-booking activity log for the hotel booking detail page: who moved the
-- booking, when. Written only by triggers, so every path (admin queue,
-- partner console, manager portal, front desk, payment webhooks) is recorded
-- without each action having to remember to log.

create table public.hotel_booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.hotel_bookings (id) on delete cascade,
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  kind text not null check (kind in ('created', 'status', 'check_in', 'check_out', 'payment', 'rescheduled', 'room_assigned')),
  from_value text,
  to_value text,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index hotel_booking_events_booking_idx on public.hotel_booking_events (booking_id, created_at);
create index hotel_booking_events_hotel_idx on public.hotel_booking_events (hotel_id, created_at desc);

alter table public.hotel_booking_events enable row level security;

create policy "hotel_booking_events: admin reads"
  on public.hotel_booking_events for select to authenticated
  using (public.is_admin());

create policy "hotel_booking_events: partner reads own hotels"
  on public.hotel_booking_events for select to authenticated
  using (public.is_hotel_partner_member((select partner_id from public.hotels where id = hotel_id)));

create policy "hotel_booking_events: manager reads assigned hotel"
  on public.hotel_booking_events for select to authenticated
  using (public.is_hotel_manager(hotel_id));

create or replace function public.log_hotel_booking_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into hotel_booking_events (booking_id, hotel_id, kind, to_value, actor_id)
    values (new.id, new.hotel_id, 'created', new.status::text, v_actor);
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into hotel_booking_events (booking_id, hotel_id, kind, from_value, to_value, actor_id)
    values (new.id, new.hotel_id, 'status', old.status::text, new.status::text, v_actor);
  end if;

  if new.checked_in_at is not null and old.checked_in_at is null then
    insert into hotel_booking_events (booking_id, hotel_id, kind, actor_id)
    values (new.id, new.hotel_id, 'check_in', v_actor);
  end if;

  if new.checked_out_at is not null and old.checked_out_at is null then
    insert into hotel_booking_events (booking_id, hotel_id, kind, actor_id)
    values (new.id, new.hotel_id, 'check_out', v_actor);
  end if;

  if new.paid_at is not null and old.paid_at is null then
    insert into hotel_booking_events (booking_id, hotel_id, kind, to_value, actor_id)
    values (new.id, new.hotel_id, 'payment', new.payment_method, v_actor);
  end if;

  if new.check_in is distinct from old.check_in or new.check_out is distinct from old.check_out then
    insert into hotel_booking_events (booking_id, hotel_id, kind, from_value, to_value, actor_id)
    values (
      new.id, new.hotel_id, 'rescheduled',
      old.check_in::text || ' to ' || old.check_out::text,
      new.check_in::text || ' to ' || new.check_out::text,
      v_actor
    );
  end if;

  return new;
end;
$$;

create trigger hotel_bookings_log_events
  after insert or update on public.hotel_bookings
  for each row execute function public.log_hotel_booking_events();

create or replace function public.log_hotel_booking_room_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hotel uuid;
  v_room text;
begin
  select u.hotel_id, u.room_number into v_hotel, v_room
  from hotel_room_units u
  where u.id = new.room_unit_id;

  insert into hotel_booking_events (booking_id, hotel_id, kind, to_value, actor_id)
  values (new.booking_id, v_hotel, 'room_assigned', v_room, auth.uid());
  return new;
end;
$$;

create trigger hotel_booking_room_units_log_assigned
  after insert on public.hotel_booking_room_units
  for each row execute function public.log_hotel_booking_room_assigned();

-- Seed one 'created' row per existing booking so older bookings show a start of history.
insert into public.hotel_booking_events (booking_id, hotel_id, kind, to_value, created_at)
select id, hotel_id, 'created', status::text, created_at
from public.hotel_bookings;
