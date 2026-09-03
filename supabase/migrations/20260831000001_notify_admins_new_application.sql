-- ============================================================================
-- Admins were never told when a new partner application came in. The bell
-- already covers "a document was re-uploaded" (20260823000001) and
-- "new order" (20260815000002, notify_admins_new_order) via the same
-- fan-out-to-every-admin-profile shape, but nothing fired when
-- submitApplication() flips an application from draft/more_info_requested
-- to 'pending' — the sidebar badge (admin_nav_counts) picked it up, the bell
-- never did. Confirmed against a real submission (agency_applications
-- STS-TA-2026-000004) that had zero matching notifications rows.
-- ============================================================================

create or replace function public.notify_admins_new_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := tg_argv[0];
  v_label text := case tg_argv[0]
    when 'agency' then 'Travel Agent'
    when 'hotel_partner' then 'Hotel Partner'
    when 'venue_partner' then 'Event Venue Partner'
    when 'affiliate' then 'Affiliate'
  end;
begin
  if new.status = 'pending' and (old.status is distinct from new.status) then
    insert into public.notifications (profile_id, type, title, body, data)
    select p.id,
           'application_submitted',
           'New ' || v_label || ' application',
           coalesce(new.reference_number, (case when v_label = 'Affiliate' or v_label = 'Event Venue Partner' then 'An ' else 'A ' end) || v_label || ' application') || ' is waiting for review.',
           jsonb_build_object('applicationType', v_kind, 'applicationId', new.id, 'referenceNumber', new.reference_number)
    from public.profiles p
    where p.is_platform_admin;
  end if;
  return new;
end;
$$;

create trigger agency_applications_notify_admins_new_application
  after update on public.agency_applications
  for each row execute function public.notify_admins_new_application('agency');

create trigger hotel_partner_applications_notify_admins_new_application
  after update on public.hotel_partner_applications
  for each row execute function public.notify_admins_new_application('hotel_partner');

create trigger venue_partner_applications_notify_admins_new_application
  after update on public.venue_partner_applications
  for each row execute function public.notify_admins_new_application('venue_partner');

create trigger affiliate_applications_notify_admins_new_application
  after update on public.affiliate_applications
  for each row execute function public.notify_admins_new_application('affiliate');

-- Backfill: Sourajit Mitra's Travel Agent application (and anything else
-- already sitting in 'pending' with zero notification trail) would
-- otherwise stay invisible to admins forever — the trigger above only
-- fires on future status transitions.
insert into public.notifications (profile_id, type, title, body, data)
select p.id,
       'application_submitted',
       'New Travel Agent application',
       coalesce(a.reference_number, 'A Travel Agent application') || ' is waiting for review.',
       jsonb_build_object('applicationType', 'agency', 'applicationId', a.id, 'referenceNumber', a.reference_number)
from public.agency_applications a
cross join public.profiles p
where a.status = 'pending'
  and p.is_platform_admin
  and not exists (
    select 1 from public.notifications n
    where n.type = 'application_submitted' and (n.data->>'applicationId')::uuid = a.id
  );

insert into public.notifications (profile_id, type, title, body, data)
select p.id,
       'application_submitted',
       'New Hotel Partner application',
       coalesce(a.reference_number, 'A Hotel Partner application') || ' is waiting for review.',
       jsonb_build_object('applicationType', 'hotel_partner', 'applicationId', a.id, 'referenceNumber', a.reference_number)
from public.hotel_partner_applications a
cross join public.profiles p
where a.status = 'pending'
  and p.is_platform_admin
  and not exists (
    select 1 from public.notifications n
    where n.type = 'application_submitted' and (n.data->>'applicationId')::uuid = a.id
  );

insert into public.notifications (profile_id, type, title, body, data)
select p.id,
       'application_submitted',
       'New Event Venue Partner application',
       coalesce(a.reference_number, 'An Event Venue Partner application') || ' is waiting for review.',
       jsonb_build_object('applicationType', 'venue_partner', 'applicationId', a.id, 'referenceNumber', a.reference_number)
from public.venue_partner_applications a
cross join public.profiles p
where a.status = 'pending'
  and p.is_platform_admin
  and not exists (
    select 1 from public.notifications n
    where n.type = 'application_submitted' and (n.data->>'applicationId')::uuid = a.id
  );

insert into public.notifications (profile_id, type, title, body, data)
select p.id,
       'application_submitted',
       'New Affiliate application',
       coalesce(a.reference_number, 'An Affiliate application') || ' is waiting for review.',
       jsonb_build_object('applicationType', 'affiliate', 'applicationId', a.id, 'referenceNumber', a.reference_number)
from public.affiliate_applications a
cross join public.profiles p
where a.status = 'pending'
  and p.is_platform_admin
  and not exists (
    select 1 from public.notifications n
    where n.type = 'application_submitted' and (n.data->>'applicationId')::uuid = a.id
  );
