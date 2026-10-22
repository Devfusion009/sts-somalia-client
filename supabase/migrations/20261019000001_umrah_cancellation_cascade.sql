-- Umrah cancellations and refunds that actually end the booking.
--
-- Until now an approved cancellation on a paid Umrah booking only updated the
-- booking_requests row: complete_booking_request flipped the order to
-- 'refunded' and nothing looked at the umrah booking behind it, so the seats
-- stayed reserved, the stage track stayed open and the pilgrim kept seeing a
-- live trip. An admin setting an order to cancelled/refunded by hand had the
-- same hole.
--
-- 1. Order closed -> booking closed. One trigger on orders covers
--    complete_booking_request, the admin status override and
--    _apply_order_cancellation (where it is a no-op the second time).
-- 2. Booking closed -> timeline row + notification, from one trigger on
--    umrah_bookings, whatever closed it. Callers pass a note and a kind
--    ('declined' for a private request STS turned down) through
--    transaction-local settings.
-- 3. Umrah booking requests: linked to their booking and resolved in SQL, the
--    same shape as resolve_hotel_booking_request. The refund amount is what
--    the admin enters; no deduction bands exist yet.
-- 4. admin_cancel_umrah_booking: staff-initiated cancellation. Unpaid orders
--    are cancelled outright; paid ones open an approved cancellation request
--    so the money still flows through complete_booking_request.
-- 5. complete_booking_request credits the agency wallet for the wallet-paid
--    part of a refund (other methods stay manual).
-- 6. The customer UPDATE policy on umrah_bookings is dropped: it let a
--    customer cancel the booking while its order stayed payable. Customers
--    cancel through cancel_order, which cascades.

-- ----------------------------------------------------------------------------
-- 1. booking_requests -> umrah booking
-- ----------------------------------------------------------------------------
alter table public.booking_requests
  add column if not exists umrah_booking_id uuid references public.umrah_bookings (id) on delete set null;

create index if not exists booking_requests_umrah_booking_idx on public.booking_requests (umrah_booking_id)
  where umrah_booking_id is not null;

-- Full re-declaration of 20261017000006's body with a third branch. A
-- booking id sent with the insert must belong to the request's own order:
-- the insert policy only checks the order, and approving a cancellation now
-- cancels whatever booking the request points at.
create or replace function public.booking_requests_link_hotel_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.hotel_booking_id is not null and not exists (
        select 1 from public.order_items oi
         where oi.order_id = new.order_id and oi.hotel_booking_id = new.hotel_booking_id))
     or (new.hall_booking_id is not null and not exists (
        select 1 from public.order_items oi
         where oi.order_id = new.order_id and oi.hall_booking_id = new.hall_booking_id))
     or (new.umrah_booking_id is not null and not exists (
        select 1 from public.order_items oi
         where oi.order_id = new.order_id and oi.umrah_booking_id = new.umrah_booking_id)) then
    raise exception 'This booking is not part of the order.';
  end if;

  if new.hotel_booking_id is null and new.hall_booking_id is null and new.umrah_booking_id is null then
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
    if new.hotel_booking_id is null and new.hall_booking_id is null then
      select oi.umrah_booking_id into new.umrah_booking_id
        from public.order_items oi
       where oi.order_id = new.order_id and oi.umrah_booking_id is not null
       order by oi.created_at
       limit 1;
    end if;
  end if;
  return new;
end;
$$;

update public.booking_requests br
   set umrah_booking_id = (
     select oi.umrah_booking_id from public.order_items oi
      where oi.order_id = br.order_id and oi.umrah_booking_id is not null
      order by oi.created_at limit 1)
 where br.hotel_booking_id is null and br.hall_booking_id is null and br.umrah_booking_id is null;

-- ----------------------------------------------------------------------------
-- 2. Booking closed: timeline + notification
-- ----------------------------------------------------------------------------
create or replace function public.umrah_bookings_on_close()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := coalesce(nullif(current_setting('sts.umrah_close_kind', true), ''), 'cancelled');
  v_note text := nullif(btrim(coalesce(current_setting('sts.umrah_close_note', true), '')), '');
  v_order_id uuid;
  v_label text;
  v_type text;
  v_title text;
  v_body text;
