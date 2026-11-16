-- Hotel and hall request approvals capped a refund at the booking total,
-- so a deposit-paid booking could be approved for more than was collected.
-- Cap at the amount paid on the order less refunds already approved, as
-- _resolve_umrah_booking_request already does.

CREATE OR REPLACE FUNCTION public.resolve_hotel_booking_request(p_request_id uuid, p_decision text, p_amount numeric DEFAULT NULL::numeric, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r public.booking_requests;
  hb public.hotel_bookings;
  v_partner uuid;
  v_hotel text;
  v_amount numeric;
  v_cap numeric;
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
    -- Capped at what was actually collected on the order (a deposit-paid
    -- booking cannot be refunded more than the deposit), less refunds
    -- already approved on it. A desk booking marked paid with no payment
    -- rows counts as paid in full, matching the refund quote.
    select coalesce(sum(p.amount), 0) into v_cap
      from public.payments p
     where p.order_id = r.order_id and p.status in ('succeeded', 'partially_refunded');
    if v_cap = 0 and hb.paid_at is not null then
      v_cap := hb.total_price;
    end if;
    v_cap := least(hb.total_price, v_cap) - coalesce((
      select sum(o.approved_amount) from public.booking_requests o
       where o.order_id = r.order_id and o.id <> r.id
         and o.kind in ('cancellation', 'refund')
         and o.status in ('approved', 'completed')
    ), 0);
    if v_amount < 0 or v_amount > greatest(v_cap, 0) then
      raise exception 'Refund cannot exceed the amount paid (%).', to_char(greatest(v_cap, 0), 'FM999999990.00');
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
$function$;

CREATE OR REPLACE FUNCTION public.resolve_hall_booking_request(p_request_id uuid, p_decision text, p_amount numeric DEFAULT NULL::numeric, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r public.booking_requests;
  hb public.hall_bookings;
  v_partner uuid;
  v_venue text;
  v_amount numeric;
  v_cap numeric;
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
    -- Capped at what was actually collected on the order (a deposit-paid
    -- booking cannot be refunded more than the deposit), less refunds
    -- already approved on it. A desk booking marked paid with no payment
    -- rows counts as paid in full, matching the refund quote.
    select coalesce(sum(p.amount), 0) into v_cap
      from public.payments p
     where p.order_id = r.order_id and p.status in ('succeeded', 'partially_refunded');
    if v_cap = 0 and hb.paid_at is not null then
      v_cap := hb.price;
    end if;
    v_cap := least(hb.price, v_cap) - coalesce((
      select sum(o.approved_amount) from public.booking_requests o
       where o.order_id = r.order_id and o.id <> r.id
         and o.kind in ('cancellation', 'refund')
         and o.status in ('approved', 'completed')
    ), 0);
    if v_amount < 0 or v_amount > greatest(v_cap, 0) then
      raise exception 'Refund cannot exceed the amount paid (%).', to_char(greatest(v_cap, 0), 'FM999999990.00');
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
$function$;
