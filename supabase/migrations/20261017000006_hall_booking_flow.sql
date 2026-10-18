-- Event hall booking flow, brought to the same rules as hotels.
--
-- Found by running the hall flow as customer, venue manager and admin:
--   * any status could follow any other (completed weeks before the event,
--     a cancelled booking reopened, a zero-price request confirmed);
--   * the customer was never told the venue confirmed or declined;
--   * a paid booking cancelled by the venue left no refund owed anywhere;
--   * customer cancellation / refund requests on a hall order were invisible
--     to the venue, and halls had no refund policy;
--   * guest count over the venue's capacity was only checked in some paths;
--   * no activity history per booking.

-- ----------------------------------------------------------------------------
-- 1. Status transitions, enforced for every writer
-- ----------------------------------------------------------------------------
-- System writes (no signed-in user: webhooks, jobs, migrations) are trusted.
-- The allocator's own displacement (pending -> waitlisted with displaced_by)
-- is allowed. Everything else follows the desk rules below.
create or replace function public.hall_bookings_status_guard()
returns trigger
language plpgsql
as $$
declare
  ok boolean;
begin
  if new.status is not distinct from old.status or auth.uid() is null then
    return new;
  end if;

  ok := case
    when new.status = 'waitlisted' then old.status = 'pending' and new.displaced_by is not null
    when old.status in ('pending', 'waitlisted') then
      new.status = 'cancelled'
      or (new.status = 'confirmed' and new.end_date >= current_date)
    when old.status = 'confirmed' then
      (new.status = 'cancelled' and current_date <= new.end_date)
      or (new.status in ('completed', 'no_show') and current_date >= new.start_date)
    when old.status = 'cancelled' then new.status = 'refunded' and public.is_admin()
    else false
  end;

  if not ok then
    raise exception using
      errcode = 'P0001',
      message = format('A %s booking can''t be changed to %s.', replace(old.status::text, '_', ' '), replace(new.status::text, '_', ' '));
  end if;

  if new.status = 'confirmed' and new.price <= 0 then
    raise exception using errcode = 'P0001', message = 'Set the price before confirming.';
  end if;
  return new;
end;
$$;

create trigger hall_bookings_status_guard
  before update of status on public.hall_bookings
  for each row execute function public.hall_bookings_status_guard();

-- ----------------------------------------------------------------------------
-- 2. Guest count never above the venue's capacity
-- ----------------------------------------------------------------------------
create or replace function public.hall_bookings_capacity_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap integer;
begin
  if new.expected_guests is null then
    return new;
  end if;
  select greatest(coalesce(capacity_standing, 0), coalesce(capacity_seated, 0)) into v_cap
    from public.event_venues where id = new.venue_id;
  if v_cap > 0 and new.expected_guests > v_cap then
    raise exception using errcode = 'P0001', message = format('This venue holds up to %s guests.', v_cap);
  end if;
  return new;
end;
$$;

create trigger hall_bookings_capacity_guard
  before insert or update of expected_guests on public.hall_bookings
  for each row execute function public.hall_bookings_capacity_guard();

-- ----------------------------------------------------------------------------
-- 3. Tell the customer when the venue decides
-- ----------------------------------------------------------------------------
create or replace function public.hall_booking_decided()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue text;
  v_order_id uuid;
  v_order_status public.order_status;
  v_type text;
  v_title text;
  v_body text;
  v_when text;
begin
  if new.source = 'offline' or old.status is not distinct from new.status then
    return new;
  end if;

  select o.id, o.status into v_order_id, v_order_status
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.hall_booking_id = new.id
   limit 1;
  if v_order_id is null then
    return new;
  end if;

  select name into v_venue from public.event_venues where id = new.venue_id;
  v_when := new.start_date::text || case when new.end_date <> new.start_date then ' to ' || new.end_date::text else '' end;

  if new.status = 'confirmed' and old.status in ('pending', 'waitlisted') then
    v_type := 'booking_confirmed';
    v_title := 'Booking confirmed — ' || v_venue;
    v_body := v_when || '.' || case when v_order_status = 'pending_payment' then ' Complete payment to secure it.' else '' end;
  elsif new.status = 'cancelled' and old.status in ('pending', 'waitlisted', 'confirmed')
        and coalesce(v_order_status::text, '') <> 'cancelled' then
    v_type := 'booking_declined';
    v_title := case when old.status = 'confirmed' then 'Booking cancelled — ' else 'Request declined — ' end || v_venue;
    v_body := v_when || '.';
  else
    return new;
  end if;

  if v_type = 'booking_declined' and v_order_status in ('held', 'pending_payment') then
    update public.orders set status = 'cancelled' where id = v_order_id;
  end if;

  insert into public.notifications (profile_id, type, title, body, data)
  select distinct p.profile_id, v_type, v_title, v_body,
         jsonb_build_object('hall_booking_id', new.id, 'order_id', v_order_id)
    from (values (new.customer_id), (new.booked_by)) as p(profile_id)
   where p.profile_id is not null;
  return new;
