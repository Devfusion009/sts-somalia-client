-- Private/custom Umrah is arranged outside this application. Keep historical
-- requests, service lines and bookings readable for receipts and audit records;
-- prohibit new private inventory and requests at the database boundary.
create or replace function public.reject_new_private_umrah()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Private Umrah is arranged directly with STS.';
end;
$$;

create trigger reject_new_private_umrah_requests
before insert on public.umrah_custom_requests
for each row execute function public.reject_new_private_umrah();

create trigger reject_new_private_umrah_services
before insert on public.umrah_custom_request_services
for each row execute function public.reject_new_private_umrah();

create trigger reject_new_private_umrah_bookings
before insert on public.umrah_bookings
for each row when (new.booking_kind = 'private')
execute function public.reject_new_private_umrah();

create trigger reject_new_private_umrah_packages
before insert or update of package_type on public.umrah_packages
for each row when (new.package_type = 'private')
execute function public.reject_new_private_umrah();

-- Legacy private packages no longer appear in the public catalogue. Existing
-- orders are preserved; this migration deliberately does not erase financial
-- or passenger history.
update public.umrah_packages set status = 'draft'
where package_type = 'private' and status = 'published';

-- The former orphan cleanup deletes a custom request when a legacy booking
-- is removed. Archived request rows must survive for audit and receipts.
drop trigger if exists cleanup_private_package_orphan on public.umrah_bookings;
drop function if exists public.cleanup_private_package_orphan();

-- Retired builder records and prices are archival. Keep SELECT policies for
-- existing receipts, but close all mutation paths, including security-definer
-- functions that bypass ordinary table grants.
create trigger reject_retired_private_request_changes
before update or delete on public.umrah_custom_requests
for each row execute function public.reject_new_private_umrah();

create trigger reject_retired_private_service_changes
before update or delete on public.umrah_custom_request_services
for each row execute function public.reject_new_private_umrah();

create trigger reject_retired_private_catalog_changes
before insert or update or delete on public.umrah_services
for each row execute function public.reject_new_private_umrah();

create trigger reject_retired_private_package_changes
before update or delete on public.umrah_packages
for each row when (old.package_type = 'private')
execute function public.reject_new_private_umrah();

revoke insert, update, delete on public.umrah_custom_requests,
  public.umrah_custom_request_services, public.umrah_services
from anon, authenticated;
