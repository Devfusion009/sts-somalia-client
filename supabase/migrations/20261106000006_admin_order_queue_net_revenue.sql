-- The Orders & Payments "Settled revenue" tile summed the totals of paid
-- orders: refunds already sent were ignored and fees kept on cancelled
-- orders were missed. It now reports collected payments less refunds sent.

CREATE OR REPLACE FUNCTION public.admin_order_queue(p_filter text, p_today date, p_offset integer, p_limit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorised';
  end if;

  with q as (
    select
      o.id,
      o.status,
      o.total,
      o.created_at,
      exists (
        select 1 from public.payments p where p.order_id = o.id and p.status = 'requires_action'
      ) as needs_action,
      (
        select min(d) from (
          select hb.check_in as d
          from public.order_items oi join public.hotel_bookings hb on hb.id = oi.hotel_booking_id
          where oi.order_id = o.id and oi.item_type = 'hotel'
          union all
          select (fb.depart_at at time zone 'UTC')::date
          from public.order_items oi join public.flight_bookings fb on fb.id = oi.flight_booking_id
          where oi.order_id = o.id and oi.item_type = 'flight'
          union all
          select dep.departure_date
          from public.order_items oi
          join public.umrah_bookings ub on ub.id = oi.umrah_booking_id
          join public.umrah_package_departures dep on dep.id = ub.departure_id
          where oi.order_id = o.id and oi.item_type = 'umrah'
          union all
          select hb.start_date
          from public.order_items oi join public.hall_bookings hb on hb.id = oi.hall_booking_id
          where oi.order_id = o.id and oi.item_type = 'hall'
          union all
          select public._iso_date_or_null(va.travel_details ->> 'arrivalDate')
          from public.order_items oi join public.visa_applications va on va.id = oi.visa_application_id
          where oi.order_id = o.id and oi.item_type = 'visa'
        ) dates
      ) as travel_start
    from public.orders o
  ),
  flagged as (
    select q.*,
      (travel_start between p_today and p_today + 30 and status <> 'cancelled') as soon
    from q
  ),
  matching as (
    select id, created_at from flagged
    where case p_filter
      when 'all' then true
      when 'action' then needs_action
      when 'upcoming' then soon
      else status::text = p_filter
    end
  )
  select jsonb_build_object(
    'total', (select count(*) from flagged),
    'action', (select count(*) from flagged where needs_action),
    'upcoming', (select count(*) from flagged where soon),
    'byStatus', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                 from (select status, count(*) as n from flagged group by status) s),
    'settledCount', (select count(*) from flagged where status in ('paid', 'processing', 'completed')),
    -- Money actually kept: every collected payment (including ones since
    -- part or fully refunded, and fees retained on cancelled orders) less
    -- the refunds already sent.
    'settledRevenue', (
      select coalesce(sum(
               coalesce((select sum(p.amount) from public.payments p
                          where p.order_id = f.id and p.status in ('succeeded', 'partially_refunded', 'refunded')), 0)
             - coalesce((select sum(br.approved_amount) from public.booking_requests br
                          where br.order_id = f.id and br.kind in ('cancellation', 'refund') and br.status = 'completed'), 0)
             ), 0)
        from flagged f where f.status in ('paid', 'processing', 'completed', 'cancelled', 'refunded')
    ),
    'matching', (select count(*) from matching),
    'ids', (select coalesce(jsonb_agg(id order by created_at desc, id desc), '[]'::jsonb)
            from (select id, created_at from matching
                  order by created_at desc, id desc
                  offset greatest(p_offset, 0) limit greatest(p_limit, 0)) pg)
  ) into v_result;

  return v_result;
end;
$function$;
