-- ============================================================================
-- Venue managers and the hall booking desk.
--
-- The event-hall counterpart of the hotel manager model (20260820000003,
-- 20260823000002, 20260824000001/2, 20260903000001, 20260916000004). One
-- person runs one venue: they receive every request, confirm or decline it,
-- quote per-person prices, record walk-in / phone bookings and block dates.
--
--  1) venue_managers — (venue, person) seat with a permissions array, one
--     active venue per person, assignable by admin or the owning partner.
--  2) hall_bookings gains the offline-booking columns hotel_bookings already
--     has (source, contact, payment method / paid_at / reference) plus the
--     allocator columns (channel, priority, allocated_at, displaced_*).
--  3) venue_blocked_dates — maintenance / private-use ranges.
--  4) One allocator, serialized per venue with a transaction-scoped advisory
--     lock. A hall is a single unit: a request is seated only if nothing
--     holding the venue overlaps it. Overlap is date-based, except two
--     same-day bookings with explicit times, which may share the day when
--     their times don't overlap (morning and evening functions). Agency
--     (B2B) requests outrank customers (B2C): a B2B request displaces
--     overlapping still-pending, unpaid, online B2C requests, all or none.
--     Before this the only clash check ran app-side under the customer's own
--     RLS, which can't see anyone else's booking — it never caught a clash.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) venue_managers
-- ----------------------------------------------------------------------------
create table public.venue_managers (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.event_venues (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status public.member_status not null default 'active',
  permissions text[] not null default '{}',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (venue_id, profile_id)
);

create index venue_managers_venue_idx on public.venue_managers (venue_id);
create unique index venue_managers_one_active_venue_per_profile
  on public.venue_managers (profile_id)
  where status = 'active';

create trigger venue_managers_audit
  after insert or update or delete on public.venue_managers
  for each row execute function public.audit_log_row_change();

create function public.is_venue_manager(target_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.venue_managers
    where venue_id = target_venue_id
      and profile_id = auth.uid()
      and status = 'active'
  );
$$;

create function public.venue_manager_has_permission(target_venue_id uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.venue_managers
    where venue_id = target_venue_id
      and profile_id = auth.uid()
      and status = 'active'
      and perm = any (permissions)
  );
$$;

-- Admin, or an active member of the venue's owning partner. STS-catalog
-- venues (partner_id null) are admin-only.
create function public.can_manage_venue_managers(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.event_venues v
    where v.id = p_venue_id
      and v.partner_id is not null
      and public.is_venue_partner_member(v.partner_id)
  );
$$;

create function public.add_venue_manager(
  p_venue_id uuid,
  p_email extensions.citext,
  p_permissions text[] default '{}'
)
returns public.venue_managers
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile_id uuid;
  target_role public.app_role;
  new_row public.venue_managers;
begin
  if not public.can_manage_venue_managers(p_venue_id) then
    raise exception 'You do not have permission to assign managers for this venue.';
  end if;

  select id, role into target_profile_id, target_role from public.profiles where email = p_email;
  if target_profile_id is null then
    raise exception 'No STS account found with that email.';
  end if;

  if exists (
    select 1 from public.venue_managers where profile_id = target_profile_id and status = 'active'
  ) then
    raise exception 'This person already manages another venue. Remove them from it first.';
  end if;

  -- A removed seat on this same venue is reactivated rather than duplicated
  -- (unique (venue_id, profile_id)).
  insert into public.venue_managers (venue_id, profile_id, created_by, permissions)
  values (p_venue_id, target_profile_id, auth.uid(), p_permissions)
  on conflict (venue_id, profile_id) do update
    set status = 'active', permissions = excluded.permissions, created_by = excluded.created_by
  returning * into new_row;

  if target_role = 'customer' then
    update public.profiles set role = 'venue_manager' where id = target_profile_id;
  end if;

  return new_row;
end;
$$;

create function public.update_venue_manager_permissions(p_manager_id uuid, p_permissions text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  select venue_id into v_venue_id from public.venue_managers where id = p_manager_id;
  if v_venue_id is null then
    raise exception 'Manager not found.';
  end if;
  if not public.can_manage_venue_managers(v_venue_id) then
    raise exception 'You do not have permission to change this manager''s permissions.';
  end if;

  update public.venue_managers set permissions = p_permissions where id = p_manager_id;
end;
$$;

create function public.remove_venue_manager(p_manager_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  select venue_id into v_venue_id from public.venue_managers where id = p_manager_id;
  if v_venue_id is null then
    raise exception 'Manager not found.';
  end if;
  if not public.can_manage_venue_managers(v_venue_id) then
    raise exception 'You do not have permission to remove this manager.';
  end if;

  update public.venue_managers set status = 'removed' where id = p_manager_id;
end;
$$;

alter table public.venue_managers enable row level security;

create policy "venue_managers: authorized manage"
  on public.venue_managers for all to authenticated
  using (public.can_manage_venue_managers(venue_id))
  with check (public.can_manage_venue_managers(venue_id));

create policy "venue_managers: self reads own assignment"
  on public.venue_managers for select to authenticated
  using (profile_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Manager access to the venue itself. Row-level only: which columns a
-- 'profile' manager may change (description, address, contact, policies —
-- never name/slug/status/partner_id/pricing) is enforced by the manager
-- server action, the only writer on this path. Same trust model as
-- "hotels: manager updates profile when permitted".
-- ----------------------------------------------------------------------------
create policy "event_venues: manager reads assigned"
  on public.event_venues for select to authenticated
  using (public.is_venue_manager(id));

create policy "event_venues: manager updates when permitted"
  on public.event_venues for update to authenticated
  using (public.venue_manager_has_permission(id, 'profile') or public.venue_manager_has_permission(id, 'photos'))
  with check (public.venue_manager_has_permission(id, 'profile') or public.venue_manager_has_permission(id, 'photos'));

create policy "property_reviews: manager reads assigned venue"
  on public.property_reviews for select to authenticated
  using (venue_id is not null and public.is_venue_manager(venue_id));

-- venue-images objects live under "<venue_id>/..." (gallery-targets.ts).
create policy "venue_images: manager writes when permitted"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'venue-images'
    and exists (
      select 1 from public.venue_managers m
      where m.venue_id::text = (storage.foldername(name))[1]
        and m.profile_id = auth.uid()
        and m.status = 'active'
        and 'photos' = any (m.permissions)
    )
  );

create policy "venue_images: manager deletes when permitted"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'venue-images'
    and exists (
      select 1 from public.venue_managers m
      where m.venue_id::text = (storage.foldername(name))[1]
        and m.profile_id = auth.uid()
        and m.status = 'active'
        and 'photos' = any (m.permissions)
    )
  );

-- ----------------------------------------------------------------------------
-- 2) hall_bookings: offline desk + allocator columns
-- ----------------------------------------------------------------------------
alter table public.hall_bookings
  add column source text not null default 'online' check (source in ('online', 'offline')),
  add column contact_name text check (char_length(contact_name) <= 120),
  add column contact_phone text check (char_length(contact_phone) <= 30),
  add column contact_email text check (char_length(contact_email) <= 160),
  add column payment_method text check (payment_method in ('cash', 'card', 'mobile_money', 'bank_transfer')),
  add column paid_at timestamptz,
  add column payment_reference text check (char_length(payment_reference) <= 120),
  add column channel text not null default 'b2c' check (channel in ('b2b', 'b2c')),
  add column priority smallint not null default 1,
  add column allocated_at timestamptz,
  -- deferrable: the allocator runs inside the BEFORE INSERT of the booking
  -- that does the displacing, so the referenced row only exists at commit.
  add column displaced_by uuid references public.hall_bookings (id) deferrable initially deferred,
  add column displaced_at timestamptz;

update public.hall_bookings set channel = 'b2b', priority = 0 where agency_id is not null;
update public.hall_bookings set allocated_at = created_at where status in ('pending', 'confirmed');

-- Contact details for bookings placed online: the manager works the desk by
-- phone, and profiles RLS doesn't let a manager read customer profiles.
update public.hall_bookings hb
   set contact_name = p.full_name,
       contact_phone = left(p.phone, 30),
       contact_email = left(p.email::text, 160)
  from public.profiles p
 where p.id = hb.customer_id
   and hb.contact_name is null;

create index hall_bookings_venue_holding_idx
  on public.hall_bookings (venue_id, start_date, end_date)
  where status in ('pending', 'confirmed');

-- ----------------------------------------------------------------------------
-- 3) Blocked dates
-- ----------------------------------------------------------------------------
create table public.venue_blocked_dates (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.event_venues (id) on delete cascade,
  date_start date not null,
  date_end date not null,
  reason text check (char_length(reason) <= 200),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (date_end >= date_start)
);

