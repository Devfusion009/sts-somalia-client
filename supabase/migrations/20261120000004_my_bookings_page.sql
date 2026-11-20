-- Bounded unified booking references. The caller's RLS remains in force.
-- Trip grouping looks up an order by its vertical booking ID. Existing
-- order_items_order_idx serves order reads, not this reverse lookup.
create index if not exists order_items_hotel_booking_page_idx on public.order_items(hotel_booking_id) where hotel_booking_id is not null;
create index if not exists order_items_flight_booking_page_idx on public.order_items(flight_booking_id) where flight_booking_id is not null;
create index if not exists order_items_visa_application_page_idx on public.order_items(visa_application_id) where visa_application_id is not null;
create index if not exists order_items_umrah_booking_page_idx on public.order_items(umrah_booking_id) where umrah_booking_id is not null;
create index if not exists order_items_hall_booking_page_idx on public.order_items(hall_booking_id) where hall_booking_id is not null;

create function public.my_booking_page(
  p_page integer default 1,
  p_size integer default 20,
  p_filter text default 'all',
  p_type text default null,
  p_personal_only boolean default false,
  p_view text default 'list',
  p_sort text default 'created'
) returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to view bookings.'; end if;
  if p_page < 1 or p_page > 100000 or p_size < 1 or p_size > 50 then raise exception 'Invalid booking page.'; end if;
  if p_filter not in ('all','upcoming','past','cancelled') then raise exception 'Invalid booking filter.'; end if;
  if p_type is not null and p_type not in ('hotel','flight','visa','umrah','hall') then raise exception 'Invalid booking type.'; end if;
  if p_view not in ('list','trips') then raise exception 'Invalid booking view.'; end if;
  if p_sort not in ('created','travel') then raise exception 'Invalid booking sort.'; end if;

  with owned as (
    select 'hotel'::text as kind, h.id, h.created_at, h.status::text as status, h.check_in::date as travel_day
      from public.hotel_bookings h where h.customer_id=auth.uid() or (not p_personal_only and h.booked_by=auth.uid())
    union all
    select 'flight', f.id, f.created_at, f.status::text, (f.depart_at at time zone 'UTC')::date
      from public.flight_bookings f where f.customer_id=auth.uid() or (not p_personal_only and f.booked_by=auth.uid())
    union all
    select 'visa', v.id, v.created_at, v.status::text,
      case when v.travel_details->>'arrivalDate' ~ '^\d{4}-\d{2}-\d{2}$' then (v.travel_details->>'arrivalDate')::date else null end
      from public.visa_applications v where v.applicant_profile_id=auth.uid() or (not p_personal_only and v.submitted_by=auth.uid())
    union all
    select 'umrah', u.id, u.created_at, u.status::text, coalesce(d.departure_date, cr.departure_date)
      from public.umrah_bookings u
      left join public.umrah_package_departures d on d.id=u.departure_id
      left join public.umrah_custom_requests cr on cr.id=u.custom_request_id
      where u.customer_id=auth.uid() or (not p_personal_only and u.booked_by=auth.uid())
    union all
    select 'hall', h.id, h.created_at, h.status::text, h.start_date::date
      from public.hall_bookings h where h.customer_id=auth.uid() or (not p_personal_only and h.booked_by=auth.uid())
  ), categorized as (
    select kind,id,created_at,travel_day,
      case when status in ('cancelled','rejected','refunded','failed','no_show','expired') then 'cancelled'
           when status in ('completed','issued') then 'past'
           when travel_day is not null and travel_day < (now() at time zone 'UTC')::date then 'past'
           else 'upcoming' end as timeframe
    from owned where p_type is null or kind=p_type
  ), selected as (
    select * from categorized where p_filter='all' or timeframe=p_filter
  ), keyed as (
    select s.*,
      case when p_view='trips' then coalesce((
        select 'order:'||oi.order_id::text from public.order_items oi
        where (s.kind='hotel' and oi.hotel_booking_id=s.id)
           or (s.kind='flight' and oi.flight_booking_id=s.id)
           or (s.kind='visa' and oi.visa_application_id=s.id)
           or (s.kind='umrah' and oi.umrah_booking_id=s.id)
           or (s.kind='hall' and oi.hall_booking_id=s.id)
        order by oi.order_id limit 1
      ),s.kind||':'||s.id::text) else s.kind||':'||s.id::text end as page_key
    from selected s
  ), groups as (
    select page_key,max(created_at) as newest,min(travel_day) as nearest from keyed group by page_key
  ), selected_groups as (
    select page_key from groups
    order by (case when p_sort='travel' then nearest end) asc nulls last,
             newest desc,page_key
    limit p_size offset (p_page-1)*p_size
  ), page_rows as (
    select k.kind,k.id,k.created_at,k.travel_day from keyed k join selected_groups g using(page_key)
  )
  select jsonb_build_object(
    'total',(select count(*) from groups),
    'counts',(select jsonb_build_object('upcoming',count(*) filter(where timeframe='upcoming'),'past',count(*) filter(where timeframe='past'),'cancelled',count(*) filter(where timeframe='cancelled')) from categorized),
    'refs',coalesce((select jsonb_agg(jsonb_build_object('type',kind,'id',id)
      order by (case when p_sort='travel' then travel_day end) asc nulls last,created_at desc,kind,id)
      from page_rows),'[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.my_booking_page(integer,integer,text,text,boolean,text,text) from public,anon;
grant execute on function public.my_booking_page(integer,integer,text,text,boolean,text,text) to authenticated;
