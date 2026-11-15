select set_config('test.admin','yes',false);
select set_config('test.uid','00000000-0000-0000-0000-000000000001',false);
create table test_ids(name text primary key,id uuid);
grant select on test_ids to authenticated;
insert into test_ids values('package',public.create_public_umrah_package(jsonb_build_object(
 'name','Public Umrah','slug','public-umrah','description','A ten-day group trip','duration_days',10,
 'includes','["flights","hotel","transport","meals"]'::jsonb,'base_price',100,'currency','USD',
 'contact_person_name','Coordinator','contact_person_phone','+252 611 444 420','facilities','Guide',
 'accommodation_details','Quad rooms','flight_details','Return economy','transport_details','Coach',
 'meals_note','Full board','nights_makkah',5,'nights_madinah',4),current_date+90,5));
insert into test_ids select 'departure',id from umrah_package_departures where package_id=(select id from test_ids where name='package');
do $$ declare pkg umrah_packages; begin
 select * into pkg from umrah_packages where id=(select id from test_ids where name='package');
 if not pkg.public_setup_complete or pkg.deposit_percent<>100 then raise exception 'Setup/full payment terms mismatch'; end if;
 begin delete from umrah_package_departures where package_id=pkg.id; update umrah_packages set status='published' where id=pkg.id; raise exception 'Expected missing departure rejection'; exception when raise_exception then if sqlerrm='Expected missing departure rejection' then raise; end if; end;
 begin insert into umrah_package_pricing(package_id,sharing,price) values(pkg.id,2,0); raise exception 'Expected zero rate rejection'; exception when raise_exception then if sqlerrm<>'Public Umrah rates must be greater than zero.' then raise; end if; end;
 begin update umrah_package_departures set price_override=0 where package_id=pkg.id; raise exception 'Expected zero override rejection'; exception when raise_exception then if sqlerrm<>'Public Umrah rates must be greater than zero.' then raise; end if; end;
 begin update umrah_packages set contact_person_phone='' ,status='published' where id=pkg.id; raise exception 'Expected invalid setup rejection'; exception when raise_exception then if sqlerrm='Expected invalid setup rejection' then raise; end if; end;
 begin update umrah_packages set nights_makkah=10,status='published' where id=pkg.id; raise exception 'Expected invalid nights rejection'; exception when raise_exception then if sqlerrm='Expected invalid nights rejection' then raise; end if; end;
 begin update umrah_package_departures set return_date=return_date+1 where package_id=pkg.id; raise exception 'Expected duration rejection'; exception when raise_exception then if sqlerrm='Expected duration rejection' then raise; end if; end;
end $$;
update umrah_packages set status='published' where id=(select id from test_ids where name='package');
select set_config('test.admin','no',false);
do $$ begin
 begin perform admin_public_umrah_pool(); raise exception 'Expected admin denial'; exception when raise_exception then if sqlerrm<>'Admin access required.' then raise; end if; end;
 begin perform create_public_umrah_package('{}',current_date+90,20); raise exception 'Expected admin denial'; exception when raise_exception then if sqlerrm<>'Admin access required.' then raise; end if; end;
 begin perform create_umrah_group_booking((select id from test_ids where name='departure'),1,0::smallint,'','[{"full_name":"Traveller","gender":"male"}]','00000000-0000-0000-0000-000000000099'); raise exception 'Expected agency denial'; exception when raise_exception then if sqlerrm<>'not authorized' then raise; end if; end;
end $$;
-- Five available seats: the customer can reserve all five, but nothing is confirmed yet.
insert into test_ids values('booking',create_umrah_group_booking((select id from test_ids where name='departure'),5,0::smallint,'',
 '[{"full_name":"Traveller One","gender":"male"},{"full_name":"Traveller Two","gender":"female"},{"full_name":"Traveller Three","gender":"male"},{"full_name":"Traveller Four","gender":"female"},{"full_name":"Traveller Five","gender":"male"}]',null));
insert into test_ids values('order',gen_random_uuid());
insert into orders(id,total) select id,500 from test_ids where name='order';
insert into order_items select (select id from test_ids where name='order'),(select id from test_ids where name='booking');
do $$ declare d umrah_package_departures; begin
 select * into d from umrah_package_departures where id=(select id from test_ids where name='departure');
 if d.booked_seats<>5 then raise exception 'Five seats not reserved'; end if;
 if exists(select 1 from umrah_bookings where id=(select id from test_ids where name='booking') and status<>'pending') then raise exception 'Unpaid booking was confirmed'; end if;
 begin perform create_umrah_group_booking(d.id,1,0::smallint,'','[{"full_name":"Excess Traveller","gender":"male"}]',null); raise exception 'Expected full departure rejection'; exception when raise_exception then if sqlerrm<>'not enough seats left on this departure' then raise; end if; end;
 begin update umrah_package_departures set total_seats=4 where id=d.id; raise exception 'Expected capacity reduction rejection'; exception when check_violation then null; end;
 begin update umrah_bookings set status='confirmed' where id=(select id from test_ids where name='booking'); raise exception 'Expected payment gate'; exception when raise_exception then if sqlerrm<>'Public Umrah requires full payment before confirmation.' then raise; end if; end;
 if (select min_first_payment from orders where id=(select id from test_ids where name='order'))<>500 then raise exception 'Checkout is not charging the full amount'; end if;
 if (select deposit_percent from _umrah_order_terms((select id from test_ids where name='order')))<>100 then raise exception 'Expected full payment terms'; end if;
 begin insert into payments(order_id,amount,status) select id,100,'requires_action' from test_ids where name='order'; raise exception 'Expected partial payment rejection'; exception when raise_exception then if sqlerrm<>'Public Umrah requires full payment.' then raise; end if; end;
