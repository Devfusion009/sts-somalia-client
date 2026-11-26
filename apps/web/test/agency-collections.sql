\set ON_ERROR_STOP on
begin;
do $$
declare a uuid; actor uuid; g uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); before_count bigint;
begin
 select m.agency_id,m.profile_id into a,actor from agency_members m join agencies a on a.id=m.agency_id where m.role_in_agency='owner' and m.status='active' and a.status='active' limit 1;
 if a is null then raise exception 'No test owner'; end if;
 insert into agency_payment_gateways(id,agency_id,provider,environment,credentials_encrypted,last_test_ok,updated_by) values(g,a,'waafi','sandbox','test-ciphertext',true,actor);
 if not begin_agency_collection(c,g,a,actor,100,'Test customer','252611111111') then raise exception 'First claim failed'; end if;
 if begin_agency_collection(c,g,a,actor,100,'Test customer','252611111111') then raise exception 'Duplicate claim accepted'; end if;
 begin
 perform begin_agency_collection(c,g,a,actor,200,'Test customer','252611111111');
 raise exception 'Mismatched replay accepted';
 exception when raise_exception then if sqlerrm<>'Payment reference already used' then raise; end if; end;
 begin
 perform settle_agency_collection(c,'sandbox-test',101,'USD');
 raise exception 'Wrong amount accepted';
 exception when raise_exception then if sqlerrm<>'Payment verification mismatch' then raise; end if; end;
 select count(*) into before_count from payment_cashbook;
 perform settle_agency_collection(c,'sandbox-test',100,'USD');
 perform settle_agency_collection(c,'sandbox-test',100,'USD');
 if (select count(*) from payment_cashbook)<>before_count then raise exception 'Sandbox touched cashbook'; end if;
 if (select status from agency_payment_collections where id=c)<>'paid' then raise exception 'Settlement failed'; end if;
 if has_table_privilege('authenticated','agency_payment_collections','select') then raise exception 'Payment secrets exposed'; end if;
end $$;
rollback;
