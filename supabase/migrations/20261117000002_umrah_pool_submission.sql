create function public.configure_umrah_request_pool(p_departure_id uuid,p_closes_at timestamptz,p_cutoff_at timestamptz,p_window integer,p_terms text)
returns void language plpgsql security definer set search_path=public as $$
declare d public.umrah_package_departures; p public.umrah_packages;
begin
 if not public.is_admin() then raise exception 'Admin access required.'; end if;
 if not coalesce((select value='true'::jsonb from public.platform_settings where key='umrah_request_pools_enabled'),false) then raise exception 'Request-first pools are not enabled.'; end if;
 select * into d from public.umrah_package_departures where id=p_departure_id for update;
 select * into p from public.umrah_packages where id=d.package_id;
 if d.id is null or p.package_type<>'group' or p.pool_visibility<>'public' then raise exception 'Select a public group departure.'; end if;
 if p.status='published' or d.booked_seats<>0 or d.offline_seats<>0 or exists(select 1 from public.umrah_pool_requests where departure_id=d.id) or exists(select 1 from public.umrah_bookings where departure_id=d.id) then raise exception 'Configure an unpublished departure without bookings.'; end if;
 if p_closes_at is null or p_closes_at<=now() then raise exception 'Choose a future formation deadline.'; end if;
 update public.umrah_package_departures set booking_mode='request_then_pay',formation_status='draft',formation_closes_at=p_closes_at,payment_cutoff_at=p_cutoff_at,payment_window_hours=p_window,request_terms=p_terms where id=d.id;
end $$;
revoke all on function public.configure_umrah_request_pool(uuid,timestamptz,timestamptz,integer,text) from public,anon;
grant execute on function public.configure_umrah_request_pool(uuid,timestamptz,timestamptz,integer,text) to authenticated;

create function public.guard_umrah_pool_configuration() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from public.umrah_pool_requests r where r.departure_id=old.id) and
  (new.booking_mode,new.total_seats,new.departure_date,new.return_date,new.price_override,new.formation_closes_at,new.payment_cutoff_at,new.payment_window_hours,new.request_terms,new.package_id)
  is distinct from (old.booking_mode,old.total_seats,old.departure_date,old.return_date,old.price_override,old.formation_closes_at,old.payment_cutoff_at,old.payment_window_hours,old.request_terms,old.package_id) then
  raise exception 'This pool already has requests. Its capacity, dates and terms are locked.';
 end if;
 return new;
end $$;
create trigger guard_umrah_pool_configuration before update on public.umrah_package_departures for each row execute function public.guard_umrah_pool_configuration();

create function public.guard_umrah_pool_package() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from public.umrah_package_departures d join public.umrah_pool_requests r on r.departure_id=d.id where d.package_id=old.id)
 and (new.base_price,new.currency,new.duration_days,new.pool_visibility,new.package_type,new.origin_iata,new.destination_iata,new.includes,new.accommodation_details,new.meals_note,new.flight_details,new.transport_details,new.nights_makkah,new.nights_madinah)
 is distinct from (old.base_price,old.currency,old.duration_days,old.pool_visibility,old.package_type,old.origin_iata,old.destination_iata,old.includes,old.accommodation_details,old.meals_note,old.flight_details,old.transport_details,old.nights_makkah,old.nights_madinah) then
  raise exception 'Accepted package terms are locked.';
 end if;
 if new.status='published' and exists(select 1 from public.umrah_package_departures where package_id=new.id and booking_mode='request_then_pay') then
  if coalesce(jsonb_array_length(new.images),0)=0 then raise exception 'Upload a cover image before publishing.'; end if;
  if exists(select 1 from public.umrah_package_departures where package_id=new.id and booking_mode='request_then_pay' and formation_status='draft' and formation_closes_at<=now()) then raise exception 'Choose a future formation deadline.'; end if;
 end if;
 return new;
end $$;
create trigger guard_umrah_pool_package before update on public.umrah_packages for each row execute function public.guard_umrah_pool_package();
create function public.publish_umrah_request_pool() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status='published' then update public.umrah_package_departures set formation_status='forming' where package_id=new.id and booking_mode='request_then_pay' and formation_status='draft'; end if;
 return new;
end $$;
create trigger publish_umrah_request_pool after update of status on public.umrah_packages for each row execute function public.publish_umrah_request_pool();
create function public.guard_umrah_pool_rates() returns trigger language plpgsql security definer set search_path=public as $$
declare pkg uuid:=case when tg_op='DELETE' then old.package_id else new.package_id end;
begin
 if exists(select 1 from public.umrah_package_departures d join public.umrah_pool_requests r on r.departure_id=d.id where d.package_id=pkg) then raise exception 'Accepted package rates are locked.'; end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger guard_umrah_pool_rates before insert or update or delete on public.umrah_package_pricing for each row execute function public.guard_umrah_pool_rates();

