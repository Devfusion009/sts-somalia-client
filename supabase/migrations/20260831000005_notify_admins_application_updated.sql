-- ============================================================================
-- An applicant editing an already-pending application (e.g. adding a logo,
-- fixing a field) and clicking "Submit Application" again produces total
-- silence for admins: submitApplication() deliberately keeps status =
-- 'pending' and preserves the original submitted_at/reference_number for an
-- already-pending/under_review row (see the comment above that update in
-- actions.ts), so the notify_on_application_submitted trigger's status-
-- transition check (old.status IS DISTINCT FROM new.status) never fires —
-- correctly not on every autosave keystroke, but also not on the one
-- explicit "I'm done, look again" signal the applicant actually gave.
--
-- A callable RPC instead of a wider trigger condition, deliberately: it's
-- invoked once, from submitApplication itself, only when the application
-- was already pending/under_review before this call — never from the
-- autosave path, which never calls submitApplication at all.
-- ============================================================================

create function public.notify_admins_application_updated(p_kind text, p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text := public.partner_application_table(p_kind);
  v_label text := case p_kind
    when 'agency' then 'Travel Agent'
    when 'hotel_partner' then 'Hotel Partner'
    when 'venue_partner' then 'Event Venue Partner'
    when 'affiliate' then 'Affiliate'
  end;
  v_applicant uuid;
  v_reference text;
begin
  if v_table is null then
    raise exception 'unsupported application kind: %', p_kind;
  end if;

  execute format('select applicant_id, reference_number from public.%I where id = $1', v_table)
    into v_applicant, v_reference using p_application_id;

  if v_applicant is null or v_applicant <> auth.uid() then
    raise exception 'application not found or not owned';
  end if;

  insert into public.notifications (profile_id, type, title, body, data)
  select p.id,
         'application_updated',
         'Application updated',
         'The applicant updated their ' || v_label || ' application'
           || case when v_reference is not null then ' (' || v_reference || ')' else '' end
           || '. It is waiting for review again.',
         jsonb_build_object('applicationType', p_kind, 'applicationId', p_application_id, 'referenceNumber', v_reference)
  from public.profiles p
  where p.is_platform_admin;
end;
$$;