end $$;
-- Failed payment remains unconfirmed, then its expired checkout returns all seats.
insert into payments(order_id,amount,status) select id,500,'failed' from test_ids where name='order';
update orders set created_at=now()-interval '31 minutes' where id=(select id from test_ids where name='order');
select release_public_umrah_checkouts();
do $$ begin
 if (select booked_seats from umrah_package_departures where id=(select id from test_ids where name='departure'))<>0 then raise exception 'Failed checkout did not release seats'; end if;
end $$;
-- Agent uses the same inventory. A submitted manual receipt remains pending until approved.
select set_config('test.agent','yes',false);
insert into test_ids values('agent_booking',create_umrah_group_booking((select id from test_ids where name='departure'),1,0::smallint,'','[{"full_name":"Agent Customer","gender":"male"}]','00000000-0000-0000-0000-000000000099'));
insert into test_ids values('agent_order',gen_random_uuid());
insert into orders(id,total,agency_customer_id,created_at) select id,100,'00000000-0000-0000-0000-000000000088',now() from test_ids where name='agent_order';
insert into order_items select (select id from test_ids where name='agent_order'),(select id from test_ids where name='agent_booking');
insert into payments(order_id,amount,status) select id,100,'requires_action' from test_ids where name='agent_order';
update orders set created_at=now()-interval '31 minutes' where id=(select id from test_ids where name='agent_order');
select release_public_umrah_checkouts();
do $$ begin
 if (select booked_seats from umrah_package_departures where id=(select id from test_ids where name='departure'))<>1 then raise exception 'Receipt under review lost its seat'; end if;
 if (select status from umrah_bookings where id=(select id from test_ids where name='agent_booking'))<>'pending' then raise exception 'Unverified receipt confirmed booking'; end if;
end $$;
-- Actual production payment trigger settles the order and confirms the booking.
update payments set status='succeeded' where order_id=(select id from test_ids where name='agent_order');
select set_config('test.admin','yes',false);
do $$ declare pool jsonb; begin
 if (select status from umrah_bookings where id=(select id from test_ids where name='agent_booking'))<>'confirmed' then raise exception 'Full payment did not confirm'; end if;
 pool:=admin_public_umrah_pool()->0;
 if (pool->>'total_seats')::int<>5 or (pool->>'confirmed_seats')::int<>1 or (pool->>'held_seats')::int<>0 or (pool->>'available_seats')::int<>4 or (pool->>'customers')::int<>1 then raise exception 'Pool counts wrong: %',pool; end if;
end $$;
-- Full immediate receipts (gateway/wallet/cash settlement) confirm exactly once,
-- and cancellation releases inventory without losing the original receipt.
do $$ declare b uuid; o uuid; i integer; begin
 for i in 1..3 loop
  b:=create_umrah_group_booking((select id from test_ids where name='departure'),1,0::smallint,'','[{"full_name":"Paid Traveller","gender":"female"}]',null);
  insert into orders(total) values(100) returning id into o;
  insert into order_items values(o,b);
  insert into payments(order_id,amount,status) values(o,100,'succeeded');
  if (select status from umrah_bookings where id=b)<>'confirmed' then raise exception 'Immediate payment did not confirm'; end if;
  update payments set status='succeeded' where order_id=o;
  if (select count(*) from umrah_booking_stage_history where booking_id=b and stage='confirmed')<>1 then raise exception 'Duplicate confirmation'; end if;
  perform _apply_order_cancellation(o,'Test cancellation');
  if (select booked_seats from umrah_package_departures where id=(select id from test_ids where name='departure'))<>1 then raise exception 'Cancellation did not release seats'; end if;
 end loop;
end $$;
-- Test the actual authenticated RLS path, not just the API's input validation.
set role authenticated;
select set_config('test.admin','no',false);
do $$ begin
 begin insert into umrah_bookings(departure_id,customer_id,booked_by,booking_kind,num_pilgrims,total_price,status)
 values((select id from test_ids where name='departure'),auth.uid(),auth.uid(),'group',1,0,'confirmed'); raise exception 'Expected public insert denial';
 exception when insufficient_privilege then null; end;
 insert into umrah_bookings(customer_id,booked_by,booking_kind,num_pilgrims,total_price)
 values(auth.uid(),auth.uid(),'private',1,100);
end $$;
reset role;
-- Private bookings retain the configured deposit and are not auto-confirmed.
do $$ declare b uuid; o uuid; begin
 select id into b from umrah_bookings where booking_kind='private' limit 1;
 insert into orders(total) values(100) returning id into o;
 insert into order_items values(o,b);
 if (select min_first_payment from orders where id=o)<>50 then raise exception 'Private deposit changed'; end if;
 insert into payments(order_id,amount,status) values(o,50,'succeeded');
 if (select status from orders where id=o)<>'partially_paid' then raise exception 'Private deposit rejected'; end if;
 if (select status from umrah_bookings where id=b)<>'pending' then raise exception 'Private booking auto confirmed'; end if;
end $$;
-- Ready for two concurrent sessions competing for the last remaining seat.
update umrah_package_departures set total_seats=2 where id=(select id from test_ids where name='departure');
