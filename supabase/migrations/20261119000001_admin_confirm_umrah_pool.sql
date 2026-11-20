-- Full request pools wait for a staff decision before payment invitations.
-- The worker still activates replacement requests after staff open those places.
create or replace function public.process_umrah_request_pools(p_limit integer default 25)
returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.umrah_package_departures; r record; count_done int:=0; failures int:=0; due timestamptz;
begin
 for d in select * from public.umrah_package_departures where booking_mode='request_then_pay'
   and formation_status='payment_open' and replacement_sales_open
   and exists(select 1 from public.umrah_pool_requests candidate where candidate.departure_id=umrah_package_departures.id and candidate.status='requested')
   order by departure_date limit greatest(1,least(p_limit,100)) for update skip locked
 loop
  begin
   due:=now()+d.payment_window_hours*interval '1 hour';
   if due>d.payment_cutoff_at then raise exception 'The full payment window is unavailable.'; end if;
   for r in select id from public.umrah_pool_requests where departure_id=d.id and status='requested' order by id loop
    perform public.activate_umrah_pool_request(r.id,due);
   end loop;
   update public.umrah_package_departures set activation_error=null where id=d.id;
   count_done:=count_done+1;
  exception when others then
   update public.umrah_package_departures set activation_error=sqlerrm where id=d.id;
   failures:=failures+1;
  end;
 end loop;
 return jsonb_build_object('activated',count_done,'failed',failures);
end $$;
revoke all on function public.process_umrah_request_pools(integer) from public,anon,authenticated;
grant execute on function public.process_umrah_request_pools(integer) to service_role;

create function public.admin_confirm_umrah_pool(p_departure uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare d public.umrah_package_departures; r record; due timestamptz; confirmed integer:=0;
begin
 if not public.is_admin() then raise exception 'Admin access required.'; end if;
 select * into d from public.umrah_package_departures where id=p_departure for update;
 if not found or d.booking_mode<>'request_then_pay' or d.formation_status<>'activation_pending' then
  raise exception 'This pool is not awaiting confirmation.';
 end if;
 if d.booked_seats<>d.total_seats or d.total_seats<1 then raise exception 'The pool must reach its seat target first.'; end if;
 due:=now()+d.payment_window_hours*interval '1 hour';
 if due>d.payment_cutoff_at then raise exception 'The full payment window is unavailable.'; end if;
 for r in select id from public.umrah_pool_requests where departure_id=d.id and status='requested' order by id loop
  perform public.activate_umrah_pool_request(r.id,due);
  confirmed:=confirmed+1;
 end loop;
 if confirmed=0 then raise exception 'No requests are ready for confirmation.'; end if;
 update public.umrah_package_departures set formation_status='payment_open',activated_at=now(),activation_error=null,replacement_sales_open=false where id=d.id;
 update public.umrah_pool_events set processed_at=now(),attempts=attempts+1,last_error=null where departure_id=d.id and kind='activate';
 return confirmed;
end $$;
revoke all on function public.admin_confirm_umrah_pool(uuid) from public,anon;
grant execute on function public.admin_confirm_umrah_pool(uuid) to authenticated;
