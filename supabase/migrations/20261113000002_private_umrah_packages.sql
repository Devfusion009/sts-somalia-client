-- Admin-created private packages use the existing private approval workflow.
-- Prices, route, dates, facilities and hotels are snapshotted server-side.
alter table public.umrah_packages add column package_type text not null default 'group'
  check (package_type in ('group','private'));
alter table public.umrah_custom_requests add column package_snapshot jsonb;

create or replace function public.create_umrah_group_booking(
  p_departure_id uuid,
  p_num_pilgrims integer,
  p_room_sharing smallint,
  p_special_requests text,
  p_pilgrims jsonb,
  p_agency_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  dep public.umrah_package_departures;
  pkg public.umrah_packages;
  v_has_rates boolean;
  v_rate numeric;
  v_unit numeric;
  v_sharing smallint;
  v_booking_id uuid;
  v_request_id uuid;
  v_makkah integer;
  v_madinah integer;
begin
  if v_uid is null then
    raise exception 'not authorized';
  end if;
  if p_agency_id is not null and not (p_agency_id = any (public.my_agency_ids())) then
    raise exception 'not authorized';
  end if;
  if p_num_pilgrims is null or p_num_pilgrims < 1 then
    raise exception 'at least one pilgrim is required';
  end if;
  if jsonb_typeof(p_pilgrims) <> 'array' or jsonb_array_length(p_pilgrims) <> p_num_pilgrims then
    raise exception 'pilgrim details do not match the number of pilgrims';
  end if;

  select * into dep from public.umrah_package_departures where id = p_departure_id;
  if not found then
    raise exception 'departure not found';
  end if;
  select * into pkg from public.umrah_packages where id = dep.package_id;
  if not found or pkg.status <> 'published' then
    raise exception 'departure not found';
  end if;
  if dep.status <> 'open' or dep.departure_date - dep.sales_close_days <= current_date then
    raise exception 'bookings for this departure are closed';
  end if;

  select exists (select 1 from public.umrah_package_pricing where package_id = pkg.id) into v_has_rates;
  if v_has_rates then
    select price into v_rate
      from public.umrah_package_pricing
     where package_id = pkg.id and sharing = p_room_sharing;
    if v_rate is null then
      raise exception 'select a room sharing option';
    end if;
    v_unit := v_rate;
    v_sharing := p_room_sharing;
  else
    v_unit := coalesce(dep.price_override, pkg.base_price);
    v_sharing := null;
  end if;

  if pkg.package_type = 'private' then
    if pkg.origin_iata is null or pkg.destination_iata is null then
      raise exception 'This package route is incomplete.';
    end if;
    if p_room_sharing is null or p_room_sharing not between 1 and 4 then
      raise exception 'select a room sharing option';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(v_uid::text || dep.id::text, 0));
    if exists (select 1 from public.umrah_custom_requests r join public.umrah_bookings b on b.custom_request_id=r.id
      where r.booked_by=v_uid and r.package_snapshot->>'packageId'=pkg.id::text
        and r.package_snapshot->>'departureDate'=dep.departure_date::text
        and r.package_snapshot->>'returnDate'=dep.return_date::text
        and b.status not in ('cancelled','refunded','failed')
        and exists (
          select 1
            from jsonb_array_elements(r.pilgrims) a, jsonb_array_elements(p_pilgrims) n
           where coalesce(nullif(upper(btrim(a->>'passport_number')), ''),
                          lower(btrim(a->>'full_name')) || '|' || coalesce(a->>'date_of_birth', ''))
               = coalesce(nullif(upper(btrim(n->>'passport_number')), ''),
                          lower(btrim(n->>'full_name')) || '|' || coalesce(n->>'date_of_birth', ''))
        )) then
      raise exception 'A booking request for these travellers and dates already exists.';
    end if;
    select coalesce(sum(nights) filter (where city = 'makkah'), 0),
           coalesce(sum(nights) filter (where city = 'madinah'), 0)
      into v_makkah, v_madinah from public.umrah_package_hotels where package_id = pkg.id;
    insert into public.umrah_custom_requests
      (customer_id, booked_by, agency_id, status, current_step, tier, num_pilgrims,
       room_sharing, departure_date, nights_makkah, nights_madinah, notes, pilgrims, subtotal, currency, package_snapshot)
    values (v_uid, v_uid, p_agency_id, 'submitted', 4,
       case when lower(pkg.tier) in ('basic','premium') then lower(pkg.tier)::public.umrah_tier else 'standard' end,
       p_num_pilgrims, p_room_sharing, dep.departure_date, v_makkah, v_madinah,
       nullif(btrim(coalesce(p_special_requests,'')),''), p_pilgrims, v_unit * p_num_pilgrims, pkg.currency,
       jsonb_build_object('packageId',pkg.id,'name',pkg.name,'origin',pkg.origin_iata,
         'destination',pkg.destination_iata,'departureDate',dep.departure_date,'returnDate',dep.return_date,
         'images',pkg.images,'includes',pkg.includes,
         'hotels',(select coalesce(jsonb_agg(to_jsonb(h)), '[]'::jsonb) from public.umrah_package_hotels h where h.package_id=pkg.id)))
    returning id into v_request_id;
    insert into public.umrah_custom_request_services
      (request_id,category,name,price_unit,unit_price,quantity,line_total)
    values (v_request_id,'extra',pkg.name,'per_person',v_unit,p_num_pilgrims,v_unit*p_num_pilgrims);
    insert into public.umrah_bookings
      (booking_kind,custom_request_id,customer_id,booked_by,agency_id,num_pilgrims,total_price,currency,room_sharing,special_requests)
    values ('private',v_request_id,v_uid,v_uid,p_agency_id,p_num_pilgrims,v_unit*p_num_pilgrims,pkg.currency,p_room_sharing,p_special_requests)
    returning id into v_booking_id;
  else
  -- The insert trigger reserves the seats under a row lock and raises
  -- 'not enough seats left on this departure'.
  insert into public.umrah_bookings (
    package_id, departure_id, customer_id, booked_by, agency_id,
    num_pilgrims, total_price, currency, room_sharing, special_requests
  ) values (
    pkg.id, dep.id, v_uid, v_uid, p_agency_id,
    p_num_pilgrims, v_unit * p_num_pilgrims, pkg.currency, v_sharing,
    nullif(btrim(coalesce(p_special_requests, '')), '')
  )
  returning id into v_booking_id;

  end if;

  insert into public.umrah_pilgrims (
    booking_id, full_name, gender, date_of_birth, nationality,
    passport_number, passport_expiry, mahram_name, mahram_relation
  )
  select v_booking_id,
         btrim(p.full_name),
         p.gender::public.pilgrim_gender,
         p.date_of_birth,
         nullif(btrim(p.nationality), ''),
         nullif(btrim(p.passport_number), ''),
         p.passport_expiry,
         nullif(btrim(p.mahram_name), ''),
         nullif(btrim(p.mahram_relation), '')
    from jsonb_to_recordset(p_pilgrims) as p(
      full_name text, gender text, date_of_birth date, nationality text,
      passport_number text, passport_expiry date, mahram_name text, mahram_relation text
    );

  if exists (select 1 from public.umrah_pilgrims where booking_id = v_booking_id and length(full_name) < 2) then
    raise exception 'enter each pilgrim''s full name';
  end if;

  return v_booking_id;
