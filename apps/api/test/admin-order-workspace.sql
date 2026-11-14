-- Isolated empty PostgreSQL instance ONLY. Never run against an application database.
\set ON_ERROR_STOP on
begin;
create role anon;
create role authenticated;
create function public.is_admin() returns boolean language sql stable as $$ select current_setting('test.admin',true)='yes' $$;
create function public._iso_date_or_null(text) returns date language sql immutable as $$ select $1::date $$;
create table profiles(id uuid primary key,full_name text,email text);
create table agency_customers(id uuid primary key,full_name text);
create table orders(id uuid primary key,order_number text,status text,total numeric,created_at timestamptz,customer_id uuid,agency_customer_id uuid);
create table payments(order_id uuid,status text,amount numeric);
create table order_items(order_id uuid,item_type text,hotel_booking_id uuid,flight_booking_id uuid,umrah_booking_id uuid,hall_booking_id uuid,visa_application_id uuid);
create table hotel_bookings(id uuid,check_in date);
create table flight_bookings(id uuid,depart_at timestamptz);
create table umrah_bookings(id uuid,departure_id uuid);
create table umrah_package_departures(id uuid,departure_date date);
create table hall_bookings(id uuid,start_date date);
create table visa_applications(id uuid,application_ref text,travel_details jsonb);
create table booking_requests(order_id uuid,approved_amount numeric,kind text,status text);
\ir ../../../supabase/migrations/20261114000010_admin_order_workspace.sql
select set_config('test.admin','yes',true);
insert into profiles values('00000000-0000-4000-8000-000000000001','Booking Customer','booking@example.test');
insert into agency_customers values('00000000-0000-4000-8000-000000000002','Agency Traveller');
insert into orders
select ('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid, 'STS-TEST-'||lpad(i::text,3,'0'),
       'pending_payment',100,'2026-10-01'::timestamptz+i*interval '1 day','00000000-0000-4000-8000-000000000001',null
from generate_series(1,32) i;
-- Latest order with an old application reference, like a resumed Saudi visa.
insert into orders values('10000000-0000-4000-8000-000000000073','STS-2026-000073','pending_payment',450,'2026-11-14 16:26+00','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');
insert into visa_applications values('20000000-0000-4000-8000-000000000006','STS-VISA-2026-000006','{"arrival_date":"2026-11-26"}');
insert into order_items(order_id,item_type,visa_application_id) values('10000000-0000-4000-8000-000000000073','visa','20000000-0000-4000-8000-000000000006');
insert into payments values('10000000-0000-4000-8000-000000000073','requires_action',450);
update orders set status='paid' where order_number='STS-TEST-001';
update orders set status='cancelled' where order_number='STS-TEST-002';
insert into payments values('10000000-0000-4000-8000-000000000002','requires_action',100);
insert into payments values('10000000-0000-4000-8000-000000000001','partially_refunded',100);
insert into booking_requests values('10000000-0000-4000-8000-000000000001',20,'refund','completed');
do $$ declare q jsonb; ids1 jsonb; ids2 jsonb; begin
 q:=admin_order_workspace('all','2026-11-14',0,25,'newest','');
 if q->'ids'->>0<>'10000000-0000-4000-8000-000000000073' then raise exception 'Newest booking is not first'; end if;
 if (q->>'matching')::int<>33 or jsonb_array_length(q->'ids')<>25 then raise exception 'Wrong total/page size'; end if;
 if (q->>'settledRevenue')::numeric<>80 then raise exception 'Net revenue changed'; end if;
 ids1:=q->'ids';
 ids2:=admin_order_workspace('all','2026-11-14',25,25,'newest','')->'ids';
 if jsonb_array_length(ids2)<>8 or exists(select 1 from jsonb_array_elements_text(ids1) a join jsonb_array_elements_text(ids2) b on a.value=b.value) then raise exception 'Pagination lost or repeated orders'; end if;
 q:=admin_order_workspace('all','2026-11-14',0,25,'oldest','');
 if q->'ids'->>0<>'10000000-0000-4000-8000-000000000001' then raise exception 'Oldest first failed'; end if;
 q:=admin_order_workspace('all','2026-11-14',0,25,'newest','STS-VISA-2026-000006');
 if (q->>'matching')::int<>1 or q->'ids'->>0<>'10000000-0000-4000-8000-000000000073' then raise exception 'Visa reference search failed'; end if;
 if (admin_order_workspace('all','2026-11-14',0,25,'newest','agency traveller')->>'matching')::int<>1 then raise exception 'Agency guest search failed'; end if;
 if (admin_order_workspace('all','2026-11-14',0,25,'newest','booking@example.test')->>'matching')::int<>33 then raise exception 'Customer search failed'; end if;
 if (admin_order_workspace('paid','2026-11-14',0,25,'newest','STS-2026-000073')->>'matching')::int<>0 then raise exception 'Search ignored status'; end if;
 if (admin_order_workspace('action','2026-11-14',0,25,'newest','')->>'matching')::int<>1 then raise exception 'Pending office request hidden'; end if;
 if (admin_order_workspace('upcoming','2026-11-14',0,25,'newest','')->>'matching')::int<>1 then raise exception 'Saved visa travel date ignored'; end if;
 if (admin_order_workspace('all','2026-11-14',0,25,'newest','no matching order')->>'matching')::int<>0 then raise exception 'Empty search failed'; end if;
 if (admin_order_workspace('all','2026-11-14',0,25,'newest','%_()')->>'matching')::int<>0 then raise exception 'Wildcards matched all orders'; end if;
 -- Legacy camel-case travel dates remain supported.
 update visa_applications set travel_details='{"arrivalDate":"2026-11-26"}';
 if (admin_order_workspace('upcoming','2026-11-14',0,25,'newest','')->>'matching')::int<>1 then raise exception 'Legacy visa date ignored'; end if;
 -- Identical timestamps must not scramble rows between pages.
 update orders set created_at='2026-11-14 16:26+00';
 ids1:=admin_order_workspace('all','2026-11-14',0,25,'newest','')->'ids';
 ids2:=admin_order_workspace('all','2026-11-14',25,25,'newest','')->'ids';
 if ids1->>0<>'10000000-0000-4000-8000-000000000073' or exists(select 1 from jsonb_array_elements_text(ids1) a join jsonb_array_elements_text(ids2) b on a.value=b.value) then raise exception 'Timestamp tie pagination failed'; end if;
end $$;
select set_config('test.admin','no',true);
set local role authenticated;
do $$ begin
 begin perform admin_order_workspace('all','2026-11-14',0,25,'newest',''); exception when others then
  if sqlerrm<>'not authorised' then raise; end if; return;
 end;
 raise exception 'Non-admin could read orders';
end $$;
reset role;
rollback;
\echo 'PASS: newest/oldest, global pagination, search, pending office visibility, visa dates, net revenue, admin guard'
