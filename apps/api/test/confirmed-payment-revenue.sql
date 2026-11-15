-- Isolated empty PostgreSQL instance ONLY. Never run on an application database.
\set ON_ERROR_STOP on
begin;
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
create function public.is_admin() returns boolean language sql stable as $$ select current_setting('test.admin',true)='yes' $$;
create table profiles(id uuid primary key,is_platform_admin boolean default false,role text,full_name text,email text);
create table notifications(profile_id uuid,type text,title text,body text,data jsonb);
create type order_status as enum ('pending_payment','held','partially_paid','paid','processing','completed','cancelled','refunded');
create table orders(id uuid primary key,customer_id uuid,status order_status,total numeric,currency text,hold_expires_at timestamptz,order_number text,created_at timestamptz default '2020-01-01',paid_at timestamptz,agency_id uuid,agency_customer_id uuid);
create table payments(id uuid primary key,order_id uuid references orders(id),provider text,method_label text,status text,amount numeric,currency text,paid_at timestamptz,created_at timestamptz default now());
create function public.can_access_order(v_id uuid) returns boolean language sql security definer stable as $$ select exists(select 1 from orders where id=v_id and (customer_id=auth.uid() or public.is_admin())) $$;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(bucket_id text,name text,owner_id text);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
create function confirm_manual_payment(uuid) returns void language sql as $$ select $$;
grant usage on schema public,auth,storage to authenticated;
grant select on payments,orders to authenticated;
grant select,insert,delete on storage.objects to authenticated;
\ir ../../../supabase/migrations/20261114000009_payment_proofs.sql

create function public._iso_date_or_null(text) returns date language sql immutable as $$ select $1::date $$;
create table agencies(id uuid primary key,name text);
create table agency_customers(id uuid primary key,full_name text);
create table booking_requests(order_id uuid,kind text,status text,approved_amount numeric,currency text,resolved_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now());
create table order_items(order_id uuid,item_type text,hotel_booking_id uuid,flight_booking_id uuid,umrah_booking_id uuid,hall_booking_id uuid,visa_application_id uuid);
create table hotel_bookings(id uuid,check_in date);
create table flight_bookings(id uuid,depart_at timestamptz);
create table umrah_bookings(id uuid,departure_id uuid);
create table umrah_package_departures(id uuid,departure_date date);
create table hall_bookings(id uuid,start_date date);
create table visa_applications(id uuid,application_ref text,travel_details jsonb);

-- Settlement trigger from 20260819000002; confirmation and reports use actual migrations.
create or replace function public.handle_payment_succeeded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  paid_total numeric;
  order_total numeric;
begin
  if new.status = 'succeeded' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.paid_at := coalesce(new.paid_at, now());

    select coalesce(sum(amount), 0) into paid_total
      from public.payments
      where order_id = new.order_id and status = 'succeeded' and id is distinct from new.id;
    paid_total := paid_total + new.amount;

    select total into order_total from public.orders where id = new.order_id;

    update public.orders
      set status = case when paid_total >= order_total then 'paid'::order_status else 'partially_paid'::order_status end,
          paid_at = case when paid_total >= order_total then coalesce(paid_at, now()) else paid_at end
      where id = new.order_id and status in ('pending_payment', 'held', 'partially_paid');
  end if;
  return new;