end;
$$;

create trigger hall_bookings_decided
  after update of status on public.hall_bookings
  for each row execute function public.hall_booking_decided();

-- ----------------------------------------------------------------------------
-- 4. Activity log
-- ----------------------------------------------------------------------------
create table public.hall_booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.hall_bookings (id) on delete cascade,
  venue_id uuid not null references public.event_venues (id) on delete cascade,
  kind text not null check (kind in ('created', 'status', 'payment', 'refund', 'rescheduled', 'price')),
  from_value text,
  to_value text,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index hall_booking_events_booking_idx on public.hall_booking_events (booking_id, created_at);

alter table public.hall_booking_events enable row level security;

create policy "hall_booking_events: admin reads"
  on public.hall_booking_events for select to authenticated
  using (public.is_admin());

create policy "hall_booking_events: venue staff read"
  on public.hall_booking_events for select to authenticated
  using (
    public.is_venue_manager(venue_id)
    or exists (
      select 1 from public.event_venues v
       where v.id = venue_id and v.partner_id is not null and public.is_venue_partner_member(v.partner_id)
    )
  );

create or replace function public.log_hall_booking_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into hall_booking_events (booking_id, venue_id, kind, to_value, actor_id)
    values (new.id, new.venue_id, 'created', new.status::text, v_actor);
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into hall_booking_events (booking_id, venue_id, kind, from_value, to_value, actor_id)
    values (new.id, new.venue_id, 'status', old.status::text, new.status::text, v_actor);
  end if;
  if new.paid_at is not null and old.paid_at is null then
    insert into hall_booking_events (booking_id, venue_id, kind, to_value, actor_id)
    values (new.id, new.venue_id, 'payment', new.payment_method, v_actor);
  end if;
  if new.price is distinct from old.price then
    insert into hall_booking_events (booking_id, venue_id, kind, from_value, to_value, actor_id)
    values (new.id, new.venue_id, 'price', old.price::text, new.price::text, v_actor);
  end if;
  if new.start_date is distinct from old.start_date or new.end_date is distinct from old.end_date
     or new.start_time is distinct from old.start_time or new.end_time is distinct from old.end_time then
    insert into hall_booking_events (booking_id, venue_id, kind, from_value, to_value, actor_id)
    values (new.id, new.venue_id, 'rescheduled',
            old.start_date::text || ' to ' || old.end_date::text,
            new.start_date::text || ' to ' || new.end_date::text, v_actor);
  end if;
  return new;
end;
$$;

create trigger hall_bookings_log_events
  after insert or update on public.hall_bookings
  for each row execute function public.log_hall_booking_events();

insert into public.hall_booking_events (booking_id, venue_id, kind, to_value, created_at)
select id, venue_id, 'created', status::text, created_at from public.hall_bookings;

-- Online payments and refunds reach the hall log the same way they reach hotels.
create or replace function public.log_hall_payment_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;
  v_kind := case
    when new.status = 'succeeded' then 'payment'
    when new.status in ('refunded', 'partially_refunded') then 'refund'
    else null
  end;
  if v_kind is null then
    return new;
  end if;
  insert into public.hall_booking_events (booking_id, venue_id, kind, to_value, actor_id)
  select hb.id, hb.venue_id, v_kind, new.provider, auth.uid()
    from public.order_items oi
    join public.hall_bookings hb on hb.id = oi.hall_booking_id
   where oi.order_id = new.order_id;
  return new;
end;
$$;

create trigger payments_log_hall_events
  after insert or update of status on public.payments
  for each row execute function public.log_hall_payment_events();

-- ----------------------------------------------------------------------------
-- 5. Venue refund policy
-- ----------------------------------------------------------------------------
create table public.venue_refund_rules (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.event_venues (id) on delete cascade,
  days_before integer not null check (days_before >= 0),
  deduction_percent numeric(5,2) not null check (deduction_percent >= 0 and deduction_percent <= 100),
  created_at timestamptz not null default now(),
  unique (venue_id, days_before)
);

