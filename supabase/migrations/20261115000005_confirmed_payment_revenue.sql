-- All USD collection reports share the same confirmed-payment ledger.
-- Offline bank/cash and online receipts have identical accounting treatment.
-- Internal helper: callers must use an admin-gated report function.
create function public._admin_collection_entries()
returns table(order_id uuid, occurred_at timestamptz, amount numeric)
language sql stable set search_path = public as $$
  select p.order_id, coalesce(p.paid_at, o.paid_at, p.created_at), p.amount
  from public.payments p join public.orders o on o.id = p.order_id
  where p.status in ('succeeded', 'partially_refunded', 'refunded') and p.currency = 'USD'
  union all
  select r.order_id, coalesce(r.resolved_at, r.updated_at, r.created_at), -r.approved_amount
  from public.booking_requests r
  where r.kind in ('refund', 'cancellation') and r.status = 'completed'
    and r.approved_amount > 0 and r.currency = 'USD';
$$;
revoke all on function public._admin_collection_entries() from public, anon, authenticated;

create or replace function public.admin_dashboard_totals()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_roles jsonb; v_users bigint;
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;
  select coalesce(jsonb_object_agg(role, n), '{}'::jsonb), coalesce(sum(n), 0)
    into v_roles, v_users from (select role, count(*) n from public.profiles group by role) r;
  return jsonb_build_object('usersByRole', v_roles, 'totalUsers', v_users,
    'totalOrders', (select count(*) from public.orders),
    'revenue', (select coalesce(sum(amount), 0) from public._admin_collection_entries()));
end;
$$;

-- Preserve the existing seven-value API. Booking counts use order creation;
-- money uses actual receipt/refund time, including payments on older orders.
create or replace function public.admin_order_activity(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_buckets jsonb;
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;
  with bookings as (
    select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24') bucket,
      count(*) orders,
      count(*) filter (where status in ('paid','completed')) paid_orders,
      count(*) filter (where status in ('paid','processing','completed')) settled_orders,
      count(*) filter (where status in ('paid','completed') and agency_id is not null) b2b_orders
    from public.orders where created_at >= p_from and created_at <= p_to group by 1
  ), money as (
    select to_char(e.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24') bucket,
      sum(e.amount) revenue, coalesce(sum(e.amount) filter (where o.agency_id is not null), 0) b2b_revenue
    from public._admin_collection_entries() e join public.orders o on o.id = e.order_id
    where e.occurred_at >= p_from and e.occurred_at <= p_to group by 1
  )
  select coalesce(jsonb_object_agg(coalesce(b.bucket,m.bucket), jsonb_build_array(
    coalesce(b.orders,0), coalesce(b.paid_orders,0), coalesce(m.revenue,0),
    coalesce(b.settled_orders,0), coalesce(m.revenue,0), coalesce(b.b2b_orders,0), coalesce(m.b2b_revenue,0))), '{}'::jsonb)
    into v_buckets from bookings b full join money m on m.bucket=b.bucket;
  return v_buckets;
end;
$$;

create or replace function public.admin_agent_leaderboard(p_from timestamptz, p_to timestamptz, p_limit int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_rows jsonb;
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('name',name,'orders',orders,'revenue',revenue) order by revenue desc,name), '[]'::jsonb)
    into v_rows from (
      select coalesce(a.name,'—') name, count(distinct e.order_id) filter (where e.amount > 0) orders, sum(e.amount) revenue
      from public._admin_collection_entries() e join public.orders o on o.id=e.order_id
      left join public.agencies a on a.id=o.agency_id
      where o.agency_id is not null and e.occurred_at >= p_from and e.occurred_at <= p_to
      group by o.agency_id,a.name order by revenue desc,name limit greatest(p_limit,0)
    ) t;
  return v_rows;
end;
$$;

-- Orders and dashboard totals now agree, including partially paid orders.
-- Orders workspace: globally sorted pages and search across order, visa and customer references.
CREATE OR REPLACE FUNCTION public.admin_order_workspace(p_filter text, p_today date, p_offset integer, p_limit integer, p_sort text, p_search text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_result jsonb;
  v_term text := btrim(regexp_replace(left(lower(coalesce(p_search, '')), 100), '[^[:alnum:]@ .+-]', ' ', 'g'));
begin
  if not public.is_admin() then
    raise exception 'not authorised';
  end if;

  if p_sort not in ('newest', 'oldest') or p_sort is null then
    raise exception 'Invalid order sort.';
  end if;

  with q as (
    select
      o.id,
      o.status,
      o.total,
      o.created_at,
      lower(concat_ws(' ', o.order_number, customer.full_name, customer.email, guest.full_name,
        (select string_agg(va.application_ref, ' ') from public.order_items oi
         join public.visa_applications va on va.id = oi.visa_application_id where oi.order_id = o.id)
      )) as search_text,
      (o.status in ('pending_payment', 'held', 'partially_paid') and exists (
        select 1 from public.payments p where p.order_id = o.id and p.status = 'requires_action'
      )) as needs_action,
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
          select public._iso_date_or_null(coalesce(va.travel_details ->> 'arrival_date', va.travel_details ->> 'arrivalDate'))
          from public.order_items oi join public.visa_applications va on va.id = oi.visa_application_id
          where oi.order_id = o.id and oi.item_type = 'visa'
        ) dates
      ) as travel_start
    from public.orders o
    left join public.profiles customer on customer.id = o.customer_id
    left join public.agency_customers guest on guest.id = o.agency_customer_id
  ),
  flagged as (
    select q.*,
      (travel_start between p_today and p_today + 30 and status <> 'cancelled') as soon
    from q
  ),
  matching as (
    select id, created_at from flagged
    where (btrim(coalesce(p_search, '')) = '' or (v_term <> '' and search_text like '%' || v_term || '%')) and case p_filter
      when 'all' then true
      when 'action' then needs_action
      when 'upcoming' then soon
      else status::text = p_filter
    end
  ),
  ranked as (
    select id, row_number() over (order by
      case when p_sort = 'oldest' then created_at end asc,
      case when p_sort = 'newest' then created_at end desc,
      case when p_sort = 'oldest' then id end asc,
      id desc
    ) as position from matching
  )
  select jsonb_build_object(
    'total', (select count(*) from flagged),
    'action', (select count(*) from flagged where needs_action),
    'upcoming', (select count(*) from flagged where soon),
    'byStatus', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                 from (select status, count(*) as n from flagged group by status) s),
    'settledCount', (select count(*) from flagged where status in ('paid', 'processing', 'completed')),
    -- Includes received deposits and retained fees on closed orders.
    'settledRevenue', (select coalesce(sum(amount), 0) from public._admin_collection_entries()),
    'matching', (select count(*) from matching),
    'ids', (select coalesce(jsonb_agg(id order by position), '[]'::jsonb)
            from (select id, position from ranked order by position
                  offset greatest(p_offset, 0) limit least(greatest(p_limit, 0), 100)) pg)
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.admin_order_workspace(text,date,integer,integer,text,text) from public,anon;
grant execute on function public.admin_order_workspace(text,date,integer,integer,text,text) to authenticated;

revoke all on function public.admin_dashboard_totals() from public, anon;
revoke all on function public.admin_order_activity(timestamptz,timestamptz) from public, anon;
revoke all on function public.admin_agent_leaderboard(timestamptz,timestamptz,int) from public, anon;
grant execute on function public.admin_dashboard_totals() to authenticated;
grant execute on function public.admin_order_activity(timestamptz,timestamptz) to authenticated;
grant execute on function public.admin_agent_leaderboard(timestamptz,timestamptz,int) to authenticated;