begin
  if new.status not in ('cancelled', 'refunded') or old.status in ('cancelled', 'refunded') then
    return new;
  end if;

  select o.id into v_order_id
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.umrah_booking_id = new.id
   order by o.created_at desc
   limit 1;

  select coalesce(
           (select p.name from public.umrah_packages p where p.id = new.package_id),
           (select r.reference from public.umrah_custom_requests r where r.id = new.custom_request_id),
           'Umrah booking'
         )
    into v_label;

  if v_kind = 'declined' then
    v_type := 'umrah_request_declined';
    v_title := 'Private Umrah request declined';
    v_body := v_label || ' was declined.';
  elsif new.status = 'refunded' then
    v_type := 'umrah_booking_cancelled';
    v_title := 'Umrah booking refunded';
    v_body := v_label || ' is refunded.';
  else
    v_type := 'umrah_booking_cancelled';
    v_title := 'Umrah booking cancelled';
    v_body := v_label || ' is cancelled.';
  end if;
  if v_note is not null then
    v_body := v_body || ' ' || v_note;
  end if;

  -- Same stage, closing note: the timeline shows why the track stopped
  -- without a new enum value.
  insert into public.umrah_booking_stage_history (booking_id, stage, note, actor)
  values (
    new.id,
    new.fulfillment_stage,
    case
      when v_kind = 'declined' then 'Declined'
      when new.status = 'refunded' then 'Refunded'
      else 'Cancelled'
    end || case when v_note is not null then '. ' || v_note else '' end,
    auth.uid()
  );

  insert into public.notifications (profile_id, type, title, body, data)
  select distinct r.profile_id, v_type, v_title, v_body,
         jsonb_build_object('bookingId', new.id, 'orderId', v_order_id, 'status', new.status::text)
  from (
    select new.customer_id as profile_id
    union
    select new.booked_by
    union
    select m.profile_id
      from public.agency_members m
     where new.agency_id is not null
       and m.agency_id = new.agency_id
       and m.status = 'active'
  ) r
  where r.profile_id is not null;

  return new;
end;
$$;

revoke execute on function public.umrah_bookings_on_close() from public, anon, authenticated;

drop trigger if exists umrah_bookings_closed on public.umrah_bookings;
create trigger umrah_bookings_closed
  after update of status on public.umrah_bookings
  for each row execute function public.umrah_bookings_on_close();

-- ----------------------------------------------------------------------------
-- 3. Order closed -> booking closed
-- ----------------------------------------------------------------------------
create or replace function public.orders_cascade_umrah_on_close()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status not in ('cancelled', 'refunded') or old.status = new.status then
    return new;
  end if;

  update public.umrah_bookings b
     set status = case when new.status = 'refunded'
                       then 'refunded'::public.booking_status
                       else 'cancelled'::public.booking_status end
    from public.order_items oi
   where oi.order_id = new.id
     and oi.umrah_booking_id = b.id
     and b.status not in ('cancelled', 'refunded', 'completed', 'no_show', 'failed');

  return new;
end;
$$;

revoke execute on function public.orders_cascade_umrah_on_close() from public, anon, authenticated;

drop trigger if exists orders_cascade_umrah_on_close on public.orders;
create trigger orders_cascade_umrah_on_close
  after update of status on public.orders
  for each row execute function public.orders_cascade_umrah_on_close();