end;
$$;
create trigger payments_settle_order before insert or update of status on payments for each row execute function handle_payment_succeeded();
\ir ../../../supabase/migrations/20261115000005_confirmed_payment_revenue.sql
select set_config('test.admin','yes',true);
select set_config('test.uid','00000000-0000-4000-8000-000000000001',true);
insert into profiles values('00000000-0000-4000-8000-000000000001',true,'admin','QA Admin','qa@example.test');
insert into agencies values('90000000-0000-4000-8000-000000000001','QA Agency');
insert into orders(id,customer_id,status,total,currency,order_number)
select ('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid, '00000000-0000-4000-8000-000000000001','pending_payment',
case i when 1 then 156 when 2 then 200 when 3 then 40 when 4 then 100 else 500 end,'USD','QA-'||i from generate_series(1,6) i;
update orders set agency_id='90000000-0000-4000-8000-000000000001' where order_number='QA-1';
insert into payments(id,order_id,provider,method_label,status,amount,currency)
select ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid, ('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
case when i in (1,2) then 'manual' else 'stripe' end,
case i when 1 then 'Bank Transfer' when 2 then 'Pay at Office' else 'Card' end,
case when i in (3,4,5) then 'succeeded' when i=6 then 'failed' else 'requires_action' end,
case i when 1 then 156 when 2 then 60 when 3 then 40 when 4 then 100 else 500 end,
case when i=5 then 'EUR' else 'USD' end from generate_series(1,6) i;
update payments set status='partially_refunded' where id='20000000-0000-4000-8000-000000000004';
insert into booking_requests(order_id,kind,status,approved_amount,currency,resolved_at) values
('10000000-0000-4000-8000-000000000004','refund','completed',20,'USD',now()),
('10000000-0000-4000-8000-000000000004','refund','approved',10,'USD',now());
create function assert_revenue(expected numeric) returns void language plpgsql as $$
declare dashboard numeric; workspace numeric;
begin
 dashboard := (admin_dashboard_totals()->>'revenue')::numeric;
 workspace := (admin_order_workspace('all',current_date,0,20,'newest','')->>'settledRevenue')::numeric;
 if dashboard<>expected or workspace<>expected then raise exception 'Expected %, dashboard %, orders %', expected,dashboard,workspace; end if;
end $$;
select assert_revenue(120);
-- A submitted bank screenshot alone does not count as received money.
insert into payment_proofs(id,payment_id,storage_path,file_name,content_type,file_size,uploaded_by)
values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','qa/proof.png','proof.png','image/png',1,'00000000-0000-4000-8000-000000000001');
select assert_revenue(120);
select confirm_manual_payment('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001');
select assert_revenue(276);
-- Repeated bank approval cannot add money a second time.
select confirm_manual_payment('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001');
select assert_revenue(276);
select confirm_manual_payment('20000000-0000-4000-8000-000000000002');
select assert_revenue(336);
do $$ begin
 if (select status from orders where order_number='QA-2')<>'partially_paid' then raise exception 'Deposit should not mark order fully paid'; end if;
end $$;
insert into payments(id,order_id,provider,method_label,status,amount,currency) values('20000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000002','manual','Pay at Office','requires_action',140,'USD');
select confirm_manual_payment('20000000-0000-4000-8000-000000000007');
select assert_revenue(476);
-- Old bookings paid now appear in this period's revenue, not their 2020 creation period.
do $$ declare activity jsonb; total numeric; agency numeric; old_total numeric; begin
 activity := admin_order_activity(now()-interval '1 minute',now()+interval '1 minute');
 select sum((value->>2)::numeric),sum((value->>6)::numeric) into total,agency from jsonb_each(activity);
 if total<>476 or agency<>156 then raise exception 'Wrong receipt-period totals %, agency %',total,agency; end if;
 select coalesce(sum((value->>2)::numeric),0) into old_total from jsonb_each(admin_order_activity('2020-01-01','2020-01-02'));
 if old_total<>0 then raise exception 'Receipt booked to old order creation date'; end if;
 if (admin_agent_leaderboard(now()-interval '1 minute',now()+interval '1 minute',10)->0->>'revenue')::numeric<>156 then raise exception 'Agency offline receipt missing'; end if;
end $$;
-- Completed refunds deduct once; approved-but-unsent requests do not deduct.
insert into booking_requests(order_id,kind,status,approved_amount,currency,resolved_at) values('10000000-0000-4000-8000-000000000004','refund','completed',80,'USD',now());
update payments set status='refunded' where id='20000000-0000-4000-8000-000000000004';
update orders set status='refunded' where order_number='QA-4';
select assert_revenue(396);
-- Admin gate and private helper permissions.
select set_config('test.admin','no',true);
do $$ begin
 begin perform admin_dashboard_totals(); raise exception 'Expected denial'; exception when raise_exception then if sqlerrm<>'not authorised' then raise; end if; end;
 begin perform admin_order_activity(now(),now()); raise exception 'Expected denial'; exception when raise_exception then if sqlerrm<>'not authorised' then raise; end if; end;
end $$;
set local role authenticated;
do $$ begin
 begin perform * from _admin_collection_entries(); raise exception 'Expected helper denial'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
\echo 'PASS: bank/cash/online receipts, deposits, duplicate approval, refunds, receipt dates, USD scope, report parity and admin isolation'
