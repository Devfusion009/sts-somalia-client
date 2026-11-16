-- Public packages: complete setup, one inventory pool per dated departure,
-- and full payment before confirmation. Private requests retain their terms.
alter table public.umrah_packages
  add column agent_contacts jsonb not null default '[]',
  add column facilities text,
  add column accommodation_details text,
  add column flight_details text,
  add column transport_details text,
  add column nights_makkah smallint,
  add column nights_madinah smallint,
  add column public_setup_complete boolean not null default false;

create function public.validate_public_umrah_package()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.package_type <> 'group' then return new; end if;
  if jsonb_typeof(new.agent_contacts)<>'array' or jsonb_array_length(new.agent_contacts)>20 then raise exception 'Enter valid public agent contacts.'; end if;
  if exists(select 1 from jsonb_array_elements(new.agent_contacts) c where
    jsonb_typeof(c)<>'object' or length(btrim(coalesce(c->>'name','')))<2
    or coalesce(c->>'phone','') !~ '^\+?[0-9 ()-]{7,40}$'
    or length(regexp_replace(coalesce(c->>'phone',''),'[^0-9]','','g'))<7) then
    raise exception 'Enter the agent name and a valid phone number.';
  end if;
  new.public_setup_complete :=
    length(btrim(new.name)) >= 2 and length(btrim(coalesce(new.description,''))) > 0
    and new.duration_days between 2 and 120 and new.base_price > 0
    and jsonb_array_length(new.includes) > 0
    and length(btrim(coalesce(new.contact_person_name,''))) >= 2
    and coalesce(new.contact_person_phone,'') ~ '^\+?[0-9 ()-]{7,40}$'
    and length(regexp_replace(coalesce(new.contact_person_phone,''),'[^0-9]','','g')) >= 7
    and length(btrim(coalesce(new.facilities,''))) > 0
    and length(btrim(coalesce(new.accommodation_details,''))) > 0
    and length(btrim(coalesce(new.flight_details,''))) > 0
    and length(btrim(coalesce(new.transport_details,''))) > 0
    and length(btrim(coalesce(new.meals_note,''))) > 0
    and new.nights_makkah >= 0 and new.nights_madinah >= 0
    and new.nights_makkah + new.nights_madinah between 1 and new.duration_days - 1;
  new.public_setup_complete := coalesce(new.public_setup_complete, false);
  new.deposit_percent := 100;
  new.full_payment_before_documents := true;
  if tg_op = 'INSERT' or new.status = 'published' then
    if not new.public_setup_complete then
      raise exception 'Complete the package, stay, facilities, meals, flights, transport and responsible person details.';
    end if;
  end if;
  if new.status = 'published' then
    if exists(select 1 from public.umrah_package_departures d where d.package_id=new.id and d.status='open'
      and d.return_date-d.departure_date+1<>new.duration_days) then
      raise exception 'Departure dates must match the package duration.';
    end if;
    if not exists (select 1 from public.umrah_package_departures d where d.package_id=new.id
      and d.status='open' and d.departure_date-d.sales_close_days>current_date
      and d.return_date-d.departure_date+1=new.duration_days and d.total_seats>0) then
      raise exception 'Add an open future departure with seats and dates matching the package duration.';
    end if;
  end if;
  return new;
end $$;
create trigger validate_public_umrah_package before insert or update on public.umrah_packages
for each row execute function public.validate_public_umrah_package();

