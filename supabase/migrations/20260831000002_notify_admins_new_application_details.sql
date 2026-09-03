-- ============================================================================
-- notify_admins_new_application() (20260831000001) told admins an
-- application arrived but not who it was from — just a reference number.
-- Adds the applicant's name and, where the kind has one, the business name,
-- via to_jsonb(new) so one function can keep serving all four tables even
-- though only agency/hotel_partner/venue_partner have a name column at all.
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
  v_article text := case when v_label in ('Affiliate', 'Event Venue Partner') then 'an' else 'a' end;
  v_business_name text := case tg_argv[0]
    when 'agency' then to_jsonb(new)->>'agency_name'
    when 'hotel_partner' then to_jsonb(new)->>'business_name'
    when 'venue_partner' then to_jsonb(new)->>'business_name'
  end;
  v_applicant_name text;
  v_who text;
  v_body text;
begin
  if new.status = 'pending' and (old.status is distinct from new.status) then
    select p.full_name into v_applicant_name from public.profiles p where p.id = new.applicant_id;
    v_who := coalesce(nullif(v_applicant_name, ''), 'An applicant');
    v_body := v_who
      || case when v_business_name is not null and v_business_name <> '' then ' (' || v_business_name || ')' else '' end
      || ' applied to become ' || v_article || ' ' || v_label
      || case when new.reference_number is not null then ' — ' || new.reference_number else '' end
      || '.';

    insert into public.notifications (profile_id, type, title, body, data)
    select p.id,
           'application_submitted',
           'New ' || v_label || ' application',
           v_body,
           jsonb_build_object(
             'applicationType', v_kind,
             'applicationId', new.id,
             'referenceNumber', new.reference_number,
             'applicantName', v_applicant_name,
             'businessName', v_business_name
           )
    from public.profiles p
    where p.is_platform_admin;
  end if;
  return new;
end;
$$;

-- Bring the two rows the previous migration's backfill already created up to
-- the same richer wording, so Sourajit's application reads the same as any
-- new one going forward instead of staying stuck with the terse original text.
update public.notifications n
set title = 'New Travel Agent application',
    body = coalesce(nullif(p.full_name, ''), 'An applicant')
      || case when a.agency_name is not null and a.agency_name <> '' then ' (' || a.agency_name || ')' else '' end
      || ' applied to become a Travel Agent'
      || case when a.reference_number is not null then ' — ' || a.reference_number else '' end
      || '.',
    data = data || jsonb_build_object('applicantName', p.full_name, 'businessName', a.agency_name)
from public.agency_applications a
join public.profiles p on p.id = a.applicant_id
where n.type = 'application_submitted'
  and (n.data->>'applicationId')::uuid = a.id;
