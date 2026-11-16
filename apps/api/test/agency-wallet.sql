-- Isolated PostgreSQL fixture. Never run against an application database.
begin;
create role anon;
create role authenticated;
create table agencies(id uuid primary key, balance numeric not null);
create table orders(id uuid primary key, agency_id uuid, status text, currency text, total numeric, min_first_payment numeric, order_number text);
create table payments(id uuid default gen_random_uuid(), order_id uuid, provider text, method_label text, amount numeric, currency text, status text);
create table hotel_bookings(id uuid, status text);
create table event_venues(id uuid, base_price numeric, price_unit text);
create table hall_bookings(id uuid, status text, venue_id uuid, start_time time);
create table order_items(order_id uuid, hotel_booking_id uuid, hall_booking_id uuid);
create function is_agency_booker(uuid) returns boolean language sql as $$ select current_setting('test.allowed',true) = 'yes' $$;
create function apply_agency_wallet_transaction(uuid,numeric,text,uuid,text) returns uuid language plpgsql as $$ begin
 update agencies set balance=balance+$2 where id=$1 and balance+$2 >= 0;
 if not found then raise exception 'insufficient balance'; end if;
 return gen_random_uuid(); end $$;
\ir ../../../supabase/migrations/20261103000001_atomic_agency_wallet_payment.sql
insert into agencies values ('10000000-0000-4000-8000-000000000001', 1000);
insert into orders values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','pending_payment','USD',100,null,'QA');
select set_config('test.allowed','yes',true);
select pay_order_from_agency_wallet('20000000-0000-4000-8000-000000000001',50);
do $$ begin
 if (select balance from agencies) <> 950 then raise exception 'wrong debit'; end if;
 if (select sum(amount) from payments where status='succeeded') <> 50 then raise exception 'wrong settlement'; end if;
 begin perform pay_order_from_agency_wallet('20000000-0000-4000-8000-000000000001',51); raise exception 'overpayment accepted';
 exception when others then if sqlerrm not like '%remaining balance%' then raise; end if; end;
 perform pay_order_from_agency_wallet('20000000-0000-4000-8000-000000000001',50);
 begin perform pay_order_from_agency_wallet('20000000-0000-4000-8000-000000000001',100); raise exception 'duplicate accepted';
 exception when others then if sqlerrm not like '%remaining balance%' then raise; end if; end;
 if (select balance from agencies) <> 900 then raise exception 'duplicate debit'; end if;
 perform set_config('test.allowed','no',true);
 begin perform pay_order_from_agency_wallet('20000000-0000-4000-8000-000000000001',1); raise exception 'unauthorized accepted';
 exception when others then if sqlerrm not like '%booking agency%' then raise; end if; end;
end $$;
-- Force settlement failure after debit and prove PostgreSQL rolls the debit back.
select set_config('test.allowed','yes',true);
update orders set total=200;
alter table payments add constraint fail_settlement check(amount <> 60);
do $$ begin
 begin perform pay_order_from_agency_wallet('20000000-0000-4000-8000-000000000001',60); raise exception 'expected settlement failure';
 exception when check_violation then null; end;
 if (select balance from agencies) <> 900 then raise exception 'debit was not rolled back'; end if;
 if (select count(*) from payments) <> 2 then raise exception 'failed payment remained'; end if;
end $$;
rollback;
\echo 'Atomic wallet checks passed.'