alter table public.venue_refund_rules enable row level security;

create policy "venue_refund_rules: public reads"
  on public.venue_refund_rules for select
  using (true);

create policy "venue_refund_rules: admin manages"
  on public.venue_refund_rules for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "venue_refund_rules: partner manages own"
  on public.venue_refund_rules for all to authenticated
  using (exists (
    select 1 from public.event_venues v
     where v.id = venue_id and v.partner_id is not null and public.is_venue_partner_member(v.partner_id)
  ))
  with check (exists (
    select 1 from public.event_venues v
     where v.id = venue_id and v.partner_id is not null and public.is_venue_partner_member(v.partner_id)
  ));

create policy "venue_refund_rules: manager writes when permitted"
  on public.venue_refund_rules for all to authenticated
  using (public.venue_manager_has_permission(venue_id, 'profile'))
  with check (public.venue_manager_has_permission(venue_id, 'profile'));

alter table public.booking_requests
  add column hall_booking_id uuid references public.hall_bookings (id) on delete set null;

create index booking_requests_hall_booking_idx on public.booking_requests (hall_booking_id)
  where hall_booking_id is not null;

-- Route a new request to the hotel stay or the hall booking in its order.
create or replace function public.booking_requests_link_hotel_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.hotel_booking_id is null and new.hall_booking_id is null then
    select oi.hotel_booking_id into new.hotel_booking_id
      from public.order_items oi
     where oi.order_id = new.order_id and oi.hotel_booking_id is not null
     order by oi.created_at
     limit 1;
    if new.hotel_booking_id is null then
      select oi.hall_booking_id into new.hall_booking_id
        from public.order_items oi
       where oi.order_id = new.order_id and oi.hall_booking_id is not null
       order by oi.created_at
       limit 1;
    end if;
  end if;
  return new;
end;
$$;

update public.booking_requests br
   set hall_booking_id = (
     select oi.hall_booking_id from public.order_items oi
      where oi.order_id = br.order_id and oi.hall_booking_id is not null
      order by oi.created_at limit 1)
 where br.hotel_booking_id is null and br.hall_booking_id is null;

create policy "booking_requests: venue staff read"
  on public.booking_requests for select to authenticated
  using (
    hall_booking_id is not null
    and exists (
      select 1
        from public.hall_bookings hb
        join public.event_venues v on v.id = hb.venue_id
       where hb.id = hall_booking_id
         and (public.is_venue_manager(hb.venue_id)
              or (v.partner_id is not null and public.is_venue_partner_member(v.partner_id)))
    )
  );