-- Request rows own the existing materialized inventory counter in the new mode.
-- All old readers therefore see the same seat count, even before UI rollout.
create function public.umrah_pool_sync_inventory() returns trigger language plpgsql security definer set search_path=public as $$
declare old_count int:=0; new_count int:=0; dep uuid;
begin
 if tg_op<>'INSERT' then
  dep:=old.departure_id;
  if old.status in ('requested','payment_due','paid') then old_count:=old.num_pilgrims; end if;
 end if;
 if tg_op<>'DELETE' then
  dep:=new.departure_id;
  if new.status in ('requested','payment_due','paid') then new_count:=new.num_pilgrims; end if;
 end if;
 if tg_op='UPDATE' and new.departure_id<>old.departure_id then raise exception 'A request cannot change departure.'; end if;
 perform 1 from public.umrah_package_departures where id=dep and booking_mode='request_then_pay' for update;
 if not found then raise exception 'Select a request-first departure.'; end if;
 if new_count>old_count then perform public._umrah_reserve_seats(dep,new_count-old_count);
 elsif new_count<old_count then perform public._umrah_release_seats(dep,old_count-new_count); end if;
 if tg_op='DELETE' then return old; end if;
 new.updated_at:=now(); return new;
end $$;
create trigger umrah_pool_sync_inventory before insert or update or delete on public.umrah_pool_requests for each row execute function public.umrah_pool_sync_inventory();

create function public.queue_umrah_pool_notice(p_request uuid,p_kind text)
returns void language plpgsql security definer set search_path=public as $$
declare r public.umrah_pool_requests; title text; event_key text;
begin
 select * into r from public.umrah_pool_requests where id=p_request;
 event_key:=r.id::text||':'||p_kind;
 title:=case p_kind when 'received' then 'Umrah request received' when 'payment_due' then 'Umrah group confirmed — payment due' when 'paid' then 'Umrah payment received' when 'expired' then 'Umrah payment deadline expired' when 'reminder' then 'Umrah payment due' else 'Umrah request cancelled' end;
 insert into public.umrah_pool_email_jobs(request_id,kind,event_key) values(r.id,p_kind,event_key) on conflict do nothing;
 if found then
  insert into public.notifications(profile_id,type,title,body,data) values(r.booked_by,'umrah_pool_'||p_kind,title,r.reference,
   jsonb_build_object('href',case when r.agency_id is null then '/account/umrah/requests/' else '/agent/umrah/requests/' end||r.id,'request_id',r.id,'order_id',r.order_id));
 end if;
end $$;
revoke all on function public.queue_umrah_pool_notice(uuid,text) from public,anon,authenticated;

create function public.submit_umrah_pool_requests(p_departure_id uuid,p_key uuid,p_parties jsonb,p_terms_accepted boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); d public.umrah_package_departures; p public.umrah_packages;
 sub public.umrah_pool_submissions; party jsonb; traveler jsonb; aid uuid; cid uuid; rid uuid;
 rate numeric; net numeric; markup numeric; rule record; total_n int:=0; n int; payload jsonb;
