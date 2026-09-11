-- Partner contract hardening + real status sync.
--
-- Two problems this closes. First, a partner's status was stored as opaque
-- text (visa_applications.partner_status) and never mapped onto our own
-- status — a partner-driven decision produced no history row, no
-- notification, nothing a customer could see. Second, the M3 processing gate
-- only recognised the manual route: a visa type configured for partner
-- processing had no way to fall back to manual if the partner submission
-- failed, because the gate checked visa_processing_jobs for a manual job
-- specifically, keyed off the visa TYPE's configured route rather than what
-- actually happened on this application.

alter table public.visa_processing_jobs
  add column failure_reason text;

-- ----------------------------------------------------------------------------
-- The gate no longer asks "does this application's configured route have a
-- job" — it asks "was this application actually lodged, by any route". A
-- partner-configured visa type whose submission failed can still be lodged
-- manually as a one-off; a manual visa type is unaffected. resolve_visa_
-- processing_route still decides which workspace the admin UI shows by
-- default — this only changes what the database is willing to accept.
-- ----------------------------------------------------------------------------
create or replace function public.guard_visa_processing_requires_job()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'processing' and old.status is distinct from new.status then
    if not exists (
      select 1 from public.visa_processing_jobs
       where application_id = new.id
         and status = 'active'
         and (
           (route = 'manual'
              and nullif(btrim(lodged_with), '') is not null
              and nullif(btrim(lodgement_reference), '') is not null)
           or (route = 'partner' and nullif(btrim(partner_ref), '') is not null)
         )
    ) then
      raise exception
        'this application has no recorded lodgement — submit it to a partner or lodge it manually before moving it to processing';
    end if;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- A partner-driven status change has no human to authorize it — the HMAC
-- signature on the webhook request is the authorization, verified before
-- this is ever called. set_visa_application_status stays the human-initiated
-- door (admin session, or the applicant submitting their own draft); this is
-- its system-initiated counterpart, revoked from every role except
-- service_role so only the webhook route (createAdminClient()) can reach it.
-- ----------------------------------------------------------------------------
create or replace function public.apply_visa_partner_status_update(
  p_application_id uuid,
  p_status public.visa_status,
  p_note text default null
)
returns public.visa_status
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.apply_visa_status_transition_internal(p_application_id, p_status, null, p_note);
end;
$$;

revoke execute on function public.apply_visa_partner_status_update(uuid, public.visa_status, text)
  from anon, authenticated;
