-- ============================================================================
-- Partner Accounts — the ongoing business relationship created by approving
-- a partner application, as a first-class entity distinct from the
-- application itself.
--
-- Before this migration, "approval" flipped the application's status badge
-- and provisioned the operational entity (agencies / hotel_partners /
-- affiliates), but there was no admin-facing account concept: no lifecycle
-- beyond the entity's raw active/suspended, no per-account audit trail, no
-- onboarding state, and nothing linking the historical application to the
-- live relationship. This adds:
--
--   1. partner_accounts — 1:1 with an approved application. Its PRIMARY KEY
--      is the application's human-readable reference number
--      (STS-HP-2026-000001, ...) — a 1:1 relationship needs no second
--      numbering scheme, and admins already cite these references.
--   2. partner_account_events — append-only audit trail of every status
--      transition and admin action on the account (actor, from/to, reason).
--   3. The three approve_* RPCs are redefined to create the account row +
--      its "account_created" event ATOMICALLY with entity provisioning, so
--      a double-click/retry can never produce a duplicate account (the
--      status guard raises, and unique constraints back that up). They also
--      now accept applications in 'under_review', fixing a live bug: the
--      admin UI offers Approve on under-review rows but the old guards only
--      accepted 'pending', so approving from review always errored.
--   4. Backfill for applications approved before this concept existed.
--
-- Account lifecycle (enforced app-side, recorded here):
--   onboarding -> live (automatic at checklist completion) | suspended | offboarded
--   live       -> suspended | offboarded
--   suspended  -> live (reactivate) | offboarded
--   offboarded -> terminal
-- "rejected" is deliberately NOT a value: only an application can be
-- rejected — no account is ever created for one.
-- ============================================================================

create type public.partner_account_status as enum ('onboarding', 'live', 'suspended', 'offboarded');

