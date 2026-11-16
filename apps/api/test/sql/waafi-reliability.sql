\set ON_ERROR_STOP on
begin;
set local request.jwt.claim.role='service_role';
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
insert into profiles values('00000000-0000-4000-8000-000000000001',false),('00000000-0000-4000-8000-000000000002',true);
insert into agencies values('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001',0);
insert into orders(id) values('00000000-0000-4000-8000-000000000100'),('00000000-0000-4000-8000-000000000101');
insert into payments(id,order_id,provider,status,amount,currency) values
 ('00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000100','waafi','processing',10,'USD'),
 ('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000100','waafi','processing',10,'USD'),
 ('00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000101','waafi','processing',10,'USD');
set local role authenticated;
set local request.jwt.claim.role='authenticated';
do $$ declare blocked boolean:=false; begin
  begin
    insert into payments(id,order_id,provider,status,amount,currency) values
      ('00000000-0000-4000-8000-000000000209','00000000-0000-4000-8000-000000000100','manual','succeeded',100,'USD');
  exception when insufficient_privilege then blocked:=true; end;
  assert blocked;
  insert into payments(id,order_id,provider,status,amount,currency) values
    ('00000000-0000-4000-8000-000000000208','00000000-0000-4000-8000-000000000100','manual','processing',10,'USD');
end $$;
reset role;
set local request.jwt.claim.role='service_role';
do $$
declare v_id uuid; second_id uuid; reservation jsonb; failed boolean;
begin
  assert not has_function_privilege('authenticated','settle_waafi_transaction(uuid,text,text,text,numeric,text,text)','execute');
  assert not has_table_privilege('authenticated','waafi_payment_attempts','update');
  assert not has_table_privilege('anon','waafi_receipts','select');
  reservation:=begin_waafi_attempt('00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000100',null,'sandbox','test-merchant');
  assert (reservation->>'claimed')::boolean;
  reservation:=begin_waafi_attempt('00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000100',null,'sandbox','test-merchant');
  assert not (reservation->>'claimed')::boolean;
  reservation:=begin_waafi_attempt('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000100',null,'sandbox','test-merchant');
  assert not (reservation->>'claimed')::boolean;
  assert reservation->'result'->>'type'='error';
  failed:=false;
  begin perform settle_waafi_transaction('00000000-0000-4000-8000-000000000200','sandbox','test-merchant','tx-1',9,'USD');
  exception when others then failed:=true; end;
  assert failed;
  assert not exists(select 1 from waafi_receipts);
  failed:=false;
  begin perform settle_waafi_transaction('00000000-0000-4000-8000-000000000200','production','test-merchant','tx-1',10,'USD');
  exception when others then failed:=true; end;
  assert failed;
  failed:=false;
  begin update payments set status='succeeded',provider_ref='fake' where id='00000000-0000-4000-8000-000000000200';
  exception when others then failed:=true; end;
  assert failed;
  perform settle_waafi_transaction('00000000-0000-4000-8000-000000000200','sandbox','test-merchant','tx-1',10,'USD','event-1');
  perform settle_waafi_transaction('00000000-0000-4000-8000-000000000200','sandbox','test-merchant','tx-1',10,'USD','event-1');
  perform fail_waafi_attempt('00000000-0000-4000-8000-000000000200');
  assert (select status='succeeded' from payments where id='00000000-0000-4000-8000-000000000200');
  assert (select count(*)=1 from waafi_receipts);
  assert (select count(*)=1 from waafi_webhook_events);
  perform begin_waafi_attempt('00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000101',null,'sandbox','test-merchant');
  failed:=false;
  begin perform settle_waafi_transaction('00000000-0000-4000-8000-000000000202','sandbox','test-merchant','tx-1',10,'USD');
  exception when unique_violation then failed:=true; end;
  assert failed;
  assert (select status='processing' from payments where id='00000000-0000-4000-8000-000000000202');

  v_id:=request_waafi_topup('00000000-0000-4000-8000-000000000010',25,'evc_plus','00000000-0000-4000-8000-000000000300');
  second_id:=request_waafi_topup('00000000-0000-4000-8000-000000000010',25,'evc_plus','00000000-0000-4000-8000-000000000300');
  assert v_id=second_id;
  failed:=false;
  begin perform request_waafi_topup('00000000-0000-4000-8000-000000000010',30,'evc_plus','00000000-0000-4000-8000-000000000300');
  exception when others then failed:=true; end;
  assert failed;
  perform begin_waafi_attempt(v_id,null,v_id,'sandbox','test-merchant');
  failed:=false;
  begin update agency_topup_requests set status='cancelled' where id=v_id;
  exception when others then failed:=true; end;
  assert failed;
  failed:=false;
  begin perform settle_agency_topup(v_id,'fake-manual-confirmation');
  exception when others then failed:=true; end;
  assert failed;
  assert (select credit_balance=0 from agencies where id='00000000-0000-4000-8000-000000000010');
  perform settle_waafi_transaction(v_id,'sandbox','test-merchant','wallet-tx-1',25,'USD','wallet-event');
  perform settle_waafi_transaction(v_id,'sandbox','test-merchant','wallet-tx-1',25,'USD','wallet-event');
  assert (select credit_balance=25 from agencies where id='00000000-0000-4000-8000-000000000010');
  assert (select count(*)=1 from agency_wallet_transactions);
  -- A stale second checkout cannot start after the first payment covers its balance.
  update orders set total=10 where id='00000000-0000-4000-8000-000000000100';
  reservation:=begin_waafi_attempt('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000100',null,'sandbox','test-merchant');
  assert not (reservation->>'claimed')::boolean;
  assert reservation->'result'->>'type'='error';
  perform record_waafi_review_event('sandbox','test-merchant','refund-event','refund','ref','wallet-tx-1');
  perform record_waafi_review_event('sandbox','test-merchant','refund-event','refund','ref','wallet-tx-1');
  assert (select count(*)=1 from notifications where type='waafi_payment_review');
  assert (select credit_balance=25 from agencies where id='00000000-0000-4000-8000-000000000010');

  update waafi_payment_attempts set created_at=now()-interval '1 hour' where reference_id='00000000-0000-4000-8000-000000000202';
  perform flag_waafi_reconciliation('00000000-0000-4000-8000-000000000202');
  perform flag_waafi_reconciliation('00000000-0000-4000-8000-000000000202');
  assert (select count(*)=2 from notifications where type='waafi_payment_review');
  insert into orders(id) values('00000000-0000-4000-8000-000000000103');
  insert into payments(id,order_id,provider,status,amount,currency) values
    ('00000000-0000-4000-8000-000000000203','00000000-0000-4000-8000-000000000103','waafi','processing',10,'USD');
  perform begin_waafi_attempt('00000000-0000-4000-8000-000000000203','00000000-0000-4000-8000-000000000103',null,'sandbox','test-merchant');
  update orders set status='cancelled' where id='00000000-0000-4000-8000-000000000103';
  perform settle_waafi_transaction('00000000-0000-4000-8000-000000000203','sandbox','test-merchant','late-tx',10,'USD','late-event');
  assert (select status='cancelled' from orders where id='00000000-0000-4000-8000-000000000103');
  assert (select status='requires_action' from payments where id='00000000-0000-4000-8000-000000000203');
  assert exists(select 1 from waafi_receipts where transaction_id='late-tx');
  assert (select count(*)=3 from notifications where type='waafi_payment_review');
  raise notice 'WaafiPay database assertions passed.';
end $$;
rollback;