create index venue_blocked_dates_venue_idx on public.venue_blocked_dates (venue_id, date_start, date_end);

alter table public.venue_blocked_dates enable row level security;

create policy "venue_blocked_dates: admin manages"
  on public.venue_blocked_dates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "venue_blocked_dates: partner manages own"
  on public.venue_blocked_dates for all to authenticated
  using (exists (
    select 1 from public.event_venues v
    where v.id = venue_id and v.partner_id is not null and public.is_venue_partner_member(v.partner_id)
  ))
  with check (exists (
    select 1 from public.event_venues v
    where v.id = venue_id and v.partner_id is not null and public.is_venue_partner_member(v.partner_id)
  ));

create policy "venue_blocked_dates: manager reads assigned"
  on public.venue_blocked_dates for select to authenticated
  using (public.is_venue_manager(venue_id));

create policy "venue_blocked_dates: manager writes when permitted"
  on public.venue_blocked_dates for all to authenticated
  using (public.venue_manager_has_permission(venue_id, 'calendar'))
  with check (public.venue_manager_has_permission(venue_id, 'calendar'));

-- ----------------------------------------------------------------------------
-- 4) Allocator
-- ----------------------------------------------------------------------------
create function public.hall_booking_holds_venue(p_status public.booking_status)
returns boolean
language sql
immutable
as $$
  select p_status in ('pending', 'confirmed');