-- Create package and first seat pool together; failed dates/capacity leave no draft behind.
create function public.create_public_umrah_package(p_package jsonb, p_departure_date date, p_total_seats integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  if p_departure_date is null or p_departure_date<=current_date then raise exception 'Choose a future departure date.'; end if;
  if p_total_seats is null or p_total_seats not between 1 and 10000 then raise exception 'Total seats must be 1 to 10000.'; end if;
  insert into public.umrah_packages(name,slug,description,package_type,duration_days,includes,base_price,currency,status,
    origin_iata,destination_iata,contact_person_name,contact_person_phone,facilities,accommodation_details,
    flight_details,transport_details,meals_note,nights_makkah,nights_madinah,agent_contacts)
  values (btrim(p_package->>'name'),p_package->>'slug',btrim(p_package->>'description'),'group',
    (p_package->>'duration_days')::smallint,p_package->'includes',(p_package->>'base_price')::numeric,
    upper(p_package->>'currency'),'draft',p_package->>'origin_iata',p_package->>'destination_iata',
    btrim(p_package->>'contact_person_name'),btrim(p_package->>'contact_person_phone'),p_package->>'facilities',
    p_package->>'accommodation_details',p_package->>'flight_details',p_package->>'transport_details',
    p_package->>'meals_note',(p_package->>'nights_makkah')::smallint,(p_package->>'nights_madinah')::smallint,coalesce(p_package->'agent_contacts','[]'::jsonb))
  returning id into v_id;
  insert into public.umrah_package_departures(package_id,departure_date,return_date,total_seats)
  values(v_id,p_departure_date,p_departure_date+(p_package->>'duration_days')::int-1,p_total_seats);
  return v_id;
end $$;
revoke all on function public.create_public_umrah_package(jsonb,date,integer) from public,anon;
grant execute on function public.create_public_umrah_package(jsonb,date,integer) to authenticated;

-- Inventory changes are already protected by the seat ceiling and row locks.
-- Also reject dates contradicting the advertised duration, including draft departures.
create function public.validate_public_umrah_departure()
returns trigger language plpgsql set search_path=public as $$
declare pkg public.umrah_packages;
begin
  select * into pkg from public.umrah_packages where id=new.package_id;
  if pkg.package_type='group' and new.price_override is not null and new.price_override<=0 then
    raise exception 'Public Umrah rates must be greater than zero.';
  end if;
  if pkg.package_type='group' and pkg.public_setup_complete
     and new.return_date-new.departure_date+1<>pkg.duration_days then
    raise exception 'Departure dates must match the package duration.';
  end if;
  return new;
end $$;
create trigger validate_public_umrah_departure before insert or update of departure_date,return_date,package_id,price_override
on public.umrah_package_departures for each row execute function public.validate_public_umrah_departure();

-- Short checkout reservations. In-flight payments and submitted bank receipts
-- retain seats for reconciliation; a declined/failed payment can be retried within the window.
create function public.release_public_umrah_checkouts()
returns integer language plpgsql security definer set search_path=public as $$
declare r record; n integer:=0;
begin
  for r in select o.id from public.orders o where o.status in ('pending_payment','held')
    and o.created_at<now()-interval '30 minutes'
    and exists(select 1 from public.order_items oi join public.umrah_bookings b on b.id=oi.umrah_booking_id
      where oi.order_id=o.id and b.booking_kind='group' and b.status='pending')
    and not exists(select 1 from public.payments p where p.order_id=o.id and
      (p.status in ('succeeded','requires_action') or (p.status='processing' and p.created_at>now()-interval '2 hours')))
    for update of o skip locked
  loop
    perform public._apply_order_cancellation(r.id,'Checkout expired. Seats released.'); n:=n+1;
  end loop;
  -- Recovery for an interrupted API request between the booking and order writes.
  update public.umrah_bookings b set status='cancelled'
    where b.booking_kind='group' and b.status='pending' and b.created_at<now()-interval '30 minutes'
      and not exists(select 1 from public.order_items oi where oi.umrah_booking_id=b.id);
  return n;
end $$;
revoke all on function public.release_public_umrah_checkouts() from public;
grant execute on function public.release_public_umrah_checkouts() to anon,authenticated,service_role;

-- Keep the private package implementation; wrap the shared entry point with public checks.
alter function public.create_umrah_group_booking(uuid,integer,smallint,text,jsonb,uuid) rename to create_umrah_group_booking_before_public;
revoke all on function public.create_umrah_group_booking_before_public(uuid,integer,smallint,text,jsonb,uuid) from public,anon,authenticated;
create function public.create_umrah_group_booking(p_departure_id uuid,p_num_pilgrims integer,p_room_sharing smallint,
  p_special_requests text,p_pilgrims jsonb,p_agency_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare pkg public.umrah_packages;
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;
  perform public.release_public_umrah_checkouts();
  select p.* into pkg from public.umrah_packages p join public.umrah_package_departures d on d.package_id=p.id
    where d.id=p_departure_id for share of p;
  perform 1 from public.umrah_package_departures where id=p_departure_id for update;
  if pkg.package_type='group' and not pkg.public_setup_complete then raise exception 'This package is not ready for booking.'; end if;
  if p_num_pilgrims is null or p_num_pilgrims not between 1 and 60 then raise exception 'Choose 1 to 60 pilgrims.'; end if;
  return public.create_umrah_group_booking_before_public(p_departure_id,p_num_pilgrims,p_room_sharing,p_special_requests,p_pilgrims,p_agency_id);
end $$;
revoke all on function public.create_umrah_group_booking(uuid,integer,smallint,text,jsonb,uuid) from public,anon;
grant execute on function public.create_umrah_group_booking(uuid,integer,smallint,text,jsonb,uuid) to authenticated;

-- Existing item/total triggers consume these terms for every payment method.
CREATE OR REPLACE FUNCTION public._umrah_order_terms(p_order_id uuid, OUT deposit_percent numeric, OUT due_date date)
 RETURNS record
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_kind text;
  v_pkg_pct numeric;
  v_pkg_days smallint;
  v_departure date;
  v_days numeric;
begin
  select b.booking_kind, pkg.deposit_percent, pkg.balance_due_days,
         coalesce(d.departure_date, cr.departure_date)
    into v_kind, v_pkg_pct, v_pkg_days, v_departure
    from public.order_items oi
    join public.umrah_bookings b on b.id = oi.umrah_booking_id
    left join public.umrah_packages pkg on pkg.id = b.package_id
    left join public.umrah_package_departures d on d.id = b.departure_id
    left join public.umrah_custom_requests cr on cr.id = b.custom_request_id
   where oi.order_id = p_order_id
   limit 1;
  if v_kind is null then
    return;
  end if;

  if v_kind = 'group' then
    deposit_percent := 100;
    due_date := current_date;
    return;
  else
    begin
      deposit_percent := (public.umrah_setting('privateDepositPercent'))::text::numeric;
      v_days := (public.umrah_setting('privateBalanceDueDays'))::text::numeric;
    exception when others then
      deposit_percent := null;
      v_days := null;
    end;
    v_days := coalesce(v_days, 30);
  end if;

  if deposit_percent is not null and (deposit_percent < 0 or deposit_percent > 100) then
    deposit_percent := null;
  end if;
  if v_departure is not null then
    due_date := v_departure - v_days::int;
  end if;
  -- Booked inside the balance window: the full amount is due now (100%, not
  -- null — null means the platform-wide deposit) and no due date in the past.
  if due_date is not null and due_date <= current_date then
    deposit_percent := 100;
    due_date := current_date;
  end if;
end;
$function$;
create function public.guard_public_umrah_payment()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_total numeric; v_paid numeric;
begin
  if exists(select 1 from public.order_items oi join public.umrah_bookings b on b.id=oi.umrah_booking_id
    where oi.order_id=new.order_id and b.booking_kind='group') then
    -- Lock the order before checking expiry or accepting a receipt, serialising
    -- payment against the expiry sweep and concurrent payment attempts.
    select total into v_total from public.orders where id=new.order_id for update;
    if exists(select 1 from public.orders where id=new.order_id and status in ('pending_payment','held') and created_at<now()-interval '30 minutes')
      and not exists(select 1 from public.payments p where p.order_id=new.order_id and
        (p.status in ('succeeded','requires_action') or (p.status='processing' and p.created_at>now()-interval '2 hours'))) then
      raise exception 'This checkout has expired. Choose an available departure.';
    end if;
    if exists(select 1 from public.orders where id=new.order_id and status in ('cancelled','refunded')) then
      raise exception 'This checkout has expired or been cancelled.';
    end if;
    select coalesce(sum(amount),0) into v_paid from public.payments where order_id=new.order_id and status='succeeded';
    if new.amount < v_total-v_paid-0.01 then raise exception 'Public Umrah requires full payment.'; end if;
  end if;
  return new;
end $$;
create trigger aa_guard_public_umrah_payment before insert on public.payments
for each row execute function public.guard_public_umrah_payment();

create or replace function public.umrah_confirm_group_bookings_on_payment()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if new.status<>'paid' or old.status=new.status then return new; end if;
  for v_id in select b.id from public.order_items oi join public.umrah_bookings b on b.id=oi.umrah_booking_id
    where oi.order_id=new.id and b.booking_kind='group' and b.fulfillment_stage='booked' and b.status='pending'
  loop
    perform public.apply_umrah_stage_transition_internal(v_id,'confirmed',null,'Full payment received');
  end loop;
  return new;
end $$;

create function public.guard_public_umrah_confirmation()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.booking_kind='group' and new.status in ('pending','confirmed','completed','no_show') and (new.status='confirmed' or new.fulfillment_stage>='confirmed')
     and (new.status is distinct from old.status or new.fulfillment_stage is distinct from old.fulfillment_stage)
     and not exists(select 1 from public.order_items oi join public.orders o on o.id=oi.order_id
       where oi.umrah_booking_id=new.id and o.status in ('paid','processing','completed')) then
    raise exception 'Public Umrah requires full payment before confirmation.';
  end if;
  return new;
end $$;
create trigger guard_public_umrah_confirmation before update of status,fulfillment_stage on public.umrah_bookings
for each row execute function public.guard_public_umrah_confirmation();

-- Public packages are revalidated by staff before relisting; existing bookings stay intact.
-- No private package, payment schedule, booking or personal data is changed.

create function public.admin_public_umrah_pool()
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  perform public.release_public_umrah_checkouts();
  select coalesce(jsonb_agg(row_to_json(pool) order by pool.departure_date,pool.name),'[]'::jsonb) into result from (
    select p.id as package_id,p.name,p.status as package_status,p.contact_person_name,p.contact_person_phone,
      d.id as departure_id,d.departure_date,d.return_date,d.status as departure_status,d.total_seats,
      d.booked_seats,d.offline_seats,greatest(d.total_seats-d.booked_seats-d.offline_seats,0) as available_seats,
      coalesce((select sum(b.num_pilgrims) from public.umrah_bookings b where b.departure_id=d.id
        and b.booking_kind='group' and b.status in ('confirmed','completed','no_show')),0) as confirmed_seats,
      coalesce((select sum(b.num_pilgrims) from public.umrah_bookings b where b.departure_id=d.id
        and b.booking_kind='group' and b.status='pending'),0) as held_seats,
      (select count(*) from public.umrah_bookings b where b.departure_id=d.id and b.booking_kind='group'
        and b.status in ('pending','confirmed','completed','no_show')) as bookings,
      (select count(distinct coalesce(o.agency_customer_id,b.customer_id)) from public.umrah_bookings b
        left join public.order_items oi on oi.umrah_booking_id=b.id left join public.orders o on o.id=oi.order_id
        where b.departure_id=d.id and b.booking_kind='group' and b.status in ('pending','confirmed','completed','no_show')) as customers
    from public.umrah_packages p left join public.umrah_package_departures d on d.package_id=p.id
    where p.package_type='group'
  ) pool;
  return result;
end $$;
revoke all on function public.admin_public_umrah_pool() from public,anon;
grant execute on function public.admin_public_umrah_pool() to authenticated;

-- Close direct customer writes that could supply an arbitrary public fare/status.
drop policy if exists "umrah_bookings: customer creates own booking" on public.umrah_bookings;
create policy "umrah_bookings: customer creates own booking" on public.umrah_bookings for insert to authenticated
with check (booking_kind='private' and booked_by=auth.uid() and
  (customer_id=auth.uid() or (agency_id is not null and public.is_agency_member(agency_id))));

create function public.validate_public_umrah_rate()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.price<=0 and exists(select 1 from public.umrah_packages p where p.id=new.package_id and p.package_type='group') then
    raise exception 'Public Umrah rates must be greater than zero.';
  end if;
  return new;
end $$;
create trigger validate_public_umrah_rate before insert or update of price,package_id on public.umrah_package_pricing
for each row execute function public.validate_public_umrah_rate();
