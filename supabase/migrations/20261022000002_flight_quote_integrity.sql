-- Flight quote requests: accept any airport, and stop travellers writing
-- fields only staff should set.
--
-- 1) Any airport. The search form's airport picker covers every airport
--    worldwide, but flight_bookings/flight_offers referenced the 12-row
--    airports table, so a quote for Mogadishu -> London (or any route off
--    that list) failed with a raw foreign-key error shown to the traveller.
--    Nothing joins these columns to airports, so the reference is replaced
--    by a format check.
alter table public.flight_bookings drop constraint if exists flight_bookings_origin_iata_fkey;
alter table public.flight_bookings drop constraint if exists flight_bookings_destination_iata_fkey;
alter table public.flight_offers drop constraint if exists flight_offers_origin_iata_fkey;
alter table public.flight_offers drop constraint if exists flight_offers_destination_iata_fkey;

alter table public.flight_bookings
  add constraint flight_bookings_iata_format
  check (origin_iata ~ '^[A-Z]{3}$' and destination_iata ~ '^[A-Z]{3}$') not valid;
alter table public.flight_offers
  add constraint flight_offers_iata_format
  check (origin_iata ~ '^[A-Z]{3}$' and destination_iata ~ '^[A-Z]{3}$') not valid;

-- 2) A traveller (or agent) creates only an unpriced, pending quote request.
--    The old check covered ownership only, so a direct API call could insert
--    a 'confirmed' booking with any price, provider or airline reference and
--    have it show in the customer's account and the admin calendar.
drop policy if exists "flight_bookings: customer creates own booking" on public.flight_bookings;
create policy "flight_bookings: customer creates own booking"
  on public.flight_bookings for insert to authenticated
  with check (
    booked_by = auth.uid()
    and (customer_id = auth.uid() or (agency_id is not null and public.is_agency_member(agency_id)))
    and status = 'pending'
    and provider = 'quote_request'
    and provider_booking_ref is null
    and total_price = 0
  );

-- 3) While a request is pending its owner may cancel it, and nothing else.
--    RLS can't compare old and new rows, so the update policy's
--    "status in (pending, cancelled)" let the owner rewrite price, route or
--    reference on their own pending row. Staff (is_admin) and the service
--    role are unaffected.
create or replace function public.flight_bookings_owner_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if new.status <> 'cancelled'
     or (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'Only cancelling a pending flight request is allowed.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.flight_bookings_owner_update_guard() from public, anon, authenticated;

drop trigger if exists flight_bookings_owner_update_guard on public.flight_bookings;
create trigger flight_bookings_owner_update_guard
  before update on public.flight_bookings
  for each row execute function public.flight_bookings_owner_update_guard();
