-- Applicant consent at submit.
--
-- STS files visa applications by hand on government portals and at visa
-- centres, using the applicant's data. Before a case is submitted the
-- applicant (or the agent, for a desk booking) authorises STS to apply on
-- their behalf and accepts the refund policy. Stamped server-side with who
-- and when; an application cannot leave draft without it.

alter table public.visa_applications
  add column consent_at timestamptz,
  add column consent_by uuid references public.profiles (id),
  add column consent_version text;

comment on column public.visa_applications.consent_version is
  'Version of the authorisation and refund-policy wording the applicant accepted.';

/** Records consent on the caller's own draft. */
create or replace function public.visa_give_consent(p_application_id uuid, p_version text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.visa_applications;
begin
  select * into app from public.visa_applications where id = p_application_id for update;
  if not found or app.submitted_by is distinct from auth.uid() then
    raise exception 'visa application not found';
  end if;
  if app.status <> 'draft' then
    raise exception 'this application was already submitted';
  end if;
  if nullif(btrim(coalesce(p_version, '')), '') is null then
    raise exception 'consent version missing';
  end if;

  perform set_config('sts.visa_rpc', app.id::text, true);
  update public.visa_applications
     set consent_at = now(), consent_by = auth.uid(), consent_version = btrim(p_version)
   where id = app.id;
  perform set_config('sts.visa_rpc', '', true);
end;
$$;

revoke execute on function public.visa_give_consent(uuid, text) from public, anon;
grant execute on function public.visa_give_consent(uuid, text) to authenticated;

/** Consent fields are written by visa_give_consent() only; submit needs them. */
create or replace function public.guard_visa_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._visa_trusted_writer(new.id) then
    if tg_op = 'INSERT' then
      new.consent_at := null;
      new.consent_by := null;
      new.consent_version := null;
    elsif new.consent_at is distinct from old.consent_at
       or new.consent_by is distinct from old.consent_by
       or new.consent_version is distinct from old.consent_version then
      raise exception 'consent is recorded through visa_give_consent()';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.status = 'draft' and new.status = 'submitted' and new.consent_at is null then
    raise exception 'the applicant must authorise STS before submitting';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_visa_consent() from public, anon, authenticated;

create trigger visa_applications_consent_guard
  before insert or update on public.visa_applications
  for each row execute function public.guard_visa_consent();