-- ----------------------------------------------------------------------------
-- 4. Resolve an Umrah booking request
-- ----------------------------------------------------------------------------
create or replace function public._resolve_umrah_booking_request(
  p_request_id uuid,
  p_decision text,
  p_amount numeric,
  p_note text,
  p_notify_requester boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.booking_requests;
  bk public.umrah_bookings;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_departure date;
  v_started boolean;
  v_paid numeric;
  v_amount numeric;
  v_order_status public.order_status;
  v_label text;
begin
  if p_decision not in ('approved', 'rejected', 'in_review') then
    raise exception 'Invalid decision.';
  end if;

  select * into r from public.booking_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found.';
  end if;
  if r.umrah_booking_id is null then
    raise exception 'This request is not tied to an Umrah booking.';
  end if;
  if r.status not in ('requested', 'in_review') then
    raise exception 'This request is already closed.';
  end if;

  select * into bk from public.umrah_bookings where id = r.umrah_booking_id for update;

  select coalesce(d.departure_date, cr.departure_date) into v_departure
    from public.umrah_bookings b
    left join public.umrah_package_departures d on d.id = b.departure_id
    left join public.umrah_custom_requests cr on cr.id = b.custom_request_id
   where b.id = bk.id;

  v_started := bk.status in ('completed', 'no_show')
    or bk.fulfillment_stage = 'completed'
    or (v_departure is not null and v_departure <= current_date);
  if p_decision = 'approved' and r.kind = 'cancellation' and v_started then
    raise exception 'The trip has already started. Approve a refund instead.';
  end if;

  -- Capped at what was actually paid, not the booking total: a deposit-paid
  -- booking cannot be refunded more than the deposit. Refunds already
  -- approved on the same order count against it.
  select coalesce(sum(amount), 0) into v_paid
    from public.payments
   where order_id = r.order_id and status in ('succeeded', 'partially_refunded');
  v_paid := v_paid - coalesce((
    select sum(o.approved_amount) from public.booking_requests o
     where o.order_id = r.order_id and o.id <> r.id
       and o.kind in ('cancellation', 'refund')
       and o.status in ('approved', 'completed')
  ), 0);

  v_amount := null;
  if p_decision = 'approved' and r.kind in ('cancellation', 'refund') then
    v_amount := coalesce(p_amount, r.requested_amount, 0);
    if v_amount < 0 or v_amount > v_paid then
      raise exception 'Refund cannot exceed the amount paid.';
    end if;
  end if;

  update public.booking_requests
     set status = p_decision::public.booking_request_status,
         approved_amount = v_amount,
         staff_note = v_note,
         resolved_by = case when p_decision = 'in_review' then null else auth.uid() end,
         resolved_at = case when p_decision = 'in_review' then null else now() end
   where id = r.id;

  -- A cancellation ends the trip now. A refund request leaves the booking
  -- alone: a full refund closes it through the order cascade when it is paid
  -- out, and a partial one (a service not used) keeps the trip alive.
  if p_decision = 'approved' and r.kind = 'cancellation' and bk.status in ('pending', 'confirmed') then
    perform set_config('sts.umrah_close_note', coalesce(v_note, ''), true);
    select status into v_order_status from public.orders where id = r.order_id;
    if v_order_status in ('held', 'pending_payment') then
      perform public._apply_order_cancellation(r.order_id, v_note);
    else
      update public.umrah_bookings set status = 'cancelled' where id = bk.id;
    end if;
    perform set_config('sts.umrah_close_note', '', true);
  end if;

  if p_notify_requester then
    select coalesce(
             (select p.name from public.umrah_packages p where p.id = bk.package_id),
             (select cr.reference from public.umrah_custom_requests cr where cr.id = bk.custom_request_id),
             'Umrah booking'
           )
      into v_label;

    insert into public.notifications (profile_id, type, title, body, data)
    values (
      r.requested_by,
      'booking_request_' || p_decision,
      case p_decision
        when 'approved' then 'Request approved — ' || v_label
        when 'rejected' then 'Request declined — ' || v_label
        else 'Request under review — ' || v_label
      end,
      v_note,
      jsonb_build_object('request_id', r.id, 'order_id', r.order_id)
    );
  end if;
end;
$$;

revoke execute on function public._resolve_umrah_booking_request(uuid, text, numeric, text, boolean)
  from public, anon, authenticated;

create or replace function public.resolve_umrah_booking_request(
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
begin
  if not public.is_admin() then
    raise exception 'Only STS staff can decide this request.';
  end if;
  perform public._resolve_umrah_booking_request(p_request_id, p_decision, p_amount, p_note, true);
end;
$$;

revoke execute on function public.resolve_umrah_booking_request(uuid, text, numeric, text) from public, anon;
grant execute on function public.resolve_umrah_booking_request(uuid, text, numeric, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Staff cancel an Umrah booking
-- ----------------------------------------------------------------------------
create or replace function public.admin_cancel_umrah_booking(
  p_booking_id uuid,
  p_reason text,
  p_refund_amount numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  bk public.umrah_bookings;
  ord public.orders;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_request_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only STS staff can cancel an Umrah booking.';
  end if;
  if v_reason is null then
    raise exception 'Enter a reason.';
  end if;
  if p_refund_amount is not null and p_refund_amount < 0 then
    raise exception 'Refund cannot be negative.';
  end if;

  select * into bk from public.umrah_bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found.';
  end if;
  if bk.status in ('cancelled', 'refunded', 'failed') then
    raise exception 'This booking is already closed.';
  end if;
  if bk.status in ('completed', 'no_show') or bk.fulfillment_stage = 'completed' then
    raise exception 'This trip is complete. Approve a refund instead.';
  end if;

  select o.* into ord
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.umrah_booking_id = bk.id
   order by o.created_at desc
   limit 1;

  perform set_config('sts.umrah_close_note', v_reason, true);

  if ord.id is null then
    update public.umrah_bookings set status = 'cancelled' where id = bk.id;
  elsif ord.status in ('held', 'pending_payment') then
    perform public._apply_order_cancellation(ord.id, v_reason);
  elsif ord.status in ('cancelled', 'refunded') then
    -- An order closed before the cascade existed, with its booking left open.
    update public.umrah_bookings set status = 'cancelled' where id = bk.id;
  else
    insert into public.booking_requests (
      order_id, requested_by, kind, status, reason, requested_amount, currency, umrah_booking_id
    ) values (
      ord.id, auth.uid(), 'cancellation', 'requested', v_reason, p_refund_amount, ord.currency, bk.id
    )
    returning id into v_request_id;

    perform public._resolve_umrah_booking_request(v_request_id, 'approved', coalesce(p_refund_amount, 0), v_reason, false);
  end if;

  perform set_config('sts.umrah_close_note', '', true);
  return v_request_id;
end;
$$;

revoke execute on function public.admin_cancel_umrah_booking(uuid, text, numeric) from public, anon;
grant execute on function public.admin_cancel_umrah_booking(uuid, text, numeric) to authenticated;

-- ----------------------------------------------------------------------------
-- 6. Settling a refund: wallet-paid money goes back to the wallet
-- ----------------------------------------------------------------------------
-- Full re-declaration of 20261017000005's body. Added: for an agency order,
-- the wallet-paid share of the approved amount is credited back to the
-- agency wallet. Skipped when an agency refund request on the same order was
-- already approved, because that path credits the wallet itself.
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
  v_agency_id uuid;
  v_order_number text;
  v_wallet_paid numeric;
  v_credit numeric;
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
    select agency_id, order_number into v_agency_id, v_order_number
      from public.orders where id = r.order_id;

    if v_agency_id is not null and not exists (
      select 1 from public.agency_refund_requests a
       where a.order_id = r.order_id and a.status = 'approved'
    ) then
      -- Net of what the wallet already got back for this order, so a second
      -- partial refund can never return more than the wallet paid.
      select coalesce(sum(-t.amount) filter (where t.type = 'booking_payment'), 0)
           - coalesce(sum(t.amount) filter (where t.type = 'refund'), 0)
        into v_wallet_paid
        from public.agency_wallet_transactions t
       where t.order_id = r.order_id and t.agency_id = v_agency_id;
      v_credit := least(r.approved_amount, greatest(v_wallet_paid, 0));
      if v_credit > 0 then
        perform public.apply_agency_wallet_transaction(
          v_agency_id, v_credit, 'refund', r.order_id, 'Refund ' || v_order_number
        );
      end if;
    end if;

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

  -- A request staff opened themselves (admin cancel, departure cancel) tells
  -- the order's customer and booker, not the staff member.
  insert into public.notifications (profile_id, type, title, body, data)
  select distinct x.profile_id,
         'booking_request_completed',
         'Refund sent',
         case when r.approved_amount is not null then r.currency || ' ' || to_char(r.approved_amount, 'FM999999990.00') else null end,
         jsonb_build_object('request_id', r.id, 'order_id', r.order_id)
    from (
      select r.requested_by as profile_id
       where not exists (select 1 from public.profiles p where p.id = r.requested_by and p.is_platform_admin)
      union
      select o.customer_id from public.orders o
       where o.id = r.order_id
         and exists (select 1 from public.profiles p where p.id = r.requested_by and p.is_platform_admin)
      union
      select o.booked_by from public.orders o
       where o.id = r.order_id
         and exists (select 1 from public.profiles p where p.id = r.requested_by and p.is_platform_admin)
    ) x
   where x.profile_id is not null;
end;
$$;

grant execute on function public.complete_booking_request(uuid) to authenticated;

-- Re-declared from 20260809000002 with one guard: once complete_booking_request
-- has refunded wallet money for this order, an agency refund request on the
-- same order would pay the agency a second time.
create or replace function public.approve_agency_refund_request(request_id uuid, notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.agency_refund_requests;
  new_tx_id uuid;
begin
  if not public.is_admin() then
    raise exception 'only admins can approve refund requests';
  end if;

  select * into req from public.agency_refund_requests where id = request_id for update;
  if not found then
    raise exception 'refund request not found';
  end if;
  if req.status <> 'pending' then
    raise exception 'refund request already processed';
  end if;

  if req.order_id is not null and exists (
    select 1 from public.agency_wallet_transactions t
     where t.order_id = req.order_id
       and t.type = 'refund'
       and not exists (select 1 from public.agency_refund_requests a where a.wallet_transaction_id = t.id)
  ) then
    raise exception 'This order was already refunded to the agency balance.';
  end if;

  new_tx_id := public.apply_agency_wallet_transaction(
    req.agency_id, req.amount, 'refund', req.order_id,
    'Refund approved: ' || req.reason
  );

  update public.agency_refund_requests
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
        review_notes = notes, wallet_transaction_id = new_tx_id
    where id = request_id;
end;
$$;

-- A requester opens a request; only staff decide it. The insert policy used
-- to accept any status and approved amount, so a customer or agent could
-- write an already-approved request that a staff "Complete" would pay out.
drop policy if exists "booking_requests: customer opens on own order" on public.booking_requests;
create policy "booking_requests: customer opens on own order"
  on public.booking_requests for insert to authenticated
  with check (
    requested_by = (select auth.uid())
    and public.can_access_order(order_id)
    and status = 'requested'
    and approved_amount is null
    and staff_note is null
    and resolved_by is null
    and resolved_at is null
  );

-- ----------------------------------------------------------------------------
-- 7. D18: no direct customer status write
-- ----------------------------------------------------------------------------
drop policy if exists "umrah_bookings: customer cancels own pending booking" on public.umrah_bookings;