$$;

-- Date ranges overlap, unless both bookings are the same single day with
-- explicit times that don't overlap.
create function public.hall_slots_overlap(
  a_start date, a_end date, a_from time, a_to time,
  b_start date, b_end date, b_from time, b_to time
)
returns boolean
language sql
immutable
as $$
  select a_start <= b_end
     and b_start <= a_end
     and not (
       a_start = a_end and b_start = b_end and a_start = b_start
       and a_from is not null and a_to is not null
       and b_from is not null and b_to is not null
       and (a_to <= b_from or b_to <= a_from)
     );
$$;

-- 'reserved' | 'waitlisted' | 'blocked'. Displaces lower-priority requests
-- as a side effect when that is what seats the booking.
create function public._allocate_hall_booking(b public.hall_bookings)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_ids uuid[];
  v_venue_name text;
begin
  -- The per-venue queue: allocations for one venue run one at a time.
  perform pg_advisory_xact_lock(hashtextextended('event_venue:' || b.venue_id::text, 0));

  if exists (
    select 1 from public.venue_blocked_dates d
     where d.venue_id = b.venue_id
       and d.date_start <= b.end_date
       and d.date_end >= b.start_date
  ) then
    return 'blocked';
  end if;

  select array_agg(c.id)
    into plan_ids
    from public.hall_bookings c
   where c.venue_id = b.venue_id
     and c.id <> b.id
     and public.hall_booking_holds_venue(c.status)
     and public.hall_slots_overlap(
       b.start_date, b.end_date, b.start_time, b.end_time,
       c.start_date, c.end_date, c.start_time, c.end_time
     );

  if plan_ids is null then
    return 'reserved';
  end if;

  -- Seated only if every overlapping holder can be displaced.
  if exists (
    select 1
      from public.hall_bookings c
     where c.id = any (plan_ids)
       and not (
         c.status = 'pending'
         and c.source = 'online'
         and c.priority > b.priority
         and not exists (
           select 1
             from public.order_items oi
             join public.orders o on o.id = oi.order_id
            where oi.hall_booking_id = c.id
              and o.status in ('paid', 'partially_paid', 'processing', 'completed')
         )
       )
  ) then
    return 'waitlisted';
  end if;

  update public.hall_bookings
     set status = 'waitlisted',
         displaced_by = b.id,
         displaced_at = now(),
         allocated_at = null
   where id = any (plan_ids);

  select v.name into v_venue_name from public.event_venues v where v.id = b.venue_id;

  insert into public.notifications (profile_id, type, title, body, data)
  select distinct on (d.id, p.profile_id)
         p.profile_id,
         'booking_waitlisted',
         'Dates no longer available — ' || v_venue_name,
         'Your request for ' || v_venue_name || ' on ' || d.start_date
           || case when d.end_date <> d.start_date then ' to ' || d.end_date else '' end
           || ' is waitlisted. STS will confirm if the date frees up.',
         jsonb_build_object(
           'hall_booking_id', d.id,
           'order_id', (select oi.order_id from public.order_items oi where oi.hall_booking_id = d.id limit 1)
         )
    from public.hall_bookings d
   cross join lateral (values (d.customer_id), (d.booked_by)) as p(profile_id)
   where d.id = any (plan_ids);

  return 'reserved';
