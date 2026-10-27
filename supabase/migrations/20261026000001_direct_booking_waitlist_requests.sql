-- Direct booking when rooms are free, admin decision only when they are not.
--
-- Before: every hotel defaulted to booking_mode 'manual', so a customer
-- booking a room with free capacity still waited in the admin Order Queue
-- for a human to confirm (and sometimes re-price) it before paying. A
-- request for rooms the hotel did not have was refused outright.
--
-- Now:
--   * A seated customer booking goes straight to checkout and is confirmed by
--     payment (hotels and halls alike, whatever booking_mode says).
--   * A customer booking the allocator cannot seat is kept as 'waitlisted'
--     instead of being refused. That is the only thing the Order Queue shows
--     for hotels: admin confirms it (the allocator re-checks capacity at that
--     moment) or declines it. Payment opens only after it is confirmed.
--   * A request for more rooms than the room type physically has is still
--     refused: no amount of waiting makes 18 rooms out of 8.
--   * Unpaid direct bookings stop holding rooms after 24 hours.
--
-- Agency (B2B) seating and displacement are unchanged.

-- ----------------------------------------------------------------------------
-- 1. Every hotel books directly; the column stays for API-connected hotels.
-- ----------------------------------------------------------------------------
alter table public.hotels alter column booking_mode set default 'instant';
update public.hotels set booking_mode = 'instant' where booking_mode <> 'instant';

-- ----------------------------------------------------------------------------
-- 2. Unseatable customer bookings are waitlisted, not refused.
-- ----------------------------------------------------------------------------
create or replace function public.hotel_bookings_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_left integer;
  v_total integer;
begin
  new.channel := case when new.agency_id is not null then 'b2b' else 'b2c' end;
  new.priority := case when new.channel = 'b2b' then 0 else 1 end;
  new.displaced_by := null;
  new.displaced_at := null;

  if public.hotel_booking_holds_units(new.status) then
    if public._allocate_hotel_booking(new) = 'reserved' then
      new.allocated_at := now();
      return new;
    end if;

    select total_units into v_total from public.hotel_rooms where id = new.room_id;
    if v_total is not null and new.num_rooms > v_total then
      raise exception using
        errcode = 'P0001',
        message = format(
          'This room type has %s room%s in total.',
          v_total, case when v_total = 1 then '' else 's' end
        ),
        hint = 'rooms_unavailable';
    end if;

    -- Customers wait for an admin decision; agencies keep the clear refusal
    -- (their allocator path already displaced everything it could).
    if new.channel = 'b2c' then
      new.status := 'waitlisted';
      new.allocated_at := null;
      return new;
    end if;

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

  new.allocated_at := null;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Payment confirms the stay or the event, for every hotel and venue.
-- ----------------------------------------------------------------------------
create or replace function public.confirm_instant_hotel_bookings_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('paid', 'partially_paid')
     and old.status is distinct from new.status
     and old.status not in ('paid', 'partially_paid') then
    update public.hotel_bookings hb
       set status = 'confirmed'
      from public.order_items oi
     where oi.order_id = new.id
       and oi.hotel_booking_id = hb.id
       and hb.status = 'pending';

    update public.hall_bookings hb
       set status = 'confirmed'
      from public.order_items oi
     where oi.order_id = new.id
       and oi.hall_booking_id = hb.id
       and hb.status = 'pending'
       and hb.price > 0;
  end if;
  return new;
end;
$$;

revoke execute on function public.confirm_instant_hotel_bookings_on_payment() from public, anon, authenticated;

-- Paid bookings still waiting in 'pending' from the old flow.
update public.hotel_bookings hb
   set status = 'confirmed'
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
 where oi.hotel_booking_id = hb.id
   and hb.status = 'pending'
   and o.status in ('paid', 'partially_paid');

update public.hall_bookings hb
   set status = 'confirmed'
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
 where oi.hall_booking_id = hb.id
   and hb.status = 'pending'
   and hb.price > 0
   and o.status in ('paid', 'partially_paid');

-- ----------------------------------------------------------------------------
-- 4. Unpaid direct bookings release their rooms after 24 hours.
-- ----------------------------------------------------------------------------
-- Only bookings still 'pending' (never confirmed by an admin) and orders with
-- no payment in flight. Orders placed before this migration were made under
-- the request flow, where the customer was told to wait; they are left alone.
create or replace function public._expire_unpaid_stay_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_swept integer := 0;
begin
  for v_order_id in
    select o.id
      from public.orders o
     where o.status = 'pending_payment'
       and o.agency_id is null
       and o.created_at >= timestamptz '2026-10-26 00:00:00+00'
       and o.created_at < now() - interval '24 hours'
       and exists (
         select 1
           from public.order_items oi
           left join public.hotel_bookings hb on hb.id = oi.hotel_booking_id
           left join public.hall_bookings lb on lb.id = oi.hall_booking_id
          where oi.order_id = o.id
            and (hb.status = 'pending' or lb.status = 'pending')
       )
       and not exists (
         select 1 from public.order_items oi
           left join public.hotel_bookings hb on hb.id = oi.hotel_booking_id
           left join public.hall_bookings lb on lb.id = oi.hall_booking_id
          where oi.order_id = o.id
            and (hb.status in ('confirmed', 'waitlisted') or lb.status in ('confirmed', 'waitlisted'))
       )
       and not exists (
         select 1 from public.payments p
          where p.order_id = o.id
            and p.status in ('processing', 'requires_action', 'succeeded')
       )
  loop
    perform public._apply_order_cancellation(v_order_id, 'Not paid within 24 hours');
    v_swept := v_swept + 1;
  end loop;
  return v_swept;
end;
$$;

revoke execute on function public._expire_unpaid_stay_orders() from public, anon, authenticated;
grant execute on function public._expire_unpaid_stay_orders() to service_role;

-- ----------------------------------------------------------------------------
-- 5. The Order Queue badge counts only what needs a decision.
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
      (select count(*) from public.hotel_bookings where status = 'waitlisted')
      + (select count(*) from public.hall_bookings where status = 'waitlisted')
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

-- ----------------------------------------------------------------------------
-- 6. New-order alert text: the order no longer waits in a queue by default.
-- ----------------------------------------------------------------------------
create or replace function public.notify_admins_new_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (profile_id, type, title, body, data)
  select p.id,
         'new_order',
         'New order ' || new.order_number,
         new.currency || ' ' || to_char(new.total, 'FM999,999,990.00') || ' · '
           || initcap(replace(new.status::text, '_', ' ')),
         jsonb_build_object('order_id', new.id, 'order_number', new.order_number)
  from public.profiles p
  where p.is_platform_admin;
  return new;
end;
$$;
