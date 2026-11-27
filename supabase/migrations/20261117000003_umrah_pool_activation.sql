-- Request allocation transfers to fulfillment without counting seats twice.
create or replace function public.umrah_bookings_reserve_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists(select 1 from public.umrah_package_departures where id=new.departure_id and booking_mode='request_then_pay') then
    if new.booking_kind<>'group' or new.status<>'pending' or new.fulfillment_stage<>'booked' or not exists(select 1 from public.umrah_pool_requests r where r.id=new.pool_request_id and r.departure_id=new.departure_id and new.package_id=(select package_id from public.umrah_package_departures where id=r.departure_id) and r.room_sharing is not distinct from new.room_sharing and r.num_pilgrims=new.num_pilgrims and r.customer_id=new.customer_id and r.booked_by=new.booked_by and r.agency_id is not distinct from new.agency_id and r.subtotal=new.total_price and r.currency=new.currency and r.status='requested' and r.booking_id is null) then raise exception 'A matching accepted pool request is required.'; end if;
    return new;
  end if;
  if public.umrah_booking_holds_seats(new.booking_kind, new.status) then
    perform public._umrah_reserve_seats(new.departure_id, new.num_pilgrims);
  end if;
  return new;
end;
$$;
create or replace function public.umrah_bookings_sync_seats_on_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_holds boolean;
  v_new_holds boolean;
begin
  if old.pool_request_id is not null then
    if tg_op='DELETE' then raise exception 'Pool bookings cannot be deleted.'; end if;
    if (new.pool_request_id,new.departure_id,new.num_pilgrims,new.total_price,new.currency,new.customer_id,new.booked_by,new.agency_id) is distinct from (old.pool_request_id,old.departure_id,old.num_pilgrims,old.total_price,old.currency,old.customer_id,old.booked_by,old.agency_id) then raise exception 'Pool booking terms are locked.'; end if;
    if new.status in ('cancelled','refunded','failed') and old.status not in ('cancelled','refunded','failed') then
      update public.umrah_pool_requests set status='cancelled',closed_reason='Booking cancelled' where id=old.pool_request_id and status in ('requested','payment_due','paid');
      if found then perform public.queue_umrah_pool_notice(old.pool_request_id,'cancelled'); end if;
      update public.umrah_package_departures set formation_status='payment_open' where id=old.departure_id and formation_status='ready';
    end if;
    return new;
  end if;
  if tg_op<>'DELETE' and new.pool_request_id is not null then raise exception 'A legacy booking cannot change mode.'; end if;
  if tg_op = 'DELETE' then
    if public.umrah_booking_holds_seats(old.booking_kind, old.status) then
      perform public._umrah_release_seats(old.departure_id, old.num_pilgrims);
    end if;
    return old;
  end if;

  v_old_holds := public.umrah_booking_holds_seats(old.booking_kind, old.status);
  v_new_holds := public.umrah_booking_holds_seats(new.booking_kind, new.status);

  if v_old_holds and v_new_holds
     and old.departure_id = new.departure_id
     and old.num_pilgrims = new.num_pilgrims then
    return new;
  end if;

  -- Release before reserving so resizing a booking on the same departure is
  -- checked against the seats it already held.
  if v_old_holds then
    perform public._umrah_release_seats(old.departure_id, old.num_pilgrims);
  end if;
  if v_new_holds then
    perform public._umrah_reserve_seats(new.departure_id, new.num_pilgrims);
  end if;

  return new;
end;
$$;
-- This helper is executable only by other trusted functions/worker role.
create function public.activate_umrah_pool_request(p_request uuid,p_due timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare r public.umrah_pool_requests; d public.umrah_package_departures; bid uuid; oid uuid;
begin
 select * into r from public.umrah_pool_requests where id=p_request for update;
 if r.status<>'requested' then return; end if;
 select * into d from public.umrah_package_departures where id=r.departure_id;
 if d.formation_status not in ('activation_pending','payment_open') or p_due> d.payment_cutoff_at or p_due<=now() then raise exception 'Pool activation is not ready.'; end if;
 insert into public.umrah_bookings(package_id,departure_id,customer_id,booked_by,agency_id,num_pilgrims,total_price,currency,room_sharing,special_requests,pool_request_id)
 values(d.package_id,d.id,r.customer_id,r.booked_by,r.agency_id,r.num_pilgrims,r.subtotal,r.currency,r.room_sharing,r.special_requests,r.id) returning id into bid;
 insert into public.umrah_pilgrims(booking_id,full_name,gender,date_of_birth,nationality,passport_number,passport_expiry,mahram_name,mahram_relation)
 select bid,full_name,gender,date_of_birth,nationality,passport_number,passport_expiry,mahram_name,mahram_relation from public.umrah_pool_request_travelers where request_id=r.id;
 insert into public.orders(customer_id,booked_by,agency_id,agency_customer_id,currency,subtotal,markup_amount,total)
 values(r.customer_id,r.booked_by,r.agency_id,r.agency_customer_id,r.currency,r.subtotal,r.markup_amount,r.total) returning id into oid;
 insert into public.order_items(order_id,item_type,umrah_booking_id,unit_price,quantity,total_price) values(oid,'umrah',bid,r.subtotal,1,r.subtotal);
 update public.orders set balance_due_at=(p_due at time zone 'Africa/Mogadishu')::date,min_first_payment=r.total where id=oid;
 update public.umrah_pool_requests set status='payment_due',booking_id=bid,order_id=oid,payment_due_at=p_due where id=r.id;
 perform public.queue_umrah_pool_notice(r.id,'payment_due');
end $$;
revoke all on function public.activate_umrah_pool_request(uuid,timestamptz) from public,anon,authenticated;

create function public.process_umrah_request_pools(p_limit integer default 25)
returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.umrah_package_departures; r record; count_done int:=0; failures int:=0; due timestamptz;
begin
 for d in select * from public.umrah_package_departures where booking_mode='request_then_pay'
  and (formation_status='activation_pending' or (formation_status='payment_open' and exists(select 1 from public.umrah_pool_requests candidate where candidate.departure_id=umrah_package_departures.id and candidate.status='requested')))
  order by departure_date limit greatest(1,least(p_limit,100)) for update skip locked
 loop
  begin
   if d.formation_status='activation_pending' and d.booked_seats<>d.total_seats then
    update public.umrah_package_departures set formation_status='forming' where id=d.id;
    continue;
   end if;
   due:=now()+d.payment_window_hours*interval '1 hour';
   if due>d.payment_cutoff_at then raise exception 'The full payment window is unavailable. Staff action required.'; end if;
   for r in select id from public.umrah_pool_requests where departure_id=d.id and status='requested' order by id loop
    perform public.activate_umrah_pool_request(r.id,due);
   end loop;
   update public.umrah_package_departures set formation_status='payment_open',activated_at=coalesce(activated_at,now()),activation_error=null,replacement_sales_open=false where id=d.id;
   update public.umrah_pool_events set processed_at=now(),attempts=attempts+1,last_error=null where departure_id=d.id and kind='activate';
   count_done:=count_done+1;
  exception when others then
   update public.umrah_package_departures set activation_error=sqlerrm where id=d.id;
   update public.umrah_pool_events set attempts=attempts+1,last_error=sqlerrm where departure_id=d.id and kind='activate';
   failures:=failures+1;
  end;
 end loop;
 return jsonb_build_object('activated',count_done,'failed',failures);
end $$;
revoke all on function public.process_umrah_request_pools(integer) from public,anon,authenticated;
grant execute on function public.process_umrah_request_pools(integer) to service_role;
