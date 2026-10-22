-- Private Umrah: the customer hears about a quote and a decline.
--
-- updateUmrahRequestPrice changed the price silently, and declining was a raw
-- status write that notified nobody. A decline now goes through
-- decline_umrah_private_request, which cancels the unpaid order through
-- _apply_order_cancellation and marks the close as 'declined' for
-- umrah_bookings_on_close (20261019000001), which writes the timeline row and
-- the 'umrah_request_declined' notification.

create or replace function public.umrah_bookings_private_quoted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_reference text;
begin
  if new.booking_kind <> 'private'
     or new.status <> 'pending'
     or new.total_price is not distinct from old.total_price then
    return new;
  end if;

  select o.id into v_order_id
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.umrah_booking_id = new.id
   order by o.created_at desc
   limit 1;

  select reference into v_reference from public.umrah_custom_requests where id = new.custom_request_id;

  insert into public.notifications (profile_id, type, title, body, data)
  select distinct r.profile_id,
         'umrah_request_quoted',
         'Private Umrah price updated',
         coalesce(v_reference || ': ', '') || new.currency || ' ' || to_char(new.total_price, 'FM999999990.00'),
         jsonb_build_object('bookingId', new.id, 'orderId', v_order_id)
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

revoke execute on function public.umrah_bookings_private_quoted() from public, anon, authenticated;

drop trigger if exists umrah_bookings_private_quoted on public.umrah_bookings;
create trigger umrah_bookings_private_quoted
  after update of total_price on public.umrah_bookings
  for each row execute function public.umrah_bookings_private_quoted();

create or replace function public.decline_umrah_private_request(p_booking_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  bk public.umrah_bookings;
  v_order_id uuid;
  v_order_status public.order_status;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Only STS staff can decline a request.';
  end if;

  select * into bk from public.umrah_bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found.';
  end if;
  if bk.booking_kind <> 'private' then
    raise exception 'Only private requests can be declined.';
  end if;
  if bk.status <> 'pending' then
    raise exception 'This request is already decided.';
  end if;

  select o.id, o.status into v_order_id, v_order_status
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.umrah_booking_id = bk.id
   order by o.created_at desc
   limit 1;

  perform set_config('sts.umrah_close_kind', 'declined', true);
  perform set_config('sts.umrah_close_note', coalesce(v_note, ''), true);

  if v_order_id is not null and v_order_status in ('held', 'pending_payment') then
    perform public._apply_order_cancellation(v_order_id, coalesce(v_note, 'Request declined'));
  else
    -- A paid order is left to the refund flow, as before.
    update public.umrah_bookings set status = 'cancelled' where id = bk.id;
  end if;

  perform set_config('sts.umrah_close_kind', '', true);
  perform set_config('sts.umrah_close_note', '', true);
end;
$$;

revoke execute on function public.decline_umrah_private_request(uuid, text) from public, anon;
grant execute on function public.decline_umrah_private_request(uuid, text) to authenticated;