create table public.partner_accounts (
  -- The application's reference number (e.g. STS-HP-2026-000001).
  id text primary key,
  type text not null check (type in ('agency', 'hotel_partner', 'affiliate')),
  -- Can't be a real FK (three source tables); uniqueness enforces strict 1:1.
  application_id uuid not null,
  -- agencies.id / hotel_partners.id / affiliates.id per type.
  entity_id uuid not null,
  status public.partner_account_status not null default 'onboarding',
  -- Commercial terms note (commission % itself lives on the entity tables,
  -- which all already carry commission_rate).
  payment_terms text,
  -- Admin-only; never shown to the partner (same precedent as the
  -- applications' internal_notes column).
  internal_notes text,
  went_live_at timestamptz,
  suspended_at timestamptz,
  offboarded_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (type, application_id),
  unique (type, entity_id)
);

create trigger set_partner_accounts_updated_at
  before update on public.partner_accounts
  for each row execute function public.set_updated_at();

create table public.partner_account_events (
  id uuid primary key default gen_random_uuid(),
  account_id text not null references public.partner_accounts (id) on delete cascade,
  -- null actor = system (e.g. automatic onboarding->live promotion).
  actor uuid references public.profiles (id),
  action text not null,
  from_status text,
  to_status text,
  reason text,
  created_at timestamptz not null default now()
);

create index partner_account_events_account_idx
  on public.partner_account_events (account_id, created_at desc);

alter table public.partner_accounts enable row level security;
alter table public.partner_account_events enable row level security;

create policy "partner_accounts: admin manage"
  on public.partner_accounts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "partner_account_events: admin manage"
  on public.partner_account_events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- Approve RPCs, redefined. Same signatures the app already calls (agency
-- keeps p_allowed_products) plus an optional p_note that lands in the
-- account_created event — the approval dialog's internal note.
--
-- Every prior signature is dropped first: CREATE OR REPLACE with a new
-- parameter list makes an OVERLOAD, not a replacement, and a defaulted new
-- param makes shorter calls ambiguous ("function is not unique"). The
-- 20260808000006 migration already tripped this once — it left a stale
-- approve_agency_application(uuid) overload behind, which this cleans up.
-- ----------------------------------------------------------------------------

drop function if exists public.approve_agency_application(uuid);
drop function if exists public.approve_agency_application(uuid, public.order_item_type[]);
drop function if exists public.approve_hotel_partner_application(uuid);
drop function if exists public.approve_affiliate_application(uuid);

create or replace function public.approve_agency_application(
  application_id uuid,
  p_allowed_products public.order_item_type[] default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.agency_applications;
  new_agency_id uuid;
begin
  if not public.is_admin() then
    raise exception 'only admins can approve agency applications';
  end if;

  select * into app from public.agency_applications where id = application_id for update;
  if not found then
    raise exception 'application not found';
  end if;
  if app.status not in ('pending', 'under_review') then
    raise exception 'application already processed';
  end if;
  if app.reference_number is null then
    raise exception 'application has no reference number';
  end if;

  insert into public.agencies (name, contact_email, created_by, status, allowed_products)
  select app.agency_name, p.email, app.applicant_id, 'active',
         coalesce(p_allowed_products, array['flight','hotel','visa','umrah','hall']::public.order_item_type[])
  from public.profiles p where p.id = app.applicant_id
  returning id into new_agency_id;

  insert into public.agency_members (agency_id, profile_id, role_in_agency, status)
  values (new_agency_id, app.applicant_id, 'owner', 'active');

  update public.agency_applications
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = application_id;

  perform public.promote_user_role(app.applicant_id, 'agent');

  insert into public.partner_accounts (id, type, application_id, entity_id, created_by)
  values (app.reference_number, 'agency', application_id, new_agency_id, auth.uid());

  insert into public.partner_account_events (account_id, actor, action, to_status, reason)
  values (app.reference_number, auth.uid(), 'account_created', 'onboarding', p_note);

  return new_agency_id;
end;
$$;

create or replace function public.approve_hotel_partner_application(
  application_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.hotel_partner_applications;
  new_partner_id uuid;
begin
  if not public.is_admin() then
    raise exception 'only admins can approve hotel partner applications';
  end if;

  select * into app from public.hotel_partner_applications where id = application_id for update;
  if not found then
    raise exception 'application not found';
  end if;
  if app.status not in ('pending', 'under_review') then
    raise exception 'application already processed';
  end if;
  if app.reference_number is null then
    raise exception 'application has no reference number';
  end if;

  insert into public.hotel_partners (name, contact_email, created_by, status)
  select app.business_name, p.email, app.applicant_id, 'active'
  from public.profiles p where p.id = app.applicant_id
  returning id into new_partner_id;

  insert into public.hotel_partner_members (partner_id, profile_id, role_in_partner, status)
  values (new_partner_id, app.applicant_id, 'owner', 'active');

  update public.hotel_partner_applications
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = application_id;

  perform public.promote_user_role(app.applicant_id, 'hotel_partner');

  insert into public.partner_accounts (id, type, application_id, entity_id, created_by)
  values (app.reference_number, 'hotel_partner', application_id, new_partner_id, auth.uid());

  insert into public.partner_account_events (account_id, actor, action, to_status, reason)
  values (app.reference_number, auth.uid(), 'account_created', 'onboarding', p_note);

  return new_partner_id;
end;
$$;

create or replace function public.approve_affiliate_application(
  application_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.affiliate_applications;
  new_affiliate_id uuid;
  code text;
begin
  if not public.is_admin() then
    raise exception 'only admins can approve affiliate applications';
  end if;

  select * into app from public.affiliate_applications where id = application_id for update;
  if not found then
    raise exception 'application not found';
  end if;
  if app.status not in ('pending', 'under_review') then
    raise exception 'application already processed';
  end if;
  if app.reference_number is null then
    raise exception 'application has no reference number';
  end if;

  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.affiliates (profile_id, referral_code, status)
  values (app.applicant_id, code, 'active')
  returning id into new_affiliate_id;

  update public.affiliate_applications
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = application_id;

  perform public.promote_user_role(app.applicant_id, 'affiliate');

  insert into public.partner_accounts (id, type, application_id, entity_id, created_by)
  values (app.reference_number, 'affiliate', application_id, new_affiliate_id, auth.uid());

  insert into public.partner_account_events (account_id, actor, action, to_status, reason)
  values (app.reference_number, auth.uid(), 'account_created', 'onboarding', p_note);

  return new_affiliate_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Backfill: applications approved before this migration get an account so
-- the admin's "Manage" path works for them too. Entities are matched via
-- created_by/profile_id = the application's applicant (the approve RPCs
-- have always set that linkage); seed/demo entities with no application
-- deliberately get no account. Status starts at 'onboarding' — the
-- app-layer auto-promotion moves genuinely-complete accounts to 'live' the
-- first time the console evaluates their checklist.
-- ----------------------------------------------------------------------------

insert into public.partner_accounts (id, type, application_id, entity_id, status, created_by, created_at)
select app.reference_number, 'agency', app.id, e.id, 'onboarding', app.reviewed_by, coalesce(app.reviewed_at, now())
from public.agency_applications app
join lateral (
  select id from public.agencies where created_by = app.applicant_id order by created_at desc limit 1
) e on true
where app.status = 'approved' and app.reference_number is not null
on conflict do nothing;

insert into public.partner_accounts (id, type, application_id, entity_id, status, created_by, created_at)
select app.reference_number, 'hotel_partner', app.id, e.id, 'onboarding', app.reviewed_by, coalesce(app.reviewed_at, now())
from public.hotel_partner_applications app
join lateral (
  select id from public.hotel_partners where created_by = app.applicant_id order by created_at desc limit 1
) e on true
where app.status = 'approved' and app.reference_number is not null
on conflict do nothing;

insert into public.partner_accounts (id, type, application_id, entity_id, status, created_by, created_at)
select app.reference_number, 'affiliate', app.id, e.id, 'onboarding', app.reviewed_by, coalesce(app.reviewed_at, now())
from public.affiliate_applications app
join lateral (
  select id from public.affiliates where profile_id = app.applicant_id order by created_at desc limit 1
) e on true
where app.status = 'approved' and app.reference_number is not null
on conflict do nothing;

insert into public.partner_account_events (account_id, actor, action, to_status, reason, created_at)
select pa.id, pa.created_by, 'account_created', 'onboarding',
       'Backfilled from application approved before partner accounts existed.', pa.created_at
from public.partner_accounts pa
where not exists (
  select 1 from public.partner_account_events e where e.account_id = pa.id
);