begin
 if uid is null then raise exception 'Sign in to request places.'; end if;
 if p_key is null or p_terms_accepted is distinct from true or jsonb_typeof(p_parties) is distinct from 'array' or jsonb_array_length(p_parties) not between 1 and 60 then raise exception 'Complete the request and accept the terms.'; end if;
 payload:=jsonb_build_object('departure',p_departure_id,'parties',p_parties);
 -- Serialize retries even when they name different departures.
 perform pg_advisory_xact_lock(hashtextextended(uid::text||p_key::text,0));
 select * into sub from public.umrah_pool_submissions where actor_id=uid and idempotency_key=p_key;
 if found then
  if sub.payload<>payload then raise exception 'This request key was already used with different details.'; end if;
  return (select jsonb_agg(jsonb_build_object('id',id,'reference',reference) order by created_at,id) from public.umrah_pool_requests where submission_id=sub.id);
 end if;
 if not coalesce((select value='true'::jsonb from public.platform_settings where key='umrah_request_pools_enabled'),false) then raise exception 'New pool requests are paused.'; end if;
 select * into d from public.umrah_package_departures where id=p_departure_id for update;
 select * into p from public.umrah_packages where id=d.package_id for share;
 if d.id is null or d.booking_mode<>'request_then_pay' or p.status<>'published' or p.package_type<>'group' or p.pool_visibility<>'public' or not p.public_setup_complete or d.status<>'open' then raise exception 'This pool is not accepting requests.'; end if;
 if not ((d.formation_status='forming' and now()<d.formation_closes_at) or (d.formation_status='payment_open' and d.replacement_sales_open and now()+d.payment_window_hours*interval '1 hour'<=d.payment_cutoff_at)) then raise exception 'Requests for this pool are closed.'; end if;
 select agency_id into aid from public.agency_members where profile_id=uid and status='active' order by agency_id limit 1;
 if aid is not null and not public.is_agency_booker(aid) then raise exception 'Only agency booking staff can request places.'; end if;
 if aid is null and jsonb_array_length(p_parties)<>1 then raise exception 'Only agents can submit multiple customers.'; end if;
 if aid is not null and not exists(select 1 from public.agencies where id=aid and (coalesce(array_length(allowed_products,1),0)=0 or 'umrah'=any(allowed_products))) then raise exception 'Your agency cannot book Umrah.'; end if;
 for party in select value from jsonb_array_elements(p_parties) loop
  if jsonb_typeof(party->'pilgrims') is distinct from 'array' then raise exception 'Add the travelers.'; end if;
  n:=jsonb_array_length(party->'pilgrims');
  if n not between 1 and 60 then raise exception 'Choose 1 to 60 pilgrims.'; end if;
  total_n:=total_n+n;
 end loop;
 if total_n>d.total_seats-d.booked_seats-d.offline_seats then raise exception 'Not enough places remain in this pool.'; end if;
 insert into public.umrah_pool_submissions(actor_id,idempotency_key,departure_id,payload) values(uid,p_key,d.id,payload) returning * into sub;
 for party in select value from jsonb_array_elements(p_parties) loop
  cid:=nullif(party->>'agencyCustomerId','')::uuid;
  if aid is not null and (cid is null or not exists(select 1 from public.agency_customers where id=cid and agency_id=aid)) then raise exception 'Select a customer belonging to your agency.'; end if;
  if aid is null and cid is not null then raise exception 'Agency customer access denied.'; end if;
  n:=jsonb_array_length(party->'pilgrims');
  if exists(select 1 from public.umrah_package_pricing where package_id=p.id) then
   select price into rate from public.umrah_package_pricing where package_id=p.id and sharing=(party->>'roomSharing')::int;
   if rate is null then raise exception 'Select an offered room sharing option.'; end if;
  else rate:=coalesce(d.price_override,p.base_price); end if;
  net:=rate*n; markup:=0;
  if aid is not null then
   select * into rule from public.agency_markups where agency_id=aid and (item_type='umrah' or item_type is null) order by item_type nulls last limit 1;
   if found then markup:=round(case when rule.markup_type='percent' then net*rule.value/100 else rule.value end,2); end if;
  end if;
  insert into public.umrah_pool_requests(submission_id,departure_id,customer_id,booked_by,agency_id,agency_customer_id,num_pilgrims,room_sharing,special_requests,currency,unit_price,subtotal,markup_amount,total,quote_snapshot)
  values(sub.id,d.id,uid,uid,aid,cid,n,nullif(party->>'roomSharing','')::smallint,left(coalesce(party->>'specialRequests',''),2000),p.currency,rate,net,markup,net+markup,
   jsonb_build_object('packageName',p.name,'departureDate',d.departure_date,'returnDate',d.return_date,'terms',d.request_terms,'includes',p.includes,'accommodation',p.accommodation_details,'meals',p.meals_note,'flights',p.flight_details,'transport',p.transport_details,'tax',0,'fees',0)) returning id into rid;
  for traveler in select value from jsonb_array_elements(party->'pilgrims') loop
   insert into public.umrah_pool_request_travelers(request_id,full_name,gender,date_of_birth,nationality,passport_number,passport_expiry,mahram_name,mahram_relation)
   values(rid,btrim(traveler->>'full_name'),(traveler->>'gender')::public.pilgrim_gender,nullif(traveler->>'date_of_birth','')::date,traveler->>'nationality',traveler->>'passport_number',nullif(traveler->>'passport_expiry','')::date,traveler->>'mahram_name',traveler->>'mahram_relation');
  end loop;
  perform public.queue_umrah_pool_notice(rid,'received');
 end loop;
 if d.formation_status='forming' and (select booked_seats=total_seats from public.umrah_package_departures where id=d.id) then
  update public.umrah_package_departures set formation_status='activation_pending' where id=d.id;
  insert into public.umrah_pool_events(departure_id,kind,event_key,actor_id) values(d.id,'activate',d.id::text||':activate',uid) on conflict(event_key) do update set processed_at=null,last_error=null;
 end if;
 return (select jsonb_agg(jsonb_build_object('id',id,'reference',reference) order by created_at,id) from public.umrah_pool_requests where submission_id=sub.id);
