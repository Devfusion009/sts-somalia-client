-- Isolated test cluster ONLY. External auth, notifications and cancellation are
-- minimal fixtures; seat accounting, group booking and payment terms load real migrations.
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
create function public.is_admin() returns boolean language sql stable as $$ select coalesce(current_setting('test.admin',true),'')='yes' $$;
create function public.my_agency_ids() returns uuid[] language sql stable as $$ select case when current_setting('test.agent',true)='yes' then array['00000000-0000-0000-0000-000000000099'::uuid] else '{}'::uuid[] end $$;
create function public.is_agency_member(uuid) returns boolean language sql stable as $$ select $1=any(public.my_agency_ids()) $$;
create type order_status as enum('pending_payment','held','partially_paid','paid','processing','completed','cancelled','refunded');
create type listing_status as enum('draft','pending_review','published','suspended');
create type booking_status as enum('pending','confirmed','cancelled','completed','refunded','no_show','failed','waitlisted');
create type umrah_fulfillment_stage as enum('booked','confirmed','visa_processing','visa_issued','travel_confirmed','documents_ready','completed');
create type pilgrim_gender as enum('male','female');
create table umrah_packages(id uuid primary key default gen_random_uuid(),name text not null,slug text unique not null,description text,package_type text default 'group',duration_days smallint,includes jsonb default '[]',base_price numeric,currency text,status listing_status default 'draft',origin_iata text,destination_iata text,contact_person_name text,contact_person_phone text,contact_person_email text,contact_whatsapp text,meal_plan text default 'none',meals_note text,deposit_percent numeric,balance_due_days smallint default 30,full_payment_before_documents boolean default true);
create table umrah_package_departures(id uuid primary key default gen_random_uuid(),package_id uuid references umrah_packages on delete cascade,departure_date date,return_date date,total_seats int check(total_seats>0),booked_seats int default 0,price_override numeric,sales_close_days int default 0,status text default 'open');
create table umrah_package_pricing(package_id uuid,sharing smallint,price numeric);
create table umrah_package_hotels(package_id uuid,city text,nights int);
create table umrah_bookings(id uuid primary key default gen_random_uuid(),package_id uuid references umrah_packages,departure_id uuid references umrah_package_departures,customer_id uuid,booked_by uuid,agency_id uuid,num_pilgrims int,total_price numeric,currency text,room_sharing smallint,special_requests text,booking_kind text default 'group',custom_request_id uuid,status booking_status default 'pending',fulfillment_stage umrah_fulfillment_stage default 'booked',created_at timestamptz default now(),updated_at timestamptz default now());
create table umrah_pilgrims(id uuid primary key default gen_random_uuid(),booking_id uuid references umrah_bookings on delete cascade,full_name text,gender pilgrim_gender,date_of_birth date,nationality text,passport_number text,passport_expiry date,mahram_name text,mahram_relation text);
create table orders(id uuid primary key default gen_random_uuid(),status order_status default 'pending_payment',total numeric,currency text default 'USD',created_at timestamptz default now(),hold_expires_at timestamptz,min_first_payment numeric,balance_due_at date,paid_at timestamptz,agency_customer_id uuid);
create table order_items(order_id uuid references orders,umrah_booking_id uuid references umrah_bookings);
create table payments(id uuid primary key default gen_random_uuid(),order_id uuid references orders,amount numeric,status text,paid_at timestamptz,created_at timestamptz default now());
create table umrah_custom_requests(id uuid,reference text,departure_date date);
create table agency_members(agency_id uuid,profile_id uuid,status text);
create table umrah_booking_stage_history(booking_id uuid,stage umrah_fulfillment_stage,note text,actor uuid);
create table notifications(profile_id uuid,type text,title text,body text,data jsonb);
create function public.umrah_setting(text) returns jsonb language sql as $$ select case $1 when 'privateDepositPercent' then '50'::jsonb when 'privateBalanceDueDays' then '30'::jsonb else 'false'::jsonb end $$;
create function public._umrah_pilgrim_readiness(uuid) returns table(missing text[]) language sql as $$ select '{}'::text[] where false $$;
create function public._umrah_full_payment_required(uuid) returns boolean language sql as $$ select true $$;
create function public._apply_order_cancellation(uuid,text) returns void language plpgsql as $$ begin update orders set status='cancelled' where id=$1; update umrah_bookings set status='cancelled' where id in(select umrah_booking_id from order_items where order_id=$1); end $$;
-- Loaded production group booking requires this private-only branch table only when invoked.
-- Tests below use group packages; private API regressions run separately.

grant usage on schema auth to authenticated;
alter table umrah_bookings enable row level security;
grant insert,select on umrah_bookings to authenticated;
create policy "own bookings read" on umrah_bookings for select to authenticated using (booked_by=auth.uid());
