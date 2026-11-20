create or replace function public.guard_umrah_pool_configuration() returns trigger language plpgsql security definer set search_path=public as $$
begin
 -- Staff may schedule a full pool before payment invitations are issued.
 if public.is_admin() and old.booking_mode='request_then_pay' and old.formation_status='activation_pending'
   and old.booked_seats=old.total_seats and old.total_seats>0
   and (new.booking_mode,new.total_seats,new.price_override,new.payment_window_hours,new.request_terms,new.package_id)
     is not distinct from (old.booking_mode,old.total_seats,old.price_override,old.payment_window_hours,old.request_terms,old.package_id)
   and new.departure_date>(now() at time zone 'Africa/Mogadishu')::date
   and new.payment_cutoff_at>=now()+new.payment_window_hours*interval '1 hour'
   and not exists(select 1 from public.umrah_pool_requests where departure_id=old.id and status in ('payment_due','paid')) then
   return new;
 end if;
 if exists(select 1 from public.umrah_pool_requests r where r.departure_id=old.id) and
  (new.booking_mode,new.total_seats,new.departure_date,new.return_date,new.price_override,new.formation_closes_at,new.payment_cutoff_at,new.payment_window_hours,new.request_terms,new.package_id)
  is distinct from (old.booking_mode,old.total_seats,old.departure_date,old.return_date,old.price_override,old.formation_closes_at,old.payment_cutoff_at,old.payment_window_hours,old.request_terms,old.package_id) then
  raise exception 'This pool already has requests. Its capacity, dates and terms are locked.';
 end if;
 return new;
end $$;

-- Keep customer views and all queued notifications on the selected dates.
create function public.sync_umrah_pool_schedule() returns trigger language plpgsql security definer set search_path=public as $$
begin
 update public.umrah_pool_requests set quote_snapshot=quote_snapshot || jsonb_build_object('departureDate',new.departure_date,'returnDate',new.return_date)
 where departure_id=new.id and status='requested';
 return new;
end $$;
create trigger sync_umrah_pool_schedule after update of departure_date,return_date on public.umrah_package_departures
for each row execute function public.sync_umrah_pool_schedule();

alter function public.admin_confirm_umrah_pool(uuid) rename to admin_confirm_umrah_pool_before_schedule;
revoke all on function public.admin_confirm_umrah_pool_before_schedule(uuid) from public,anon,authenticated;
create function public.admin_confirm_umrah_pool(p_departure uuid,p_departure_date date default null)
returns integer language plpgsql security definer set search_path=public as $$
declare d public.umrah_package_departures; days integer; cutoff timestamptz;
begin
 if not public.is_admin() then raise exception 'Admin access required.'; end if;
 select * into d from public.umrah_package_departures where id=p_departure for update;
 if not found or d.booking_mode<>'request_then_pay' or d.formation_status<>'activation_pending' then raise exception 'This pool is not awaiting confirmation.'; end if;
 if d.booked_seats<>d.total_seats or d.total_seats<1 then raise exception 'The pool must reach its seat target first.'; end if;
 if p_departure_date is not null then
   cutoff:=(p_departure_date::timestamp at time zone 'Africa/Mogadishu')-interval '1 second';
   if p_departure_date<=(now() at time zone 'Africa/Mogadishu')::date or cutoff<now()+d.payment_window_hours*interval '1 hour' then
     raise exception 'Choose a departure date after the full payment window.';
   end if;
   select duration_days into days from public.umrah_packages where id=d.package_id;
   update public.umrah_package_departures set departure_date=p_departure_date,return_date=p_departure_date+days-1,
     formation_closes_at=least(formation_closes_at,now()),payment_cutoff_at=cutoff where id=d.id;
 end if;
 return public.admin_confirm_umrah_pool_before_schedule(p_departure);
end $$;
revoke all on function public.admin_confirm_umrah_pool(uuid,date) from public,anon;
grant execute on function public.admin_confirm_umrah_pool(uuid,date) to authenticated;
