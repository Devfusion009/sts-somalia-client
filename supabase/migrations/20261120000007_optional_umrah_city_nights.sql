-- City night counts are no longer required by the package setup form.
create or replace function public.validate_public_umrah_package()
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
    and ((new.nights_makkah is null and new.nights_madinah is null)
      or (coalesce(new.nights_makkah,0) >= 0 and coalesce(new.nights_madinah,0) >= 0
        and coalesce(new.nights_makkah,0) + coalesce(new.nights_madinah,0) between 1 and new.duration_days - 1));
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
