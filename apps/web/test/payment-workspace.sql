\set ON_ERROR_STOP on
-- Run only in an empty, disposable PostgreSQL database.
create role anon;
create role authenticated;
create role service_role;
create table profiles(id uuid primary key, is_platform_admin boolean default false);
create table agencies(id uuid primary key, status text);
create table agency_members(agency_id uuid, profile_id uuid, status text, role_in_agency text);
\ir ../../../supabase/migrations/20261125000001_payment_workspaces.sql
insert into profiles values ('10000000-0000-4000-8000-000000000001', true), ('10000000-0000-4000-8000-000000000002', false), ('10000000-0000-4000-8000-000000000003', false);
insert into agencies values ('20000000-0000-4000-8000-000000000001','active'), ('20000000-0000-4000-8000-000000000002','active');
insert into agency_members values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','active','owner');
do $$
declare receipt uuid := '30000000-0000-4000-8000-000000000001';
 agency uuid := '20000000-0000-4000-8000-000000000001';
 actor uuid := '10000000-0000-4000-8000-000000000002';
begin
 perform record_cashbook_entry(receipt,agency,'in','transfer',10000,'bank_transfer','Customer','BANK-1',null,actor);
 perform record_cashbook_entry(receipt,agency,'in','transfer',10000,'bank_transfer','Customer','BANK-1',null,actor);
 if (select count(*) from payment_cashbook) <> 1 then raise exception 'Replay duplicated a receipt'; end if;
 perform record_cashbook_entry(gen_random_uuid(),agency,'out','refund',6000,'mobile_money','Customer','REFUND-1',receipt,actor);
 begin
  perform record_cashbook_entry(gen_random_uuid(),agency,'out','refund',4001,'mobile_money','Customer','REFUND-2',receipt,actor);
  raise exception 'Over-refund accepted';
 exception when raise_exception then
  if sqlerrm <> 'Refund exceeds remaining receipt amount' then raise; end if;
 end;
 begin
  perform record_cashbook_entry(gen_random_uuid(),'20000000-0000-4000-8000-000000000002','in','transfer',100,'bank_transfer','Customer','BAD',null,actor);
  raise exception 'Cross-agency write accepted';
 exception when raise_exception then if sqlerrm <> 'Not permitted' then raise; end if;
 end;
 begin
  perform record_cashbook_entry(gen_random_uuid(),null,'in','transfer',100,'bank_transfer','Customer','BAD',null,actor);
  raise exception 'Agent wrote STS cashbook';
 exception when raise_exception then if sqlerrm <> 'Not permitted' then raise; end if;
 end;
 begin
  perform record_cashbook_entry(gen_random_uuid(),agency,'in','transfer',100,'bank_transfer','Customer','BANK-1',null,actor);
  raise exception 'Duplicate external reference accepted';
 exception when unique_violation then null;
 end;
 if has_table_privilege('authenticated','agency_payment_gateways','select') then raise exception 'Credentials exposed'; end if;
 if has_table_privilege('authenticated','payment_cashbook','insert') then raise exception 'Cashbook allows direct client writes'; end if;
 perform record_cashbook_entry(gen_random_uuid(),null,'out','transfer',100,'bank_transfer','Supplier','STS-1',null,'10000000-0000-4000-8000-000000000001');
end $$;
select 'Payment workspace authorization, idempotency, duplicate and refund-limit tests passed' as result;