end $$;
revoke all on function public.submit_umrah_pool_requests(uuid,uuid,jsonb,boolean) from public,anon;
grant execute on function public.submit_umrah_pool_requests(uuid,uuid,jsonb,boolean) to authenticated;

create function public.withdraw_umrah_pool_request(p_request_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r public.umrah_pool_requests; dep uuid;
begin
 select departure_id into dep from public.umrah_pool_requests where id=p_request_id;
 perform 1 from public.umrah_package_departures where id=dep for update;
 select * into r from public.umrah_pool_requests where id=p_request_id for update;
 if r.id is null or not (public.is_admin() or (r.agency_id is null and r.customer_id=auth.uid()) or (r.agency_id is not null and public.is_agency_booker(r.agency_id))) then raise exception 'Request not found.'; end if;
 if r.status='withdrawn' then return; end if;
 if r.status<>'requested' then raise exception 'Use the booking cancellation process after payment is invited.'; end if;
 update public.umrah_pool_requests set status='withdrawn',closed_reason='Withdrawn by applicant' where id=r.id;
 update public.umrah_package_departures set formation_status='forming' where id=dep and formation_status='activation_pending';
 insert into public.umrah_pool_events(departure_id,request_id,kind,event_key,actor_id,processed_at) values(dep,r.id,'withdrawn',r.id::text||':withdrawn',auth.uid(),now());
end $$;
revoke all on function public.withdraw_umrah_pool_request(uuid) from public,anon;
grant execute on function public.withdraw_umrah_pool_request(uuid) to authenticated;
-- Older clients must not bypass the new request lifecycle.
alter function public.create_umrah_group_booking(uuid,integer,smallint,text,jsonb,uuid) rename to create_umrah_group_booking_before_requests;
revoke all on function public.create_umrah_group_booking_before_requests(uuid,integer,smallint,text,jsonb,uuid) from public,anon,authenticated;
create function public.create_umrah_group_booking(p_departure_id uuid,p_num_pilgrims integer,p_room_sharing smallint,p_special_requests text,p_pilgrims jsonb,p_agency_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from public.umrah_package_departures where id=p_departure_id and booking_mode='request_then_pay') then raise exception 'Request places before payment for this pool.'; end if;
 return public.create_umrah_group_booking_before_requests(p_departure_id,p_num_pilgrims,p_room_sharing,p_special_requests,p_pilgrims,p_agency_id);
end $$;
revoke all on function public.create_umrah_group_booking(uuid,integer,smallint,text,jsonb,uuid) from public,anon;
grant execute on function public.create_umrah_group_booking(uuid,integer,smallint,text,jsonb,uuid) to authenticated;
alter function public.admin_public_umrah_pool() rename to admin_public_umrah_pool_before_requests;
revoke all on function public.admin_public_umrah_pool_before_requests() from public,anon,authenticated;
create function public.admin_public_umrah_pool() returns jsonb language plpgsql security definer set search_path=public as $$
declare rows jsonb; item jsonb; result jsonb:='[]'; d public.umrah_package_departures; paid_n int; req_n int; customers_n int;
begin
 if not public.is_admin() then raise exception 'Admin access required.'; end if;
 rows:=public.admin_public_umrah_pool_before_requests();
 for item in select value from jsonb_array_elements(rows) loop
  select * into d from public.umrah_package_departures where id=(item->>'departure_id')::uuid;
  if d.booking_mode='request_then_pay' then
   select coalesce(sum(num_pilgrims) filter(where status='paid'),0),count(*),count(distinct coalesce(agency_customer_id,customer_id)) into paid_n,req_n,customers_n from public.umrah_pool_requests where departure_id=d.id and status in ('requested','payment_due','paid');
   item:=item||jsonb_build_object('booking_mode',d.booking_mode,'formation_status',d.formation_status,'allocated_seats',d.booked_seats,'confirmed_seats',paid_n,'held_seats',d.booked_seats-paid_n,'bookings',req_n,'customers',customers_n,'activation_error',d.activation_error);
  end if;
  result:=result||jsonb_build_array(item);
 end loop;
 return result;
end $$;
revoke all on function public.admin_public_umrah_pool() from public,anon;
grant execute on function public.admin_public_umrah_pool() to authenticated;
