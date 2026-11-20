-- Admin package creation must accept duration without city night counts.
begin;
select set_config('test.admin','yes',true);
select set_config('test.uid','00000000-0000-0000-0000-000000000001',true);
insert into test_ids values('package-no-nights',public.create_public_umrah_package(jsonb_build_object(
 'name','Public Umrah','slug','public-umrah-no-nights','description','A ten-day group trip','duration_days',10,
 'includes','["flights","hotel","transport","meals"]'::jsonb,'base_price',100,'currency','USD',
 'contact_person_name','Coordinator','contact_person_phone','+252 611 444 420','contact_person_email','qa@example.test','facilities','Guide',
 'accommodation_details','Quad rooms','flight_details','Return economy','transport_details','Coach',
 'meals_note','Full board'),current_date+90,5));
do $$ declare pkg umrah_packages; begin
 select * into pkg from umrah_packages where id=(select id from test_ids where name='package-no-nights');
 if not pkg.public_setup_complete or pkg.nights_makkah is not null or pkg.nights_madinah is not null then raise exception 'Package without nights was not saved correctly'; end if;
 update umrah_packages set status='published' where id=pkg.id;
 if not exists(select 1 from umrah_package_departures where package_id=pkg.id and return_date-departure_date+1=pkg.duration_days) then raise exception 'Departure duration mismatch'; end if;
 update umrah_packages set name='Updated Umrah' where id=pkg.id;
 begin
   update umrah_packages set nights_makkah=10 where id=pkg.id;
   raise exception 'Invalid supplied nights were accepted';
 exception when raise_exception then
   if sqlerrm='Invalid supplied nights were accepted' then raise; end if;
 end;
 begin
   update umrah_packages set facilities='' where id=pkg.id;
   raise exception 'Incomplete package was accepted';
 exception when raise_exception then
   if sqlerrm='Incomplete package was accepted' then raise; end if;
 end;
end $$;
-- Exercise the request-first wrapper as well as immediate-payment creation.
do $$ declare payload jsonb; pkg_id uuid; begin
 if to_regprocedure('public.configure_umrah_request_pool(uuid,timestamp with time zone,timestamp with time zone,integer,text)') is not null then
   update platform_settings set value='true'::jsonb where key='umrah_request_pools_enabled';
   select to_jsonb(p) || jsonb_build_object('slug','public-umrah-request-no-nights','request_first',true,
     'formation_closes_at',now()+interval '30 days','payment_cutoff_at',now()+interval '60 days',
     'payment_window_hours',48,'request_terms','Formation and cancellation terms') into payload
     from umrah_packages p where id=(select id from test_ids where name='package-no-nights');
   pkg_id := public.create_public_umrah_package(payload,current_date+90,40);
   if not exists(select 1 from umrah_package_departures where package_id=pkg_id and booking_mode='request_then_pay' and formation_status='draft') then
     raise exception 'Request-first package without nights was not configured';
   end if;
 end if;
end $$;
rollback;
