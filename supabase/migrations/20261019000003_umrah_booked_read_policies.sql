-- People who booked a package keep seeing it after it is unpublished.
--
-- Departures, hotels and itinerary days were readable by non-admins only while
-- the package was published, so setting a sold-out or finished package to
-- draft made the departure embed come back null on the customer page, the
-- agent page and the voucher: the flights disappeared for pilgrims who had
-- already paid.
--
-- The booked set is built once per statement (same shape as
-- 20261018000005's my_*_ids helpers): bookings the user is the customer or
-- booker of, plus bookings of agencies the user is an active member of.

create or replace function public.my_umrah_package_ids()
returns uuid[] language sql stable security definer set search_path to 'public' as $$
  select coalesce(array_agg(distinct b.package_id), '{}')
    from public.umrah_bookings b
   where b.package_id is not null
     and (b.customer_id = auth.uid()
          or b.booked_by = auth.uid()
          or b.agency_id = any (public.my_agency_ids()));
$$;

create or replace function public.my_umrah_departure_ids()
returns uuid[] language sql stable security definer set search_path to 'public' as $$
  select coalesce(array_agg(distinct b.departure_id), '{}')
    from public.umrah_bookings b
   where b.departure_id is not null
     and (b.customer_id = auth.uid()
          or b.booked_by = auth.uid()
          or b.agency_id = any (public.my_agency_ids()));
$$;

revoke execute on function public.my_umrah_package_ids() from public, anon;
revoke execute on function public.my_umrah_departure_ids() from public, anon;
grant execute on function public.my_umrah_package_ids() to authenticated;
grant execute on function public.my_umrah_departure_ids() to authenticated;

drop policy if exists "umrah_packages: booked customers read" on public.umrah_packages;
create policy "umrah_packages: booked customers read"
  on public.umrah_packages for select to authenticated
  using (id = any ((select public.my_umrah_package_ids())::uuid[]));

drop policy if exists "umrah_departures: booked customers read" on public.umrah_package_departures;
create policy "umrah_departures: booked customers read"
  on public.umrah_package_departures for select to authenticated
  using (id = any ((select public.my_umrah_departure_ids())::uuid[]));

drop policy if exists "umrah_package_hotels: booked customers read" on public.umrah_package_hotels;
create policy "umrah_package_hotels: booked customers read"
  on public.umrah_package_hotels for select to authenticated
  using (package_id = any ((select public.my_umrah_package_ids())::uuid[]));

drop policy if exists "umrah_itinerary_days: booked customers read" on public.umrah_itinerary_days;
create policy "umrah_itinerary_days: booked customers read"
  on public.umrah_itinerary_days for select to authenticated
  using (package_id = any ((select public.my_umrah_package_ids())::uuid[]));