create or replace function public.hall_refund_quote(p_booking_id uuid, p_as_of date default current_date)
returns table (days_before integer, deduction_percent numeric, paid_amount numeric, refund_amount numeric, currency text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  hb public.hall_bookings;
  v_partner uuid;
  v_days integer;
  v_pct numeric;
  v_paid numeric;
begin
  select * into hb from public.hall_bookings where id = p_booking_id;
  if not found then
    return;
  end if;
  select partner_id into v_partner from public.event_venues where id = hb.venue_id;
  if not (
    public.is_admin()
    or public.is_venue_manager(hb.venue_id)
    or (v_partner is not null and public.is_venue_partner_member(v_partner))
    or exists (select 1 from public.order_items oi where oi.hall_booking_id = hb.id and public.can_access_order(oi.order_id))
  ) then
    return;
  end if;

  v_days := greatest(hb.start_date - p_as_of, 0);
  if exists (select 1 from public.venue_refund_rules r where r.venue_id = hb.venue_id) then
    select r.deduction_percent into v_pct
      from public.venue_refund_rules r
     where r.venue_id = hb.venue_id and r.days_before <= v_days
     order by r.days_before desc
     limit 1;
    v_pct := coalesce(v_pct, 100);
  end if;

  if hb.paid_at is not null or exists (
    select 1 from public.order_items oi join public.payments p on p.order_id = oi.order_id
     where oi.hall_booking_id = hb.id and p.status = 'succeeded'
  ) then
    v_paid := hb.price;
  else
    v_paid := 0;
  end if;

  return query select v_days, v_pct, v_paid,
    case when v_pct is null then null else round(v_paid * (100 - v_pct) / 100, 2) end,
    hb.currency;
end;
$$;

grant execute on function public.hall_refund_quote(uuid, date) to authenticated;

create or replace function public.resolve_hall_booking_request(
  p_request_id uuid,
  p_decision text,
  p_amount numeric default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.booking_requests;
  hb public.hall_bookings;
  v_partner uuid;
  v_venue text;
  v_amount numeric;
  v_started boolean;
begin
  if p_decision not in ('approved', 'rejected', 'in_review') then
    raise exception 'Invalid decision.';
  end if;

  select * into r from public.booking_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found.';
  end if;
  if r.hall_booking_id is null then
    raise exception 'This request is not tied to a venue booking.';
  end if;

  select * into hb from public.hall_bookings where id = r.hall_booking_id for update;
  select partner_id, name into v_partner, v_venue from public.event_venues where id = hb.venue_id;

  if not (
    public.is_admin()
    or public.venue_manager_has_permission(hb.venue_id, 'bookings')
    or (v_partner is not null and public.is_venue_partner_member(v_partner))
  ) then
    raise exception 'You do not have permission to decide this request.';
  end if;
  if r.status not in ('requested', 'in_review') then
    raise exception 'This request is already closed.';
  end if;

  v_started := hb.start_date <= current_date or hb.status in ('completed', 'no_show');
  if p_decision = 'approved' and r.kind = 'cancellation' and v_started then
    raise exception 'The event has already started. Approve a refund instead.';
  end if;

  v_amount := null;
  if p_decision = 'approved' and r.kind in ('cancellation', 'refund') then
    v_amount := coalesce(p_amount, r.requested_amount, 0);
    if v_amount < 0 or v_amount > hb.price then
      raise exception 'Refund cannot exceed the booking total.';
    end if;
  end if;

  update public.booking_requests
     set status = p_decision::public.booking_request_status,
         approved_amount = v_amount,
         staff_note = nullif(trim(coalesce(p_note, '')), ''),
         resolved_by = case when p_decision = 'in_review' then null else auth.uid() end,
         resolved_at = case when p_decision = 'in_review' then null else now() end
   where id = r.id;

  if p_decision = 'approved' and r.kind in ('cancellation', 'refund')
     and not v_started and hb.status in ('pending', 'waitlisted', 'confirmed') then
    update public.hall_bookings set status = 'cancelled' where id = hb.id;
  end if;

  insert into public.notifications (profile_id, type, title, body, data)
  values (
    r.requested_by,
    'booking_request_' || p_decision,
    case p_decision
      when 'approved' then 'Request approved — ' || v_venue
      when 'rejected' then 'Request declined — ' || v_venue
      else 'Request under review — ' || v_venue
    end,
    nullif(trim(coalesce(p_note, '')), ''),
    jsonb_build_object('request_id', r.id, 'order_id', r.order_id)
  );
end;
$$;

grant execute on function public.resolve_hall_booking_request(uuid, text, numeric, text) to authenticated;

-- The venue cancels a paid online booking itself: the refund is opened for admin.
create or replace function public.hall_booking_cancelled_refund()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_status public.order_status;
begin
  if new.status <> 'cancelled' or old.status not in ('pending', 'confirmed') or new.channel <> 'b2c' then
    return new;
  end if;

  select o.id, o.status into v_order_id, v_order_status
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.hall_booking_id = new.id
   limit 1;
  if v_order_id is null or v_order_status not in ('paid', 'processing', 'partially_paid') then
    return new;
  end if;

  if exists (
    select 1 from public.booking_requests br
     where br.hall_booking_id = new.id
       and br.status in ('requested', 'in_review', 'approved', 'completed')
  ) then
    return new;
  end if;

  insert into public.booking_requests (
    order_id, requested_by, kind, status, reason, approved_amount, currency,
    staff_note, resolved_by, resolved_at, hall_booking_id
  ) values (
    v_order_id, new.customer_id, 'refund', 'approved', 'Cancelled by the venue.', new.price, new.currency,
    'Cancelled by the venue.', auth.uid(), now(), new.id
  );
  return new;
end;
$$;

create trigger hall_bookings_cancelled_refund
  after update of status on public.hall_bookings
  for each row execute function public.hall_booking_cancelled_refund();

-- ----------------------------------------------------------------------------
-- 6. Admin nav: customer refund requests count toward the Refunds badge
-- ----------------------------------------------------------------------------
create or replace function public.admin_nav_counts()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
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
      (select count(*) from public.agency_refund_requests where status = 'pending')
      + (select count(*) from public.booking_requests where status in ('requested', 'in_review', 'approved')),
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
