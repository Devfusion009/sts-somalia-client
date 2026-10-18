-- Fixes found by running the booking → payment → cancellation → refund flow
-- end to end as customer, hotel manager and admin.
--
-- 1. Online payments and refunds now appear in the booking's activity log
--    (only offline paid_at was logged).
-- 2. A cancellation can no longer be approved for a guest who has already
--    checked in or finished the stay; a refund request on such a stay is
--    approved without cancelling it.
-- 3. When the hotel cancels a paid online booking itself, the refund owed to
--    the guest is opened for admin automatically, so it can't be forgotten.
-- 4. Admin closing a refund now settles it: payments are marked refunded or
--    partially refunded, and a fully refunded order becomes 'refunded'.

-- ----------------------------------------------------------------------------
-- 1. Payment and refund events
-- ----------------------------------------------------------------------------
alter table public.hotel_booking_events drop constraint hotel_booking_events_kind_check;
alter table public.hotel_booking_events add constraint hotel_booking_events_kind_check
  check (kind in ('created', 'status', 'check_in', 'check_out', 'payment', 'refund', 'rescheduled', 'room_assigned'));

create or replace function public.log_hotel_payment_events()
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

  insert into public.hotel_booking_events (booking_id, hotel_id, kind, to_value, actor_id)
  select hb.id, hb.hotel_id, v_kind, new.provider, auth.uid()
    from public.order_items oi
    join public.hotel_bookings hb on hb.id = oi.hotel_booking_id
   where oi.order_id = new.order_id;
  return new;
end;
$$;

create trigger payments_log_hotel_events
  after insert or update of status on public.payments
  for each row execute function public.log_hotel_payment_events();

-- ----------------------------------------------------------------------------
-- 2. Resolver: never cancel a stay that has started
-- ----------------------------------------------------------------------------
create or replace function public.resolve_hotel_booking_request(
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
  hb public.hotel_bookings;
  v_partner uuid;
  v_hotel text;
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
  if r.hotel_booking_id is null then
    raise exception 'This request is not tied to a hotel booking.';
  end if;

  select * into hb from public.hotel_bookings where id = r.hotel_booking_id for update;
  select partner_id, name into v_partner, v_hotel from public.hotels where id = hb.hotel_id;

  if not (
    public.is_admin()
    or public.hotel_manager_has_permission(hb.hotel_id, 'bookings')
    or public.is_hotel_partner_member(v_partner)
  ) then
    raise exception 'You do not have permission to decide this request.';
  end if;

  if r.status not in ('requested', 'in_review') then
    raise exception 'This request is already closed.';
  end if;

  v_started := hb.checked_in_at is not null or hb.status in ('completed', 'no_show');
  if p_decision = 'approved' and r.kind = 'cancellation' and v_started then
    raise exception 'The stay has already started. Approve a refund instead.';
  end if;

  v_amount := null;
  if p_decision = 'approved' and r.kind in ('cancellation', 'refund') then
    v_amount := coalesce(p_amount, r.requested_amount, 0);
    if v_amount < 0 or v_amount > hb.total_price then
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
     and not v_started
     and hb.status in ('pending', 'waitlisted', 'confirmed') then
    update public.hotel_bookings set status = 'cancelled' where id = hb.id;
  end if;

  insert into public.notifications (profile_id, type, title, body, data)
  values (
    r.requested_by,
    'booking_request_' || p_decision,
    case p_decision
      when 'approved' then 'Request approved — ' || v_hotel
      when 'rejected' then 'Request declined — ' || v_hotel
      else 'Request under review — ' || v_hotel
    end,
    nullif(trim(coalesce(p_note, '')), ''),
    jsonb_build_object('request_id', r.id, 'order_id', r.order_id)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Hotel cancels a paid online booking: open the refund for admin
-- ----------------------------------------------------------------------------
create or replace function public.hotel_booking_cancelled_refund()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_status public.order_status;
begin
  if new.status <> 'cancelled' or old.status not in ('pending', 'confirmed') or new.channel::text <> 'b2c' then
    return new;
  end if;

  select o.id, o.status into v_order_id, v_order_status
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.hotel_booking_id = new.id
   limit 1;

  if v_order_id is null or v_order_status not in ('paid', 'processing', 'partially_paid') then
    return new;
  end if;

  -- A request the hotel approved already carries the refund.
  if exists (
    select 1 from public.booking_requests br
     where br.hotel_booking_id = new.id
       and br.status in ('requested', 'in_review', 'approved', 'completed')
  ) then
    return new;
  end if;

  insert into public.booking_requests (
    order_id, requested_by, kind, status, reason, approved_amount, currency,
    staff_note, resolved_by, resolved_at, hotel_booking_id
  ) values (
    v_order_id, new.customer_id, 'refund', 'approved', 'Cancelled by the hotel.', new.total_price, new.currency,
    'Cancelled by the hotel.', auth.uid(), now(), new.id
  );
  return new;
end;
$$;

create trigger hotel_bookings_cancelled_refund
  after update of status on public.hotel_bookings
  for each row execute function public.hotel_booking_cancelled_refund();

-- ----------------------------------------------------------------------------
-- 4. Admin settles an approved refund
-- ----------------------------------------------------------------------------
create or replace function public.complete_booking_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.booking_requests;
  v_paid numeric;
  v_latest uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admin can complete a refund.';
  end if;

  select * into r from public.booking_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found.';
  end if;
  if r.status <> 'approved' then
    raise exception 'Only an approved request can be completed.';
  end if;

  update public.booking_requests
     set status = 'completed', resolved_by = auth.uid(), resolved_at = now()
   where id = r.id;

  if r.kind in ('cancellation', 'refund') and coalesce(r.approved_amount, 0) > 0 then
    select coalesce(sum(amount), 0) into v_paid
      from public.payments where order_id = r.order_id and status = 'succeeded';

    if v_paid > 0 and r.approved_amount >= v_paid then
      update public.payments set status = 'refunded'
       where order_id = r.order_id and status = 'succeeded';
      update public.orders set status = 'refunded'
       where id = r.order_id and status in ('paid', 'processing', 'partially_paid', 'completed');
    elsif v_paid > 0 then
      select id into v_latest from public.payments
       where order_id = r.order_id and status = 'succeeded'
       order by created_at desc limit 1;
      update public.payments set status = 'partially_refunded' where id = v_latest;
    end if;
  end if;

  insert into public.notifications (profile_id, type, title, body, data)
  values (
    r.requested_by,
    'booking_request_completed',
    'Refund sent',
    case when r.approved_amount is not null then r.currency || ' ' || to_char(r.approved_amount, 'FM999999990.00') else null end,
    jsonb_build_object('request_id', r.id, 'order_id', r.order_id)
  );
end;
$$;

grant execute on function public.complete_booking_request(uuid) to authenticated;
