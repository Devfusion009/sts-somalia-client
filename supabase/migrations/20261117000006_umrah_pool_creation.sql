-- Package + first departure + formation terms are one transaction.
alter function public.create_public_umrah_package(jsonb,date,integer) rename to create_public_umrah_package_before_requests;
revoke all on function public.create_public_umrah_package_before_requests(jsonb,date,integer) from public,anon,authenticated;
create function public.create_public_umrah_package(p_package jsonb,p_departure_date date,p_total_seats integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare pkg uuid; dep uuid;
begin
 pkg:=public.create_public_umrah_package_before_requests(p_package,p_departure_date,p_total_seats);
 if coalesce((p_package->>'request_first')::boolean,false) then
  select id into dep from public.umrah_package_departures where package_id=pkg;
  perform public.configure_umrah_request_pool(dep,(p_package->>'formation_closes_at')::timestamptz,(p_package->>'payment_cutoff_at')::timestamptz,(p_package->>'payment_window_hours')::int,p_package->>'request_terms');
 end if;
 return pkg;
end $$;
revoke all on function public.create_public_umrah_package(jsonb,date,integer) from public,anon;
grant execute on function public.create_public_umrah_package(jsonb,date,integer) to authenticated;
