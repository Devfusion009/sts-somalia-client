-- Flight quote requests never reach the orders ledger until staff price
-- them, so notify_admins_new_order never fired for them and nothing told
-- staff a traveller was waiting. Alert every platform admin on insert.

create or replace function public.notify_admins_flight_quote_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.provider <> 'quote_request' then
    return new;
  end if;
  insert into public.notifications (profile_id, type, title, body, data)
  select p.id,
         'flight_quote_request',
         'Flight request ' || new.origin_iata || ' → ' || new.destination_iata,
         to_char(new.depart_at at time zone 'UTC', 'FMDD Mon YYYY')
           || case when new.return_at is not null
                   then ' – ' || to_char(new.return_at at time zone 'UTC', 'FMDD Mon YYYY')
                   else ' · one way' end
           || ' · ' || coalesce((new.raw_payload ->> 'passengers'), '1') || ' pax',
         jsonb_build_object('flight_booking_id', new.id)
    from public.profiles p
   where p.is_platform_admin;
  return new;
end;
$$;

drop trigger if exists flight_bookings_notify_admins_quote on public.flight_bookings;
create trigger flight_bookings_notify_admins_quote
  after insert on public.flight_bookings
  for each row execute function public.notify_admins_flight_quote_request();
