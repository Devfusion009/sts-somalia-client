-- Agency commission is approved only after the booking's service has ended.
--
-- Commission reaches the agent's wallet or bank only from 'confirmed'
-- entries, and an entry becomes 'confirmed' only through admin approval.
-- Blocking approval until the last service date has passed therefore keeps
-- every commission out of the wallet until the booking is complete. A refund
-- before then reverses the entry (20261108000002).

-- Last service date of an order: hotel check-out, flight return (or
-- departure), hall end date, Umrah return, visa decision. NULL while any
-- item has no known end date yet, such as an undecided visa.
create or replace function public.order_service_end_date(p_order_id uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select case when count(*) = 0 or bool_or(d.end_date is null) then null else max(d.end_date) end
  from (
    select case
      when oi.hotel_booking_id is not null then hb.check_out::date
      when oi.flight_booking_id is not null then (coalesce(fb.return_at, fb.depart_at) at time zone 'Africa/Mogadishu')::date
      when oi.hall_booking_id is not null then hl.end_date::date
      when oi.umrah_booking_id is not null then coalesce(
        dep.return_date::date,
        (cr.departure_date + (coalesce(cr.nights_makkah, 0) + coalesce(cr.nights_madinah, 0)))::date)
      when oi.visa_application_id is not null then
        case when va.status in ('approved', 'issued')
          then (coalesce(va.decided_at, va.updated_at) at time zone 'Africa/Mogadishu')::date end
    end as end_date
    from public.order_items oi
    left join public.hotel_bookings hb on hb.id = oi.hotel_booking_id
    left join public.flight_bookings fb on fb.id = oi.flight_booking_id
    left join public.hall_bookings hl on hl.id = oi.hall_booking_id
    left join public.umrah_bookings ub on ub.id = oi.umrah_booking_id
    left join public.umrah_package_departures dep on dep.id = ub.departure_id
    left join public.umrah_custom_requests cr on cr.id = ub.custom_request_id
    left join public.visa_applications va on va.id = oi.visa_application_id
    where oi.order_id = p_order_id
  ) d;
$$;

revoke all on function public.order_service_end_date(uuid) from public, anon, authenticated;

-- Service end dates for the admin earnings review list.
create or replace function public.order_service_end_dates(p_order_ids uuid[])
returns table (order_id uuid, end_date date)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins can read service dates';
  end if;
  return query
    select o.id, public.order_service_end_date(o.id)
    from public.orders o
    where o.id = any(p_order_ids);
end;
$$;

revoke all on function public.order_service_end_dates(uuid[]) from public, anon;
grant execute on function public.order_service_end_dates(uuid[]) to authenticated;

-- Backstop for every approval path, not only the review RPC.
create or replace function public.guard_commission_approval_after_service()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_end date;
begin
  if new.status = 'confirmed' and old.status = 'pending' then
    v_end := public.order_service_end_date(new.order_id);
    if v_end is null or v_end >= (now() at time zone 'Africa/Mogadishu')::date then
      raise exception 'Commission can be approved after the booking''s travel date.';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_commission_approval_after_service() from public, anon, authenticated;

drop trigger if exists agency_commission_entries_after_service on public.agency_commission_entries;
create trigger agency_commission_entries_after_service
  before update of status on public.agency_commission_entries
  for each row execute function public.guard_commission_approval_after_service();
