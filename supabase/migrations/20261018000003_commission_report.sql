-- Commission report totals for /agent/reports, aggregated in the database.
--
-- The page summed the whole commission ledger in the app, and PostgREST
-- returns at most max_rows (1000) rows per request: past 1000 entries in the
-- selected period, Total Earned, Earned This Month, the settled-booking count
-- and the By Month table silently stopped growing. The entries table itself
-- is now paginated; these figures come from here.
--
-- Same filters as the page: created_at within [p_from, p_to] when given, and
-- p_item_type keeps entries whose order holds at least one item of that type.
-- Months are UTC calendar months ('YYYY-MM'), as the page keyed them.
create or replace function public.agency_commission_report(
  p_agency_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_item_type text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_result jsonb;
begin
  if not (public.is_agency_member(p_agency_id) or public.is_admin()) then
    raise exception 'not authorised';
  end if;

  with entries as (
    select e.amount, e.commission_amount, e.markup_amount, e.status,
           to_char(e.created_at at time zone 'UTC', 'YYYY-MM') as month
    from public.agency_commission_entries e
    where e.agency_id = p_agency_id
      and (p_from is null or e.created_at >= p_from)
      and (p_to is null or e.created_at <= p_to)
      and (p_item_type is null or exists (
        select 1 from public.order_items oi
        where oi.order_id = e.order_id and oi.item_type::text = p_item_type))
  ),
  earning as (
    select * from entries where status <> 'reversed'
  )
  select jsonb_build_object(
    'entryCount', (select count(*) from entries),
    'earnedCount', (select count(*) from earning),
    'earnedTotal', (select coalesce(sum(amount), 0) from earning),
    'earnedThisMonth', (select coalesce(sum(amount), 0) from earning
                        where month = to_char(now() at time zone 'UTC', 'YYYY-MM')),
    'months', (select coalesce(jsonb_agg(jsonb_build_object(
                 'month', month, 'bookings', bookings, 'commission', commission,
                 'markup', markup, 'total', total) order by month desc), '[]'::jsonb)
               from (select month, count(*) as bookings, sum(commission_amount) as commission,
                            sum(markup_amount) as markup, sum(amount) as total
                     from earning group by month) m)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.agency_commission_report(uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.agency_commission_report(uuid, timestamptz, timestamptz, text) to authenticated;
