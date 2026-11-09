-- Local application database only; all fixture changes roll back.
begin;
create function pg_temp.reject_test_earnings_settlement() returns trigger language plpgsql as $$
begin
  if current_setting('sts.test.reject_settlement',true)='yes' then raise exception 'test settlement failure'; end if;
  return new;
end $$;
create trigger reject_test_earnings_settlement before insert on agency_commission_payouts
  for each row execute function pg_temp.reject_test_earnings_settlement();
do $$
declare
  v_agency uuid;
  v_owner uuid;
  v_other uuid;
  v_amount numeric;
  v_before numeric;
  v_after numeric;
  v_transfer uuid := gen_random_uuid();
  v_wallet uuid;
  v_repeat uuid;
  v_request uuid;
begin
  select m.agency_id, m.profile_id into v_agency, v_owner from agency_members m
    join profiles p on p.id=m.profile_id where p.email='demo.agent@stssomalia.com' limit 1;
  select id into v_other from profiles where email='demo.customer@stssomalia.com';
  if v_agency is null or v_other is null then raise exception 'Local demo fixtures required.'; end if;
  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  update agency_commission_entries set status='pending' where agency_id=v_agency and status='confirmed';
  begin
    perform transfer_agency_earnings_to_wallet(v_agency,1,gen_random_uuid());
    raise exception 'FAIL: pending earnings transferred';
  exception when others then
    if sqlerrm <> 'Available earnings changed. Refresh and try again.' then raise; end if;
  end;
  update agency_commission_entries set status='confirmed' where agency_id=v_agency and status='pending';
  select sum(amount) into v_amount from agency_commission_entries where agency_id=v_agency and status='confirmed';
  if coalesce(v_amount,0)<=0 then raise exception 'Paid booking earnings required.'; end if;
  select credit_balance into v_before from agencies where id=v_agency;
  begin
    perform transfer_agency_earnings_to_wallet(v_agency,v_amount+1,gen_random_uuid());
    raise exception 'FAIL: stale or forged amount accepted';
  exception when others then
    if sqlerrm <> 'Available earnings changed. Refresh and try again.' then raise; end if;
  end;
  insert into agency_payout_requests(agency_id,amount,requested_by) values(v_agency,1,v_owner) returning id into v_request;
  begin
    perform transfer_agency_earnings_to_wallet(v_agency,v_amount,gen_random_uuid());
    raise exception 'FAIL: reserved earnings transferred';
  exception when others then
    if sqlerrm <> 'Complete or cancel the open withdrawal before transferring earnings.' then raise; end if;
  end;
  delete from agency_payout_requests where id=v_request;
  perform set_config('request.jwt.claim.sub',v_other::text,true);
  begin
    perform transfer_agency_earnings_to_wallet(v_agency,v_amount,v_transfer);
    raise exception 'FAIL: another user transferred agency earnings';
  exception when others then
    if sqlerrm <> 'Only the agency owner or an admin can transfer earnings.' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  perform set_config('sts.test.reject_settlement','yes',true);
  begin
    perform transfer_agency_earnings_to_wallet(v_agency,v_amount,v_transfer);
    raise exception 'FAIL: settlement failure ignored';
  exception when others then
    if sqlerrm <> 'test settlement failure' then raise; end if;
  end;
  if (select credit_balance from agencies where id=v_agency) <> v_before then raise exception 'FAIL: failed transfer credited wallet'; end if;
  if (agency_earnings_summary(v_agency)->>'available')::numeric <> v_amount then raise exception 'FAIL: failed transfer consumed earnings'; end if;
  perform set_config('sts.test.reject_settlement','no',true);
  v_wallet := transfer_agency_earnings_to_wallet(v_agency,v_amount,v_transfer);
  select credit_balance into v_after from agencies where id=v_agency;
  if v_after <> v_before+v_amount then raise exception 'FAIL: wallet credit mismatch'; end if;
  if (agency_earnings_summary(v_agency)->>'available')::numeric <> 0 then raise exception 'FAIL: transferred earnings still available'; end if;
  v_repeat := transfer_agency_earnings_to_wallet(v_agency,v_amount,v_transfer);
  if v_repeat <> v_wallet then raise exception 'FAIL: retry changed transaction'; end if;
  if (select credit_balance from agencies where id=v_agency) <> v_after then raise exception 'FAIL: duplicate credit'; end if;
  if (select count(*) from agency_commission_payouts where id=v_transfer and method='wallet' and payout_reference=v_wallet::text) <> 1 then raise exception 'FAIL: audit settlement missing'; end if;
  begin
    perform transfer_agency_earnings_to_wallet(v_agency,v_amount,gen_random_uuid());
    raise exception 'FAIL: earnings spent twice';
  exception when others then
    if sqlerrm <> 'Available earnings changed. Refresh and try again.' then raise; end if;
  end;
  begin
    insert into agency_payout_requests(agency_id,amount,requested_by) values(v_agency,1,v_owner);
    raise exception 'FAIL: transferred earnings reserved for withdrawal';
  exception when others then
    if sqlerrm <> 'The withdrawal exceeds available earnings.' then raise; end if;
  end;
end $$;
rollback;
\echo 'Earnings transfer: pending, ownership, stale amount, reservation, rollback, credit, idempotency, double spend and withdrawal checks passed.'