end;
$$;

revoke execute on function public.create_umrah_group_booking(uuid, integer, smallint, text, jsonb, uuid) from public, anon;
grant execute on function public.create_umrah_group_booking(uuid, integer, smallint, text, jsonb, uuid) to authenticated;

-- Enforce approval on every payment rail, including direct wallet RPC calls.
create or replace function public.require_private_umrah_approval_for_payment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if exists (select 1 from public.order_items oi join public.umrah_bookings b on b.id=oi.umrah_booking_id
    where oi.order_id=new.order_id and b.booking_kind='private' and b.status='pending') then
    raise exception 'This Umrah request is awaiting admin confirmation.';
  end if;
  return new;
end; $$;
revoke all on function public.require_private_umrah_approval_for_payment() from public,anon,authenticated;
create trigger private_umrah_approval_before_payment before insert on public.payments
for each row execute function public.require_private_umrah_approval_for_payment();

-- Failed order creation must not leave a submitted request without a booking.
create or replace function public.cleanup_private_package_orphan()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.custom_request_id is not null then
    delete from public.umrah_custom_requests r where r.id=old.custom_request_id
      and r.package_snapshot is not null
      and not exists(select 1 from public.umrah_bookings b where b.custom_request_id=r.id);
  end if;
  return old;
end; $$;
revoke all on function public.cleanup_private_package_orphan() from public,anon,authenticated;
create trigger cleanup_private_package_orphan after delete on public.umrah_bookings
for each row execute function public.cleanup_private_package_orphan();

-- Notify staff once the request has an order they can review.
create or replace function public.notify_private_package_request()
returns trigger language plpgsql security definer set search_path=public as $$
declare r public.umrah_custom_requests;
begin
  select cr.* into r from public.umrah_custom_requests cr join public.umrah_bookings b on b.custom_request_id=cr.id
    where b.id=new.umrah_booking_id and cr.package_snapshot is not null;
  if found then
    insert into public.notifications(profile_id,type,title,body,data)
      select id,'private_umrah_request','Private Umrah booking request',r.reference || ' · ' || (r.package_snapshot->>'name'),
        jsonb_build_object('href','/admin/umrah/requests','booking_id',new.umrah_booking_id,'order_id',new.order_id)
      from public.profiles where is_platform_admin;
  end if;
  return new;
end; $$;
revoke all on function public.notify_private_package_request() from public,anon,authenticated;
create trigger notify_private_package_request after insert on public.order_items
for each row when (new.umrah_booking_id is not null) execute function public.notify_private_package_request();

create or replace function public.protect_private_package_snapshot()
returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='INSERT' and new.package_snapshot is not null and current_user in ('anon','authenticated') then
    raise exception 'Package requests must use the booking service.';
  end if;
  if tg_op='UPDATE' and old.package_snapshot is distinct from new.package_snapshot then
    raise exception 'The booked package snapshot cannot be changed.';
  end if;
  return new;
end; $$;
create trigger protect_private_package_snapshot before insert or update on public.umrah_custom_requests
for each row execute function public.protect_private_package_snapshot();
