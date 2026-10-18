-- Query performance on the order tables, measured before writing it.
--
-- Measured on a local copy with 100k synthetic orders (rolled-back
-- transaction, signed in as a platform admin):
--   * newest 25 orders                  1577 ms -> 0.4 ms
--   * one agency's newest 25 orders     1298 ms -> 0.7 ms
--   * count of all orders               1564 ms -> 15 ms
--   * paid revenue, last 30 days          90 ms -> 2.6 ms
-- Two causes. No index matched `order by created_at`, so every list read
-- sorted the whole table. And the RLS policies called auth.uid() and
-- is_admin() bare, which Postgres re-evaluates for every row; wrapped in a
-- scalar sub-select they become an InitPlan, evaluated once per statement.
--
-- Nothing here changes who can read or write what. Every policy below keeps
-- its name, command, roles and boolean meaning; only the evaluation shape
-- changes (and OR operands are reordered, which is commutative).

-- ----------------------------------------------------------------------------
-- 1. Indexes for the list orderings the portals actually use
-- ----------------------------------------------------------------------------
-- Leading-column composites replace the single-column agency/customer
-- indexes, which they make redundant (same lookups, one less index to write).
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_agency_created_idx on public.orders (agency_id, created_at desc);
create index if not exists orders_customer_created_idx on public.orders (customer_id, created_at desc);
drop index if exists public.orders_agency_idx;
drop index if exists public.orders_customer_idx;

-- Signup trend and stat cards range over profiles.created_at.
create index if not exists profiles_created_at_idx on public.profiles (created_at);

-- ----------------------------------------------------------------------------
-- 2. RLS: evaluate session-constant checks once per statement
-- ----------------------------------------------------------------------------
-- The admin check leads the orders read policy so a platform admin's rows
-- are accepted without running the per-row agency membership lookup.
alter policy "orders: reads via ownership/agency/admin" on public.orders
  using (
    (select public.is_admin())
    or customer_id = (select auth.uid())
    or booked_by = (select auth.uid())
    or (agency_id is not null and public.is_agency_member(agency_id))
  );
alter policy "orders: creator creates own order" on public.orders
  with check (
    booked_by = (select auth.uid())
    and (customer_id = (select auth.uid()) or (agency_id is not null and public.is_agency_member(agency_id)))
  );

alter policy "orders: admin manage" on public.orders
  using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "order_items: admin manage" on public.order_items
  using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "payments: admin manage" on public.payments
  using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "invoices: admin manage" on public.invoices
  using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "hotel_bookings: admin manage" on public.hotel_bookings
  using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "agency_commission_entries: admin manage" on public.agency_commission_entries
  using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "agency_wallet_transactions: admin manage" on public.agency_wallet_transactions
  using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "notifications: admin manage" on public.notifications
  using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "audit_logs: admin read" on public.audit_logs
  using ((select public.is_admin()));

alter policy "hotel_bookings: customer reads own" on public.hotel_bookings
  using (customer_id = (select auth.uid()) or booked_by = (select auth.uid()));
alter policy "hotel_bookings: customer cancels own pending booking" on public.hotel_bookings
  using ((customer_id = (select auth.uid()) or booked_by = (select auth.uid())) and status = 'pending'::booking_status)
  with check (status = any (array['pending'::booking_status, 'cancelled'::booking_status]));
alter policy "hotel_bookings: customer creates own booking" on public.hotel_bookings
  with check (
    booked_by = (select auth.uid())
    and (customer_id = (select auth.uid()) or (agency_id is not null and public.is_agency_member(agency_id)))
  );

alter policy "notifications: self reads own" on public.notifications
  using (profile_id = (select auth.uid()));
alter policy "notifications: self marks read" on public.notifications
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

alter policy "profiles: admin read all" on public.profiles
  using ((select public.is_admin()));
alter policy "profiles: admin update all" on public.profiles
  using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "profiles: self read" on public.profiles
  using (id = (select auth.uid()));
alter policy "profiles: self update" on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- 3. Admin dashboard totals, aggregated in the database
-- ----------------------------------------------------------------------------
-- The dashboard summed these from row lists, and PostgREST returns at most
-- max_rows (1000) rows per request: past 1000 users or 1000 paid orders the
-- user count, role split and revenue silently stopped growing.
create or replace function public.admin_dashboard_totals()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_roles jsonb;
  v_users bigint;
  v_orders bigint;
  v_revenue numeric;
begin
  if not public.is_admin() then
    raise exception 'not authorised';
  end if;

  select coalesce(jsonb_object_agg(role, n), '{}'::jsonb), coalesce(sum(n), 0)
    into v_roles, v_users
  from (select role, count(*) as n from public.profiles group by role) r;

  select count(*), coalesce(sum(total) filter (where status in ('paid', 'completed')), 0)
    into v_orders, v_revenue
  from public.orders;

  return jsonb_build_object(
    'usersByRole', v_roles,
    'totalUsers', v_users,
    'totalOrders', v_orders,
    'revenue', v_revenue
  );
end;
$$;

revoke all on function public.admin_dashboard_totals() from public, anon;
grant execute on function public.admin_dashboard_totals() to authenticated;
