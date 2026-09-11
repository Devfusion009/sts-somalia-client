-- Processing routing + the manual embassy workspace.
--
-- Every visa application STS processes today is processed manually — a staff
-- member lodges it with an embassy, a consulate, or an authorised channel
-- (VFS Global, a courier, in person). None of that is recorded anywhere: not
-- which authority, not a lodgement reference, not an appointment date. It
-- lives in people's heads and WhatsApp threads. The only "manual" thing that
-- existed before this migration was partner/adapters/manual.ts, which faked a
-- partner reference and did nothing else.
--
-- This adds one job record per submission attempt (an application can be
-- re-lodged after coming back for more documents), a route-resolution
-- function that is the single place "partner or manual" is decided, and a
-- gate requiring the manual workspace's lodgement fields before an
-- application can claim to be 'processing'. The partner half of the route
-- (submitting to a real external API) stays exactly as it was — that is M4's
-- job — this milestone only owns the manual half and the routing seam
-- between them.

-- ----------------------------------------------------------------------------
-- 1) One processing attempt per row. Partner columns are included now, unused
--    by this milestone, so M4 does not need a second migration to add them —
--    the existing adminSubmitToPartner/adminSyncPartnerStatus actions
--    continue writing partner_ref/partner_status directly onto
--    visa_applications for now; migrating them onto this table is M4's call.
-- ----------------------------------------------------------------------------
create table public.visa_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.visa_applications (id) on delete cascade,
  route text not null check (route in ('manual', 'partner')),
  provider_key text,
  status text not null default 'active' check (status in ('active', 'completed', 'failed', 'superseded')),
  -- Manual route
  lodged_with text,
  lodgement_reference text,
  lodgement_date date,
  appointment_date date,
  -- Partner route (reserved for M4)
  partner_ref text,
  partner_status text,
  partner_raw_payload jsonb,
  partner_last_synced_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index visa_processing_jobs_application_id_idx on public.visa_processing_jobs (application_id);

-- One live attempt at a time; re-lodging supersedes the previous attempt
-- rather than leaving two "active" rows to disagree about.
create unique index visa_processing_jobs_one_active_per_application
  on public.visa_processing_jobs (application_id)
  where status = 'active';

alter table public.visa_processing_jobs enable row level security;

create policy "visa_processing_jobs: admin manage" on public.visa_processing_jobs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Staff-internal log of what happened while chasing an application — a
-- courier delay, a call to the consulate, an appointment reschedule. Kept
-- separate from visa_application_status_history, which is customer-facing
-- decision history, not an operational diary.
create table public.visa_processing_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.visa_applications (id) on delete cascade,
  note text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index visa_processing_notes_application_id_idx on public.visa_processing_notes (application_id);

alter table public.visa_processing_notes enable row level security;

create policy "visa_processing_notes: admin manage" on public.visa_processing_notes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2) Route resolution — the one place "partner or manual" is decided. Called
--    by the guard trigger below (native SQL) and by the admin UI (via RPC),
--    so the two can never disagree about which workspace an application
--    belongs in. A visa type in 'partner' mode with no real provider key
--    configured (partner_provider_key is null or the 'manual' placeholder
--    the catalog editor defaults to) falls back to manual — the same
--    "manual is always available" convention the payments registry uses for
--    bank transfer / cash.
-- ----------------------------------------------------------------------------
create or replace function public.resolve_visa_processing_route(p_visa_type_id uuid)
returns table (route text, provider_key text)
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when vt.processing_mode = 'partner'
        and vt.partner_provider_key is not null
        and vt.partner_provider_key <> 'manual'
      then 'partner'
      else 'manual'
    end,
    case
      when vt.processing_mode = 'partner'
        and vt.partner_provider_key is not null
        and vt.partner_provider_key <> 'manual'
      then vt.partner_provider_key
      else null
    end
  from public.visa_types vt
  where vt.id = p_visa_type_id;
$$;

-- ----------------------------------------------------------------------------
-- 3) Entering 'processing' is a claim that the application was actually
--    lodged. For the manual route that means an active job with a lodgement
--    reference exists; for the partner route this milestone adds no
--    additional gate (M4 owns hardening that half — see module V4 split in
--    the build spec).
-- ----------------------------------------------------------------------------
create or replace function public.guard_visa_processing_requires_job()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_route text;
begin
  if new.status = 'processing' and old.status is distinct from new.status then
    select route into v_route from public.resolve_visa_processing_route(new.visa_type_id);
    if v_route = 'manual' and not exists (
      select 1 from public.visa_processing_jobs
       where application_id = new.id
         and status = 'active'
         and route = 'manual'
         and nullif(btrim(lodged_with), '') is not null
         and nullif(btrim(lodgement_reference), '') is not null
    ) then
      raise exception 'record who this application was lodged with and its reference before moving it to processing';
    end if;
  end if;
  return new;
end;
$$;

create trigger visa_applications_guard_processing_requires_job
  before update of status on public.visa_applications
  for each row execute function public.guard_visa_processing_requires_job();

-- ----------------------------------------------------------------------------
-- 4) A terminal decision closes out whichever attempt got the application
--    there — cancelling included, so a stale "active" job doesn't linger
--    forever on a cancelled application.
-- ----------------------------------------------------------------------------
create or replace function public.close_visa_processing_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('approved', 'rejected', 'issued', 'cancelled')
     and old.status is distinct from new.status then
    update public.visa_processing_jobs
       set status = 'completed', completed_at = now()
     where application_id = new.id and status = 'active';
  end if;
  return new;
end;
$$;

create trigger visa_applications_close_processing_job
  after update of status on public.visa_applications
  for each row execute function public.close_visa_processing_job();