end;
$$;

revoke execute on function public._allocate_hall_booking(public.hall_bookings) from public, anon, authenticated;

create function public.hall_bookings_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  booker record;
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
    if public._allocate_hall_booking(new) = 'reserved' then
      new.allocated_at := now();
    else
      new.status := 'waitlisted';
      new.allocated_at := null;
    end if;
  else
    new.allocated_at := null;
  end if;
  return new;
end;
$$;

create trigger hall_bookings_allocate
  before insert on public.hall_bookings
  for each row execute function public.hall_bookings_before_insert();

-- Moving into a holding status (confirming a waitlisted request) or moving
-- a held booking's slot re-runs the allocator; a move that can't be seated
-- fails loudly instead of double-booking the hall.
create function public.hall_bookings_before_slot_change()
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
      raise exception 'These dates are blocked at this venue.';
    elsif outcome <> 'reserved' then
      raise exception 'This venue is already booked for % to %.', new.start_date, new.end_date;
    end if;
    new.allocated_at := now();
    new.displaced_by := null;
    new.displaced_at := null;
  end if;
  return new;
end;
$$;

create trigger hall_bookings_allocate_on_slot_change
  before update of status, start_date, end_date, start_time, end_time on public.hall_bookings
  for each row execute function public.hall_bookings_before_slot_change();

-- Blocking a range that already holds a booking is refused; same lock as
-- the allocator so a block and a booking can't cross.
create function public.venue_blocked_dates_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('event_venue:' || new.venue_id::text, 0));
  if exists (
    select 1 from public.hall_bookings b
     where b.venue_id = new.venue_id
       and public.hall_booking_holds_venue(b.status)
       and b.start_date <= new.date_end
       and b.end_date >= new.date_start
  ) then
    raise exception 'Bookings exist on these dates.';
  end if;
  new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end;
$$;

create trigger venue_blocked_dates_guard
  before insert or update on public.venue_blocked_dates
  for each row execute function public.venue_blocked_dates_before_write();

-- ----------------------------------------------------------------------------
-- 5) Read models
-- ----------------------------------------------------------------------------

-- Public calendar feed: bookings holding the venue plus blocked ranges (as
-- 'confirmed' — taken, without saying why). Signature unchanged.
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
     and public.hall_booking_holds_venue(hb.status)
     and hb.start_date <= to_date
     and hb.end_date >= from_date
  union all
  select d.date_start, d.date_end, 'confirmed'::public.booking_status
    from public.venue_blocked_dates d
   where d.venue_id = target_venue_id
     and d.date_start <= to_date
     and d.date_end >= from_date;
$$;

