-- Isolated database only: formation closure and atomic admin creation gates.
select set_config('test.admin','yes',false),set_config('test.agent','no',false),set_config('test.uid','00000000-0000-0000-0000-000000000002',false);
create temp table closure_input as select to_jsonb(p)||jsonb_build_object('slug','qa-closure-pool','status','draft','contact_person_email','qa@example.test','request_first',true,'formation_closes_at',now()+interval '30 days','payment_cutoff_at',now()+interval '60 days','payment_window_hours',48,'request_terms','QA-only formation terms') as payload from umrah_packages p where id=(select id from test_ids where name='package');
select test_fails(format('select create_public_umrah_package(%L,%L,40)',(select payload||jsonb_build_object('slug','qa-invalid-atomic','formation_closes_at',now()-interval '1 day') from closure_input),current_date+90),'future formation deadline');
select test_assert(not exists(select 1 from umrah_packages where slug='qa-invalid-atomic'),'failed configuration left a partial package');
insert into test_ids values('closure-package',create_public_umrah_package((select payload from closure_input),current_date+90,40));
insert into test_ids select 'closure-departure',id from umrah_package_departures where package_id=(select id from test_ids where name='closure-package');
update umrah_packages set images='["qa-only.webp"]',status='published' where id=(select id from test_ids where name='closure-package');
select set_config('test.admin','no',false);
select submit_umrah_pool_requests((select id from test_ids where name='closure-departure'),gen_random_uuid(),'[{"pilgrims":[{"full_name":"Closure QA One","gender":"male"},{"full_name":"Closure QA Two","gender":"female"}]}]',true);
select expire_umrah_pool_requests();
select test_assert((select booked_seats=2 from umrah_package_departures where id=(select id from test_ids where name='closure-departure')),'formation sweep released places early');
-- Move the fixture's deadline to the transaction clock. Never used on an app DB.
alter table umrah_package_departures disable trigger guard_umrah_pool_configuration;
update umrah_package_departures set formation_closes_at=now() where id=(select id from test_ids where name='closure-departure');
alter table umrah_package_departures enable trigger guard_umrah_pool_configuration;
select expire_umrah_pool_requests();
select expire_umrah_pool_requests();
select test_assert((select booked_seats=0 and formation_status='cancelled' from umrah_package_departures where id=(select id from test_ids where name='closure-departure')),'formation closure did not release once');
select test_assert((select status='cancelled' and order_id is null from umrah_pool_requests where departure_id=(select id from test_ids where name='closure-departure')),'formation closure created an order or wrong status');
select test_assert((select count(*)=1 from umrah_pool_email_jobs j join umrah_pool_requests r on r.id=j.request_id where r.departure_id=(select id from test_ids where name='closure-departure') and j.kind='cancelled'),'formation closure duplicated cancellation notice');
select test_fails(format('select submit_umrah_pool_requests(%L,gen_random_uuid(),''[{"pilgrims":[{"full_name":"Late QA","gender":"male"}]}]'',true)',(select id from test_ids where name='closure-departure')),'closed');
