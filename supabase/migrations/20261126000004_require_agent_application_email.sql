-- Drafts may be incomplete; submission requires both application email fields.
create function public.require_agent_application_email()
returns trigger language plpgsql set search_path=public as $$
declare field_name text; address text;
begin
 if new.status::text in ('pending','under_review') then
  foreach field_name in array array['contactEmail','businessEmail'] loop
   address:=btrim(coalesce(new.business_details->>field_name,''));
   if length(address)>254 or address !~ '^[^[:space:]@]+@[^[:space:]@.]+(\.[^[:space:]@.]+)+$' then
    raise exception using errcode='23514', message=case when field_name='contactEmail'
     then 'Enter a valid authorized contact email before submitting.'
     else 'Enter a valid business email before submitting.' end;
   end if;
  end loop;
 end if;
 return new;
end $$;

create trigger require_agent_application_email
before insert or update of status,business_details on public.agency_applications
for each row execute function public.require_agent_application_email();