-- The pre-check every booking path runs before inserting: sees every
-- holder regardless of the caller's RLS. The insert trigger stays the
-- authority; this only turns a clash into a clear error up front.
create function public.venue_slot_available(
  p_venue_id uuid,
  p_start date,
  p_end date,
  p_from time default null,
  p_to time default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
      select 1 from public.venue_blocked_dates d
       where d.venue_id = p_venue_id and d.date_start <= p_end and d.date_end >= p_start
    )
    and not exists (
      select 1 from public.hall_bookings c
       where c.venue_id = p_venue_id
         and public.hall_booking_holds_venue(c.status)
         and public.hall_slots_overlap(p_start, p_end, p_from, p_to, c.start_date, c.end_date, c.start_time, c.end_time)
    );
$$;

grant execute on function public.venue_slot_available(uuid, date, date, time, time) to authenticated;

-- ----------------------------------------------------------------------------
-- 6) Manager access to hall_bookings
-- ----------------------------------------------------------------------------
create policy "hall_bookings: manager reads assigned venue"
  on public.hall_bookings for select to authenticated
  using (public.is_venue_manager(venue_id));

create policy "hall_bookings: manager updates when permitted"
  on public.hall_bookings for update to authenticated
  using (public.venue_manager_has_permission(venue_id, 'bookings'))
  with check (public.venue_manager_has_permission(venue_id, 'bookings'));

create policy "hall_bookings: manager creates when permitted"
  on public.hall_bookings for insert to authenticated
  with check (public.venue_manager_has_permission(venue_id, 'bookings') and booked_by = auth.uid());

-- ----------------------------------------------------------------------------
-- 7) New-request alerts reach the venue's managers too (not the manager who
--    entered the booking themselves).
-- ----------------------------------------------------------------------------
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

  insert into public.notifications (profile_id, type, title, body, data)
  select recipient,
         'new_booking',
         'New booking — ' || venue_name,
         'A booking request for ' || new.event_type || ' on ' || new.start_date || ' was placed.',
         jsonb_build_object('hall_booking_id', new.id, 'venue_id', new.venue_id)
    from (
      select m.profile_id as recipient
        from public.venue_partner_members m
       where owning_partner_id is not null
         and m.partner_id = owning_partner_id
         and m.status = 'active'
      union
      select vm.profile_id
        from public.venue_managers vm
       where vm.venue_id = new.venue_id
         and vm.status = 'active'
    ) r
   where recipient <> new.booked_by;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8) Waitlisted hall requests join the admin queue badge.
-- ----------------------------------------------------------------------------
create or replace function public.admin_nav_counts()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  return jsonb_build_object(
    'queue',
      (select count(*) from public.hotel_bookings where status in ('pending', 'waitlisted'))
      + (select count(*) from public.hall_bookings where status in ('pending', 'waitlisted'))
      + (select count(*) from public.umrah_bookings where booking_kind = 'private' and status = 'pending'),
    'refunds',
      (select count(*) from public.agency_refund_requests where status = 'pending'),
    'visa',
      (select count(*) from public.visa_applications a
        where a.status <> 'draft' and public.visa_case_attention(a) is not null),
    'visa_appointments',
      (select count(*) from public.visa_appointments
        where status = 'booked' and scheduled_at < date_trunc('day', now()) + interval '1 day'),
    'umrah_requests',
      (select count(*) from public.umrah_bookings where booking_kind = 'private' and status = 'pending'),
    'partner_applications',
      (select count(*) from public.agency_applications where status in ('pending', 'under_review'))
      + (select count(*) from public.hotel_partner_applications where status in ('pending', 'under_review'))
      + (select count(*) from public.affiliate_applications where status in ('pending', 'under_review'))
      + (select count(*) from public.venue_partner_applications where status in ('pending', 'under_review')),
    'markup_requests',
      (select count(*) from public.agency_markup_requests where status = 'pending'),
    'earnings_reviews',
      (select count(*) from public.agency_commission_entries where status = 'pending'),
    'payout_requests',
      (select count(*) from public.agency_payout_requests where status in ('pending', 'approved')),
    'topup_requests',
      (select count(*) from public.agency_topup_requests where status = 'pending' and rail = 'offline')
  );
end;
$function$;
