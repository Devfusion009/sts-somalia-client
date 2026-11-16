-- Public departures and agency-specific events share the same seat inventory.
alter table public.umrah_packages
  add column pool_visibility text not null default 'public' check(pool_visibility in ('public','private')),
  add column organizer_name text not null default 'STS Somalia';

create function public.guard_umrah_organizer() returns trigger language plpgsql set search_path=public as $$
begin
  if length(btrim(new.organizer_name))<2 then raise exception 'Enter the organizer name.'; end if;
  if new.package_type='group' and new.status='published' and coalesce(new.contact_person_email,'') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter the organizer contact email.';
  end if;
  return new;
end $$;
create trigger guard_umrah_organizer before insert or update on public.umrah_packages
for each row execute function public.guard_umrah_organizer();

alter function public.create_public_umrah_package(jsonb,date,integer) rename to create_public_umrah_package_before_pool;
revoke all on function public.create_public_umrah_package_before_pool(jsonb,date,integer) from public,anon,authenticated;
create function public.create_public_umrah_package(p_package jsonb,p_departure_date date,p_total_seats integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  if coalesce(p_package->>'contact_person_email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter the organizer contact email.'; end if;
  v_id:=public.create_public_umrah_package_before_pool(p_package,p_departure_date,p_total_seats);
  update public.umrah_packages set pool_visibility=coalesce(p_package->>'pool_visibility','public'),
    organizer_name=coalesce(p_package->>'organizer_name','STS Somalia'),contact_person_email=p_package->>'contact_person_email' where id=v_id;
  return v_id;
end $$;
revoke all on function public.create_public_umrah_package(jsonb,date,integer) from public,anon;
grant execute on function public.create_public_umrah_package(jsonb,date,integer) to authenticated;

-- Do not expose an agency event through an anonymous deep link or booking RPC.
drop policy "umrah_packages: public reads published" on public.umrah_packages;
create policy "umrah_packages: public reads published" on public.umrah_packages for select to anon,authenticated
using(status='published' and (pool_visibility='public' or exists(select 1 from public.umrah_package_agencies a
 where a.package_id=umrah_packages.id and a.agency_id=any(public.my_agency_ids()))));

alter function public.create_umrah_group_booking(uuid,integer,smallint,text,jsonb,uuid) rename to create_umrah_group_booking_before_pool;
revoke all on function public.create_umrah_group_booking_before_pool(uuid,integer,smallint,text,jsonb,uuid) from public,anon,authenticated;
create function public.create_umrah_group_booking(p_departure_id uuid,p_num_pilgrims integer,p_room_sharing smallint,
 p_special_requests text,p_pilgrims jsonb,p_agency_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_pkg public.umrah_packages;
begin
 select p.* into v_pkg from public.umrah_packages p join public.umrah_package_departures d on d.package_id=p.id where d.id=p_departure_id for share of p;
 if v_pkg.pool_visibility='private' and not public.is_admin() and not exists(select 1 from public.umrah_package_agencies a
   where a.package_id=v_pkg.id and a.agency_id=p_agency_id and a.agency_id=any(public.my_agency_ids())) then
   raise exception 'This Umrah pool is reserved for its assigned agency.';
 end if;
 return public.create_umrah_group_booking_before_pool(p_departure_id,p_num_pilgrims,p_room_sharing,p_special_requests,p_pilgrims,p_agency_id);
end $$;
revoke all on function public.create_umrah_group_booking(uuid,integer,smallint,text,jsonb,uuid) from public,anon;
grant execute on function public.create_umrah_group_booking(uuid,integer,smallint,text,jsonb,uuid) to authenticated;

create or replace function public.admin_public_umrah_pool()
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  perform public.release_public_umrah_checkouts();
  select coalesce(jsonb_agg(row_to_json(pool) order by pool.departure_date,pool.name),'[]'::jsonb) into result from (
    select p.id as package_id,p.name,p.status as package_status,case when p.package_type='private' then 'private' else p.pool_visibility end as pool_visibility,p.organizer_name,p.contact_person_email,p.contact_person_name,p.contact_person_phone,
      d.id as departure_id,d.departure_date,d.return_date,d.status as departure_status,d.sales_close_days,d.total_seats,
      (case when p.package_type='private' then (select coalesce(sum(b.num_pilgrims),0) from public.umrah_bookings b where (b.departure_id=d.id or (p.package_type='private' and exists(select 1 from public.umrah_custom_requests cr where cr.id=b.custom_request_id and cr.package_snapshot->>'packageId'=p.id::text and (d.id is null or cr.package_snapshot->>'departureDate'=d.departure_date::text)))) and b.status in ('pending','confirmed','completed','no_show')) else d.booked_seats end) as booked_seats,d.offline_seats,greatest(d.total_seats-(case when p.package_type='private' then (select coalesce(sum(b.num_pilgrims),0) from public.umrah_bookings b where (b.departure_id=d.id or (p.package_type='private' and exists(select 1 from public.umrah_custom_requests cr where cr.id=b.custom_request_id and cr.package_snapshot->>'packageId'=p.id::text and (d.id is null or cr.package_snapshot->>'departureDate'=d.departure_date::text)))) and b.status in ('pending','confirmed','completed','no_show')) else d.booked_seats end)-d.offline_seats,0) as available_seats,
      coalesce((select sum(b.num_pilgrims) from public.umrah_bookings b where (b.departure_id=d.id or (p.package_type='private' and exists(select 1 from public.umrah_custom_requests cr where cr.id=b.custom_request_id and cr.package_snapshot->>'packageId'=p.id::text and (d.id is null or cr.package_snapshot->>'departureDate'=d.departure_date::text))))
        and b.status in ('confirmed','completed','no_show')),0) as confirmed_seats,
      coalesce((select sum(b.num_pilgrims) from public.umrah_bookings b where (b.departure_id=d.id or (p.package_type='private' and exists(select 1 from public.umrah_custom_requests cr where cr.id=b.custom_request_id and cr.package_snapshot->>'packageId'=p.id::text and (d.id is null or cr.package_snapshot->>'departureDate'=d.departure_date::text))))
        and b.status='pending'),0) as held_seats,
      (select count(*) from public.umrah_bookings b where (b.departure_id=d.id or (p.package_type='private' and exists(select 1 from public.umrah_custom_requests cr where cr.id=b.custom_request_id and cr.package_snapshot->>'packageId'=p.id::text and (d.id is null or cr.package_snapshot->>'departureDate'=d.departure_date::text)))) and b.booking_kind='group'
        and b.status in ('pending','confirmed','completed','no_show')) as bookings,
      (select count(distinct coalesce(o.agency_customer_id,b.customer_id)) from public.umrah_bookings b
        left join public.order_items oi on oi.umrah_booking_id=b.id left join public.orders o on o.id=oi.order_id
        where (b.departure_id=d.id or (p.package_type='private' and exists(select 1 from public.umrah_custom_requests cr where cr.id=b.custom_request_id and cr.package_snapshot->>'packageId'=p.id::text and (d.id is null or cr.package_snapshot->>'departureDate'=d.departure_date::text)))) and b.status in ('pending','confirmed','completed','no_show')) as customers
    from public.umrah_packages p left join public.umrah_package_departures d on d.package_id=p.id

  ) pool;
  return result;
end $$;

-- Publishing an agency event requires an explicit booking agency assignment.
create function public.guard_private_pool_assignment() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.pool_visibility='private' and new.package_type='group' and new.status='published'
   and not exists(select 1 from public.umrah_package_agencies where package_id=new.id) then
   raise exception 'Assign an agency before publishing a private Umrah pool.';
 end if;
 return new;
end $$;
create trigger guard_private_pool_assignment before insert or update on public.umrah_packages
for each row execute function public.guard_private_pool_assignment();
