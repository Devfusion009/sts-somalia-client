-- ============================================================================
-- notify_admins_new_application() (20260831000001/2) told admins an
-- application arrived, but told the applicant nothing in-app — the only
-- confirmation was a best-effort email (notifyApplicant in
-- lib/notifications/application-notify.ts), invisible today since
-- Resend/Twilio aren't configured. The applicant's own "under review" state
-- is only ever visible by revisiting /account/become; the bell stayed
-- "You're all caught up." forever. Renamed to notify_on_application_submitted
-- since it now does two fan-outs, not one — admins, and the applicant.
-- ============================================================================

drop trigger agency_applications_notify_admins_new_application on public.agency_applications;
drop trigger hotel_partner_applications_notify_admins_new_application on public.hotel_partner_applications;
drop trigger venue_partner_applications_notify_admins_new_application on public.venue_partner_applications;
drop trigger affiliate_applications_notify_admins_new_application on public.affiliate_applications;
drop function public.notify_admins_new_application();

create function public.notify_on_application_submitted()
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
  v_article text := case when v_label in ('Affiliate', 'Event Venue Partner') then 'an' else 'a' end;
  v_business_name text := case tg_argv[0]
    when 'agency' then to_jsonb(new)->>'agency_name'
    when 'hotel_partner' then to_jsonb(new)->>'business_name'
    when 'venue_partner' then to_jsonb(new)->>'business_name'
  end;
  v_applicant_name text;
  v_who text;
  v_ref_suffix text;
begin
  if new.status = 'pending' and (old.status is distinct from new.status) then
    select p.full_name into v_applicant_name from public.profiles p where p.id = new.applicant_id;
    v_who := coalesce(nullif(v_applicant_name, ''), 'An applicant');
    v_ref_suffix := case when new.reference_number is not null then ' — ' || new.reference_number else '' end;

    -- Fan out to admins: who applied, and to what.
    insert into public.notifications (profile_id, type, title, body, data)
    select p.id,
           'application_submitted',
           'New ' || v_label || ' application',
           v_who
             || case when v_business_name is not null and v_business_name <> '' then ' (' || v_business_name || ')' else '' end
             || ' applied to become ' || v_article || ' ' || v_label || v_ref_suffix || '.',
           jsonb_build_object(
             'applicationType', v_kind,
             'applicationId', new.id,
             'referenceNumber', new.reference_number,
             'applicantName', v_applicant_name,
             'businessName', v_business_name
           )
    from public.profiles p
    where p.is_platform_admin;

    -- Confirm to the applicant themselves: what they applied for.
    insert into public.notifications (profile_id, type, title, body, data)
    values (
      new.applicant_id,
      'application_submitted_confirmation',
      'Application submitted',
      'You applied to become ' || v_article || ' ' || v_label || v_ref_suffix || '. It''s under review — we''ll notify you here once it''s decided.',
      jsonb_build_object('applicationType', v_kind, 'applicationId', new.id, 'referenceNumber', new.reference_number)
    );
  end if;
  return new;
end;
$$;

create trigger agency_applications_notify_on_submitted
  after update on public.agency_applications
  for each row execute function public.notify_on_application_submitted('agency');

create trigger hotel_partner_applications_notify_on_submitted
  after update on public.hotel_partner_applications
  for each row execute function public.notify_on_application_submitted('hotel_partner');

create trigger venue_partner_applications_notify_on_submitted
  after update on public.venue_partner_applications
  for each row execute function public.notify_on_application_submitted('venue_partner');

create trigger affiliate_applications_notify_on_submitted
  after update on public.affiliate_applications
  for each row execute function public.notify_on_application_submitted('affiliate');

-- Backfill: Sourajit Mitra's already-submitted Travel Agent application (and
-- anything else sitting in 'pending' that predates this trigger) gets the
-- confirmation now instead of never.
insert into public.notifications (profile_id, type, title, body, data)
select a.applicant_id,
       'application_submitted_confirmation',
       'Application submitted',
       'You applied to become a Travel Agent — ' || a.reference_number || '. It''s under review — we''ll notify you here once it''s decided.',
       jsonb_build_object('applicationType', 'agency', 'applicationId', a.id, 'referenceNumber', a.reference_number)
from public.agency_applications a
where a.status = 'pending'
  and not exists (
    select 1 from public.notifications n
    where n.type = 'application_submitted_confirmation' and (n.data->>'applicationId')::uuid = a.id
  );

insert into public.notifications (profile_id, type, title, body, data)
select a.applicant_id,
       'application_submitted_confirmation',
       'Application submitted',
       'You applied to become a Hotel Partner — ' || a.reference_number || '. It''s under review — we''ll notify you here once it''s decided.',
       jsonb_build_object('applicationType', 'hotel_partner', 'applicationId', a.id, 'referenceNumber', a.reference_number)
from public.hotel_partner_applications a
where a.status = 'pending'
  and not exists (
    select 1 from public.notifications n
    where n.type = 'application_submitted_confirmation' and (n.data->>'applicationId')::uuid = a.id
  );

insert into public.notifications (profile_id, type, title, body, data)
select a.applicant_id,
       'application_submitted_confirmation',
       'Application submitted',
       'You applied to become an Event Venue Partner — ' || a.reference_number || '. It''s under review — we''ll notify you here once it''s decided.',
       jsonb_build_object('applicationType', 'venue_partner', 'applicationId', a.id, 'referenceNumber', a.reference_number)
from public.venue_partner_applications a
where a.status = 'pending'
  and not exists (
    select 1 from public.notifications n
    where n.type = 'application_submitted_confirmation' and (n.data->>'applicationId')::uuid = a.id
  );

insert into public.notifications (profile_id, type, title, body, data)
select a.applicant_id,
       'application_submitted_confirmation',
       'Application submitted',
       'You applied to become an Affiliate — ' || a.reference_number || '. It''s under review — we''ll notify you here once it''s decided.',
       jsonb_build_object('applicationType', 'affiliate', 'applicationId', a.id, 'referenceNumber', a.reference_number)
from public.affiliate_applications a
where a.status = 'pending'
  and not exists (
    select 1 from public.notifications n
    where n.type = 'application_submitted_confirmation' and (n.data->>'applicationId')::uuid = a.id
  );
