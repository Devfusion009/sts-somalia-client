-- Dashboard, report and list aggregates computed in the database.
--
-- These numbers were summed in the app from row lists, and PostgREST returns
-- at most max_rows (1000) rows per request, so past 1000 matching rows every
-- one of them silently stopped growing: the admin dashboard's stat cards,
-- revenue chart, B2B/B2C split, agent leaderboard, bookings by type, top
-- hotels and visa pipeline; the agent dashboard's period metrics; the agent
-- customer list's per-customer totals; and the admin Orders filters, chip
-- counts and stat tiles (an explicit .limit(1000) there).
--
-- Time series come back as hourly UTC buckets keyed 'YYYY-MM-DDTHH'. The app
-- folds those into its hour/day/week buckets with the same bucketKey() it
-- used on raw timestamps, so the charts keep their current bucketing.
--
-- Each function is SECURITY DEFINER with an explicit gate in its first
-- statement — the agency_earnings_summary pattern — so one authorisation
-- check replaces a per-row RLS evaluation over the whole range.

-- ----------------------------------------------------------------------------
-- 1. Admin dashboard
-- ----------------------------------------------------------------------------
-- Per hour: [all orders, paid+completed count, paid+completed revenue,
-- paid+processing+completed count, paid+processing+completed revenue,
-- B2B paid+completed count, B2B paid+completed revenue].
create or replace function public.admin_order_activity(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_buckets jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorised';
  end if;

  select coalesce(jsonb_object_agg(bucket, jsonb_build_array(
           orders, paid_orders, paid_revenue, settled_orders, settled_revenue, b2b_orders, b2b_revenue)), '{}'::jsonb)
    into v_buckets
  from (
    select
      to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24') as bucket,
      count(*) as orders,
      count(*) filter (where status in ('paid', 'completed')) as paid_orders,
      coalesce(sum(total) filter (where status in ('paid', 'completed')), 0) as paid_revenue,
      count(*) filter (where status in ('paid', 'processing', 'completed')) as settled_orders,
      coalesce(sum(total) filter (where status in ('paid', 'processing', 'completed')), 0) as settled_revenue,
      count(*) filter (where status in ('paid', 'completed') and agency_id is not null) as b2b_orders,
      coalesce(sum(total) filter (where status in ('paid', 'completed') and agency_id is not null), 0) as b2b_revenue
    from public.orders
    where created_at >= p_from and created_at <= p_to
    group by 1
  ) b;

  return v_buckets;
end;
$$;

-- Signups per hour within the range, plus everyone who registered before it.
create or replace function public.admin_signup_activity(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_baseline bigint;
  v_buckets jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorised';
  end if;

  select count(*) into v_baseline from public.profiles where created_at < p_from;

  select coalesce(jsonb_object_agg(bucket, n), '{}'::jsonb) into v_buckets
  from (
    select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24') as bucket, count(*) as n
    from public.profiles
    where created_at >= p_from and created_at <= p_to
    group by 1
  ) b;

  return jsonb_build_object('baseline', v_baseline, 'buckets', v_buckets);
end;
$$;

-- Top agencies by paid+completed revenue within the range.
create or replace function public.admin_agent_leaderboard(p_from timestamptz, p_to timestamptz, p_limit int)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_rows jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorised';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'orders', orders, 'revenue', revenue) order by revenue desc, name), '[]'::jsonb)
    into v_rows
  from (
    select coalesce(a.name, '—') as name, count(*) as orders, sum(o.total) as revenue
    from public.orders o
    left join public.agencies a on a.id = o.agency_id
    where o.agency_id is not null
      and o.status in ('paid', 'completed')
      and o.created_at >= p_from and o.created_at <= p_to
    group by o.agency_id, a.name
    order by revenue desc, name
    limit greatest(p_limit, 0)
  ) t;

  return v_rows;
end;
$$;

-- Order items on paid+processing+completed orders placed within the range.
create or replace function public.admin_bookings_by_type(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_counts jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorised';
  end if;

  select coalesce(jsonb_object_agg(item_type, n), '{}'::jsonb) into v_counts
  from (
    select oi.item_type, count(*) as n
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.status in ('paid', 'processing', 'completed')
      and o.created_at >= p_from and o.created_at <= p_to
    group by oi.item_type
  ) t;

  return v_counts;
end;
$$;

-- All-time top hotels by confirmed+completed booking revenue.
create or replace function public.admin_top_hotels(p_limit int)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_rows jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorised';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'city', city, 'bookings', bookings, 'revenue', revenue) order by revenue desc, name), '[]'::jsonb)
    into v_rows
  from (
    select h.name, h.city, count(*) as bookings, sum(b.total_price) as revenue
    from public.hotel_bookings b
    join public.hotels h on h.id = b.hotel_id
    where b.status in ('confirmed', 'completed')
    group by h.id, h.name, h.city
    order by revenue desc, h.name
    limit greatest(p_limit, 0)
  ) t;

  return v_rows;
end;
$$;

-- Submitted visa applications by status (drafts excluded).
create or replace function public.admin_visa_status_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_counts jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorised';
  end if;

  select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) into v_counts
  from (
    select status, count(*) as n from public.visa_applications where status <> 'draft' group by status
  ) t;

  return v_counts;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Admin Orders queue
-- ----------------------------------------------------------------------------
-- One pass over orders yields the filter chip counts, the stat tiles and the
-- ids of the requested page. An order's travel start is the earliest date
-- across its items — the same dates the page's describeOrderItem() reads:
-- hotel check-in, flight departure, Umrah departure, hall start, and the
-- visa arrivalDate inside travel_details. "Needs action" is a payment
-- waiting on a human (requires_action); "Travelling soon" is a travel start
-- 0–30 days from p_today on an order that is not cancelled.
-- travel_details is free-form jsonb; an unparseable date reads as no date.
create or replace function public._iso_date_or_null(p_value text)
returns date
language plpgsql
immutable
set search_path to 'public'
as $$
begin
  if p_value !~ '^\d{4}-\d{2}-\d{2}' then
    return null;
  end if;
  return left(p_value, 10)::date;
exception when others then
  return null;
end;
$$;

create or replace function public.admin_order_queue(p_filter text, p_today date, p_offset int, p_limit int)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
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
    'settledRevenue', (select coalesce(sum(total), 0) from flagged where status in ('paid', 'processing', 'completed')),
    'matching', (select count(*) from matching),
    'ids', (select coalesce(jsonb_agg(id order by created_at desc, id desc), '[]'::jsonb)
            from (select id, created_at from matching
                  order by created_at desc, id desc
                  offset greatest(p_offset, 0) limit greatest(p_limit, 0)) pg)
  ) into v_result;

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Agent portal
-- ----------------------------------------------------------------------------
-- Per hour for one agency: [order items booked, paid+processing+completed
-- revenue, earned, markup earned, commission earned], plus the currency of
-- the most recent paid order. Reversed ledger entries are excluded.
create or replace function public.agency_period_activity(p_agency_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_buckets jsonb;
  v_currency text;
begin
  if not (public.is_agency_member(p_agency_id) or public.is_admin()) then
    raise exception 'not authorised';
  end if;

  select coalesce(jsonb_object_agg(bucket, jsonb_build_array(items, revenue, earned, markup, commission)), '{}'::jsonb)
    into v_buckets
  from (
    select bucket, sum(items) as items, sum(revenue) as revenue,
           sum(earned) as earned, sum(markup) as markup, sum(commission) as commission
    from (
      select
        to_char(o.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24') as bucket,
        (select count(*) from public.order_items oi where oi.order_id = o.id) as items,
        case when o.status in ('paid', 'processing', 'completed') then o.total else 0 end as revenue,
        0::numeric as earned, 0::numeric as markup, 0::numeric as commission
      from public.orders o
      where o.agency_id = p_agency_id and o.created_at >= p_from and o.created_at <= p_to
      union all
      select
        to_char(e.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24'),
        0, 0, e.amount, e.markup_amount, e.commission_amount
      from public.agency_commission_entries e
      where e.agency_id = p_agency_id and e.status <> 'reversed'
        and e.created_at >= p_from and e.created_at <= p_to
    ) rows
    group by bucket
  ) b;

  select o.currency into v_currency
  from public.orders o
  where o.agency_id = p_agency_id and o.status in ('paid', 'processing', 'completed')
    and o.created_at >= p_from and o.created_at <= p_to
  order by o.created_at desc
  limit 1;

  return jsonb_build_object('buckets', v_buckets, 'currency', v_currency);
end;
$$;

-- One page of an agency's customers with their booking totals. p_search is
-- matched as a literal substring of name, email or phone. p_sort 'recent'
-- orders by last booking (never-booked last), anything else by name.
create or replace function public.agency_customer_page(
  p_agency_id uuid, p_search text, p_sort text, p_offset int, p_limit int)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_pattern text;
  v_result jsonb;
begin
  if not (public.is_agency_member(p_agency_id) or public.is_admin()) then
    raise exception 'not authorised';
  end if;

  v_pattern := case when nullif(btrim(p_search), '') is null then null
    else '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%' end;

  with matched as (
    select c.id, c.full_name, c.email::text as email, c.phone, c.notes, c.profile_id, c.created_at
    from public.agency_customers c
    where c.agency_id = p_agency_id
      and (v_pattern is null
           or c.full_name ilike v_pattern
           or c.email::text ilike v_pattern
           or c.phone ilike v_pattern)
  ),
  stats as (
    select m.*,
      (select count(*) from public.orders o where o.agency_customer_id = m.id and o.agency_id = p_agency_id) as bookings,
      (select coalesce(sum(o.total), 0) from public.orders o
        where o.agency_customer_id = m.id and o.agency_id = p_agency_id
          and o.status in ('paid', 'processing', 'completed')) as spent,
      (select o.currency from public.orders o
        where o.agency_customer_id = m.id and o.agency_id = p_agency_id
          and o.status in ('paid', 'processing', 'completed')
        order by o.created_at desc limit 1) as currency,
      (select max(o.created_at) from public.orders o
        where o.agency_customer_id = m.id and o.agency_id = p_agency_id) as last_booking_at
    from matched m
  ),
  page as (
    select * from stats
    order by
      case when p_sort = 'recent' then last_booking_at end desc nulls last,
      full_name, id
    offset greatest(p_offset, 0) limit greatest(p_limit, 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from matched),
    'registered', (select count(*) from matched where profile_id is not null),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object(
               'id', id, 'full_name', full_name, 'email', email, 'phone', phone, 'notes', notes,
               'profile_id', profile_id, 'created_at', created_at, 'bookings', bookings,
               'spent', spent, 'currency', currency, 'lastBookingAt', last_booking_at)
             order by case when p_sort = 'recent' then last_booking_at end desc nulls last, full_name, id), '[]'::jsonb)
             from page)
  ) into v_result;

  return v_result;
end;
$$;

-- Customer stats look orders up by client.
create index if not exists orders_agency_customer_idx
  on public.orders (agency_customer_id) where agency_customer_id is not null;

revoke all on function public.admin_order_activity(timestamptz, timestamptz) from public, anon;
revoke all on function public.admin_signup_activity(timestamptz, timestamptz) from public, anon;
revoke all on function public.admin_agent_leaderboard(timestamptz, timestamptz, int) from public, anon;
revoke all on function public.admin_bookings_by_type(timestamptz, timestamptz) from public, anon;
revoke all on function public.admin_top_hotels(int) from public, anon;
revoke all on function public.admin_visa_status_counts() from public, anon;
revoke all on function public.admin_order_queue(text, date, int, int) from public, anon;
revoke all on function public.agency_period_activity(uuid, timestamptz, timestamptz) from public, anon;
revoke all on function public.agency_customer_page(uuid, text, text, int, int) from public, anon;
grant execute on function public.admin_order_activity(timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_signup_activity(timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_agent_leaderboard(timestamptz, timestamptz, int) to authenticated;
grant execute on function public.admin_bookings_by_type(timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_top_hotels(int) to authenticated;
grant execute on function public.admin_visa_status_counts() to authenticated;
grant execute on function public.admin_order_queue(text, date, int, int) to authenticated;
grant execute on function public.agency_period_activity(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.agency_customer_page(uuid, text, text, int, int) to authenticated;
