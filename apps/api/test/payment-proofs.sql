-- Isolated empty PostgreSQL instance ONLY. Never run on an application database.
\set ON_ERROR_STOP on
begin;
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
create function public.is_admin() returns boolean language sql stable as $$ select current_setting('test.admin',true)='yes' $$;
create table profiles(id uuid primary key,is_platform_admin boolean default false);
create table notifications(profile_id uuid,type text,title text,body text,data jsonb);
create table orders(id uuid primary key,customer_id uuid,status text,total numeric,currency text,hold_expires_at timestamptz);
create table payments(id uuid primary key,order_id uuid references orders(id),provider text,method_label text,status text,amount numeric,currency text);
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
create function expect_rejection(statement text, message text) returns void language plpgsql as $$ begin
 begin execute statement; exception when others then if position(message in sqlerrm)=0 then raise; end if; return; end;
 raise exception 'Expected rejection for %',statement;
end $$;
insert into profiles values('00000000-0000-4000-8000-000000000001',false),('00000000-0000-4000-8000-000000000002',true);
insert into orders values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','pending_payment',100,'USD',null);
insert into payments values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','manual','Bank Transfer','requires_action',100,'USD');
select set_config('test.uid','00000000-0000-4000-8000-000000000001',true);
select set_config('test.admin','no',true);
select expect_rejection($q$select confirm_manual_payment('20000000-0000-4000-8000-000000000001')$q$,'Administrator');
select expect_rejection($q$select submit_payment_proof('20000000-0000-4000-8000-000000000001','missing','receipt.png','image/png',10)$q$,'Upload');
insert into storage.objects values('payment-proofs','20000000-0000-4000-8000-000000000001/proof1.png',auth.uid()::text);
select submit_payment_proof('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001/proof1.png','receipt.png','image/png',10,'BANK-TEST') as first_proof \gset
insert into storage.objects values('payment-proofs','20000000-0000-4000-8000-000000000001/duplicate.png',auth.uid()::text);
select expect_rejection($q$select submit_payment_proof('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001/duplicate.png','duplicate.png','image/png',10)$q$,'already awaiting review');
select set_config('test.admin','yes',true);
select expect_rejection($q$select confirm_manual_payment('20000000-0000-4000-8000-000000000001')$q$,'Review the latest');
select reject_payment_proof(:'first_proof','Receipt is unreadable');
select expect_rejection(format('select reject_payment_proof(%L,%L)',:'first_proof','Receipt is unreadable'),'latest pending proof');
select expect_rejection(format('select confirm_manual_payment(%L,%L)','20000000-0000-4000-8000-000000000001',:'first_proof'),'Review the latest');
select set_config('test.admin','no',true);
insert into storage.objects values('payment-proofs','20000000-0000-4000-8000-000000000001/proof2.png',auth.uid()::text);
select submit_payment_proof('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001/proof2.png','corrected.png','image/png',10) as second_proof \gset
-- Upload must not settle the payment.
do $$ begin if (select status from payments limit 1)<>'requires_action' then raise exception 'Upload settled money'; end if; end $$;
-- Another customer cannot read row or storage evidence.
select set_config('test.uid','00000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from payment_proofs) then raise exception 'Proof leaked'; end if;
 if exists(select 1 from storage.objects) then raise exception 'Storage leaked'; end if;
end $$;
reset role;
select set_config('test.admin','yes',true);
select expect_rejection(format('select confirm_manual_payment(%L,%L)','20000000-0000-4000-8000-000000000001',:'first_proof'),'Review the latest');
select confirm_manual_payment('20000000-0000-4000-8000-000000000001',:'second_proof');
select confirm_manual_payment('20000000-0000-4000-8000-000000000001',:'second_proof');
do $$ begin
 if (select status from payments limit 1)<>'succeeded' then raise exception 'Payment not settled'; end if;
 if (select count(*) from payment_proofs where status='accepted')<>1 then raise exception 'Wrong proof accepted'; end if;
 if (select count(*) from payment_proofs where status='rejected')<>1 then raise exception 'History lost'; end if;
end $$;
do $$ begin
 if (select count(*) from notifications where type='bank_proof_submitted')<>2 then raise exception 'Admin notification missing'; end if;
 if (select count(*) from notifications where type='bank_proof_rejected')<>1 then raise exception 'Customer correction notification missing'; end if;
end $$;
-- Cash requires staff, but no bank proof.
insert into payments values('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','manual','Pay at Office','requires_action',100,'USD');
select set_config('test.admin','no',true);
select expect_rejection($q$select confirm_manual_payment('20000000-0000-4000-8000-000000000002')$q$,'Administrator');
select set_config('test.admin','yes',true);
select expect_rejection($q$insert into payments values('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','manual','Pay at Office','processing',100,'USD')$q$,'already pending');
select expect_rejection($q$select confirm_manual_payment('20000000-0000-4000-8000-000000000002')$q$,'remaining balance');
update payments set currency='EUR' where method_label='Pay at Office';
select expect_rejection($q$select confirm_manual_payment('20000000-0000-4000-8000-000000000002')$q$,'remaining balance');
update payments set currency='USD' where method_label='Pay at Office';
update orders set status='cancelled';
select expect_rejection($q$select confirm_manual_payment('20000000-0000-4000-8000-000000000002')$q$,'no longer awaiting');
update orders set status='held',hold_expires_at=now()-interval '1 day';
select expect_rejection($q$select confirm_manual_payment('20000000-0000-4000-8000-000000000002')$q$,'expired');
update orders set status='pending_payment',total=200,hold_expires_at=null;
select confirm_manual_payment('20000000-0000-4000-8000-000000000002');
rollback;
\echo 'PASS: bank proof, rejection/re-upload, private access, stale approval, idempotency, cash approval and duplicate request checks'
