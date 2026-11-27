do $$ begin
 if exists(select 1 from umrah_package_departures where booking_mode<>'immediate_payment') then raise exception 'legacy mode changed'; end if;
 if (select value from platform_settings where key='umrah_request_pools_enabled')<>'false'::jsonb then raise exception 'flag enabled'; end if;
 if has_table_privilege('authenticated','umrah_pool_requests','INSERT') or has_table_privilege('anon','umrah_pool_requests','SELECT') then raise exception 'unsafe grants'; end if;
 if has_table_privilege('authenticated','umrah_pool_email_jobs','UPDATE') then raise exception 'unsafe worker grants'; end if;
end $$;
begin;
insert into umrah_pool_submissions(id,actor_id,idempotency_key,departure_id,payload)
select '00000000-0000-0000-0000-000000000700','00000000-0000-0000-0000-000000000002',gen_random_uuid(),id,'{}' from test_ids where name='departure';
insert into umrah_pool_requests(id,submission_id,departure_id,customer_id,booked_by,num_pilgrims,currency,unit_price,subtotal,total,quote_snapshot)
select '00000000-0000-0000-0000-000000000701','00000000-0000-0000-0000-000000000700',id,'00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002',1,'USD',100,100,100,'{}' from test_ids where name='departure';
insert into umrah_pool_request_travelers(request_id,full_name,gender) values('00000000-0000-0000-0000-000000000701','QA Traveler','male');
set local role authenticated;
select set_config('test.admin','no',true),set_config('test.agent','no',true),set_config('test.uid','00000000-0000-0000-0000-000000000002',true);
do $$ begin
 if (select count(*) from umrah_pool_requests)<>1 or (select count(*) from umrah_pool_request_travelers)<>1 then raise exception 'owner cannot read'; end if;
 begin update umrah_pool_requests set status='paid'; raise exception 'direct update allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('test.uid','00000000-0000-0000-0000-000000000003',true);
do $$ begin if exists(select 1 from umrah_pool_requests) or exists(select 1 from umrah_pool_request_travelers) then raise exception 'other customer sees personal data'; end if; end $$;
select set_config('test.admin','yes',true);
do $$ begin if (select count(*) from umrah_pool_requests)<>1 then raise exception 'admin cannot read'; end if; end $$;
reset role;
rollback;
