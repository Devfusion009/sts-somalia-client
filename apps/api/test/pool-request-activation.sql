-- Same real fulfillment/order functions as legacy baseline; only external services are fixtures.
select set_config('test.admin','yes',false);
create function qa_fail_activation() returns trigger language plpgsql as $$ begin if new.pool_request_id is not null and new.num_pilgrims=1 then raise exception 'Injected activation failure'; end if; return new; end $$;
create trigger qa_fail_activation before insert on umrah_bookings for each row execute function qa_fail_activation();
select test_assert((process_umrah_request_pools()->>'activated')::int=0,'worker confirmed a pool without staff action');
select test_assert((select formation_status='activation_pending' from umrah_package_departures where id=(select id from test_ids where name='request-departure')),'full pool did not wait for admin');
select test_fails(format('select admin_confirm_umrah_pool(%L,current_date+45)',(select id from test_ids where name='request-departure')),'Injected activation failure');
select test_assert(not exists(select 1 from umrah_bookings where pool_request_id is not null),'failed activation left a partial booking');
select test_assert(not exists(select 1 from umrah_pool_email_jobs where kind='payment_due'),'failed activation left an invitation');
select test_assert((select booked_seats=40 from umrah_package_departures where id=(select id from test_ids where name='request-departure')),'rollback lost allocated seats');
drop trigger qa_fail_activation on umrah_bookings;
select set_config('test.admin','no',false);
select test_fails(format('select admin_confirm_umrah_pool(%L)',(select id from test_ids where name='request-departure')),'Admin access required');
select set_config('test.admin','yes',false);
select test_fails(format('select admin_confirm_umrah_pool(%L,current_date)',(select id from test_ids where name='request-departure')),'full payment window');
select test_assert(admin_confirm_umrah_pool((select id from test_ids where name='request-departure'),current_date+45)=2,'admin confirmation did not invite both applicants');
select test_assert((select formation_status='payment_open' and booked_seats=40 from umrah_package_departures where id=(select id from test_ids where name='request-departure')),'activation changed capacity');
select test_assert((select count(*)=2 from umrah_pool_requests where status='payment_due'),'invitations missing');
select test_assert((select count(*)=2 from umrah_bookings where pool_request_id is not null),'duplicate/missing fulfillment bookings');
select test_assert((select count(*)=2 from umrah_pool_email_jobs where kind='payment_due'),'missing payment emails');
select process_umrah_request_pools();
select test_assert((select count(*)=2 from umrah_bookings where pool_request_id is not null),'retry duplicated bookings');
select test_fails(format('select admin_confirm_umrah_pool(%L)',(select id from test_ids where name='request-departure')),'not awaiting confirmation');
select test_assert((select count(*)=40 from umrah_pilgrims where booking_id in(select booking_id from umrah_pool_requests)),'travelers lost in conversion');
select test_assert(not has_function_privilege('authenticated','process_umrah_request_pools(integer)','EXECUTE'),'customer can activate');

select test_assert((select bool_and(quote_snapshot->>'departureDate'=(current_date+45)::text) from umrah_pool_requests where status in ('payment_due','paid') and departure_id=(select id from test_ids where name='request-departure')),'customer dates did not follow admin schedule');
select test_assert((select departure_date=current_date+45 from umrah_package_departures where id=(select id from test_ids where name='request-departure')),'admin date not saved');
select test_fails(format('update umrah_package_departures set departure_date=current_date+46 where id=%L',(select id from test_ids where name='request-departure')),'locked');
