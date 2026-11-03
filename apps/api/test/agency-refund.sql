begin;
create schema auth;
create function auth.uid() returns uuid language sql as $$ select '00000000-0000-4000-8000-000000000001'::uuid $$;
create function is_admin() returns boolean language sql as $$ select current_setting('test.admin',true)='yes' $$;
create table agencies(id uuid primary key, balance numeric);
create table orders(id uuid primary key, agency_id uuid);
create table agency_wallet_transactions(id uuid default gen_random_uuid(), agency_id uuid, type text, amount numeric, order_id uuid);
create table agency_refund_requests(id uuid primary key, agency_id uuid, order_id uuid, amount numeric, status text, reason text, reviewed_by uuid, reviewed_at timestamptz, review_notes text, wallet_transaction_id uuid);
create function apply_agency_wallet_transaction(uuid,numeric,text,uuid,text) returns uuid language plpgsql as $$ declare tx uuid; begin
 update agencies set balance=balance+$2 where id=$1;
 insert into agency_wallet_transactions(agency_id,amount,type,order_id) values($1,$2,$3,$4) returning id into tx;
 return tx; end $$;
\ir ../../../supabase/migrations/20261103000002_agency_refund_wallet_cap.sql
insert into agencies values ('10000000-0000-4000-8000-000000000001',900);
insert into orders values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');
insert into agency_wallet_transactions(agency_id,type,amount,order_id) values('10000000-0000-4000-8000-000000000001','booking_payment',-100,'20000000-0000-4000-8000-000000000001');
insert into agency_refund_requests(id,agency_id,order_id,amount,status,reason) values
('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',60,'pending','QA'),
('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',60,'pending','QA');
select set_config('test.admin','no',true);
do $$ begin
 begin perform approve_agency_refund_request('30000000-0000-4000-8000-000000000001'); raise exception 'unauthorized approval';
 exception when others then if sqlerrm not like '%only admins%' then raise; end if; end;
end $$;
select set_config('test.admin','yes',true);
select approve_agency_refund_request('30000000-0000-4000-8000-000000000001');
do $$ begin
 begin perform approve_agency_refund_request('30000000-0000-4000-8000-000000000001'); raise exception 'duplicate refund';
 exception when others then if sqlerrm not like '%already processed%' then raise; end if; end;
 begin perform approve_agency_refund_request('30000000-0000-4000-8000-000000000002'); raise exception 'excessive refund';
 exception when others then if sqlerrm not like '%exceeds%' then raise; end if; end;
 if (select balance from agencies) <> 960 then raise exception 'incorrect refund balance'; end if;
 update agency_refund_requests set amount=40 where id='30000000-0000-4000-8000-000000000002';
 perform approve_agency_refund_request('30000000-0000-4000-8000-000000000002');
 if (select balance from agencies) <> 1000 then raise exception 'incorrect remaining refund'; end if;
end $$;
rollback;
\echo 'Agency refund checks passed.'
