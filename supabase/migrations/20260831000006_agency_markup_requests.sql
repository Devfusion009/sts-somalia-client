-- Agency markup becomes an admin-approved commercial term.
--
-- 1) agency_markup_requests: every add/update/remove an agency owner wants
--    on its markup rules lands here as a pending request. agency_markups
--    itself now holds approved rules only — pricing (getAgencyMarkupAmount)
--    keeps reading it unchanged, so a pending request never affects a price.
-- 2) The owner's direct-write policy on agency_markups is dropped; the only
--    write paths are the two security-definer RPCs below (they also have to
--    be RPCs because notifications has no client insert policy).
-- 3) approve_agency_application seeds the agency's default rule from the
--    markup the applicant requested on the wizard's Settlement step, in the
--    same transaction that creates the agency — approving the application is
--    approving that rate.
-- 4) admin_nav_counts gains a 'markup_requests' bucket for the Agencies badge.

create table public.agency_markup_requests (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  item_type public.order_item_type, -- null = agency-wide default
  action text not null check (action in ('set', 'remove')),
  markup_type public.markup_type not null default 'percent',
  value numeric(10,2) check (value >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid not null references public.profiles (id),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((action = 'set' and value is not null) or (action = 'remove' and value is null))
);

create unique index agency_markup_requests_one_pending_per_scope
  on public.agency_markup_requests (agency_id, item_type) nulls not distinct
  where status = 'pending';

create index agency_markup_requests_agency_idx
  on public.agency_markup_requests (agency_id, requested_at desc);

create index agency_markup_requests_pending_idx
  on public.agency_markup_requests (status)
  where status = 'pending';

create trigger set_agency_markup_requests_updated_at
  before update on public.agency_markup_requests
  for each row execute function public.set_updated_at();

alter table public.agency_markup_requests enable row level security;

create policy "agency_markup_requests: members read own"
  on public.agency_markup_requests for select to authenticated
  using (public.is_agency_member(agency_id));

-- "Withdraw": an owner/admin can pull a request back while it is still pending.
create policy "agency_markup_requests: owner withdraws pending"
  on public.agency_markup_requests for delete to authenticated
  using (public.is_agency_owner_or_admin(agency_id) and status = 'pending');

create policy "agency_markup_requests: admin read"
  on public.agency_markup_requests for select to authenticated
  using (public.is_admin());

-- Agencies no longer write their live rules directly (policy was renamed in
-- 20260807000001_b2b_phase1.sql; both names covered).
drop policy if exists "agency_markups: owner manages own" on public.agency_markups;
drop policy if exists "agency_markups: owner or admin manages own" on public.agency_markups;

-- ----------------------------------------------------------------------------
-- Agent side: file (or overwrite) the pending request for one scope.
-- ----------------------------------------------------------------------------
-- p_item_type is text (not the enum) so the client can omit it for the
-- agency-wide default instead of passing an explicit enum null.
create or replace function public.request_agency_markup_change(
  p_agency_id uuid,
  p_action text,
  p_item_type text default null,
  p_markup_type public.markup_type default 'percent',
  p_value numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_agency_name text;
  v_scope text;
  v_item_type public.order_item_type := nullif(p_item_type, '')::public.order_item_type;
begin
  if not public.is_agency_owner_or_admin(p_agency_id) then
    raise exception 'only the agency owner or an admin can request markup changes';
  end if;
  if p_action not in ('set', 'remove') then
    raise exception 'invalid action';
  end if;
  if p_action = 'set' then
    if p_value is null or p_value < 0 then
      raise exception 'markup value is required';
    end if;
    if p_markup_type = 'percent' and p_value > 100 then
      raise exception 'percentage markup cannot exceed 100';
    end if;
    if p_markup_type = 'fixed' and p_value > 100000 then
      raise exception 'fixed markup cannot exceed 100000';
    end if;
  end if;

  update public.agency_markup_requests
     set action = p_action,
         markup_type = p_markup_type,
         value = case when p_action = 'set' then p_value else null end,
         requested_by = auth.uid(),
         requested_at = now()
   where agency_id = p_agency_id
     and item_type is not distinct from v_item_type
     and status = 'pending'
  returning id into v_request_id;

  if v_request_id is null then
    insert into public.agency_markup_requests
      (agency_id, item_type, action, markup_type, value, requested_by)
    values
      (p_agency_id, v_item_type, p_action, p_markup_type,
       case when p_action = 'set' then p_value else null end, auth.uid())
    returning id into v_request_id;
  end if;

  select name into v_agency_name from public.agencies where id = p_agency_id;
  v_scope := coalesce(v_item_type::text, 'all services');

  insert into public.notifications (profile_id, type, title, body, data)
  select p.id,
         'markup_request',
         'Markup change awaiting approval',
         v_agency_name || ' requested '
           || case
                when p_action = 'remove' then 'removing the ' || v_scope || ' markup rule'
                when p_markup_type = 'percent' then trim_scale(p_value)::text || '% markup on ' || v_scope
                else 'USD ' || trim_scale(p_value)::text || ' markup on ' || v_scope
              end || '.',
         jsonb_build_object('agencyId', p_agency_id, 'requestId', v_request_id)
  from public.profiles p
  where p.is_platform_admin;

  return v_request_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Admin side: approve (apply to agency_markups) or reject (with a note).
-- ----------------------------------------------------------------------------
create or replace function public.review_agency_markup_request(
  p_request_id uuid,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.agency_markup_requests;
  v_account_id text;
  v_scope text;
  v_summary text;
begin
  if not public.is_admin() then
    raise exception 'only admins can review markup requests';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid decision';
  end if;
  if p_decision = 'rejected' and coalesce(btrim(p_note), '') = '' then
    raise exception 'a note is required when rejecting';
  end if;

  select * into req from public.agency_markup_requests where id = p_request_id for update;
  if not found then
    raise exception 'request not found';
  end if;
  if req.status <> 'pending' then
    raise exception 'request already reviewed';
  end if;

  if p_decision = 'approved' then
    if req.action = 'set' then
      insert into public.agency_markups (agency_id, item_type, markup_type, value)
      values (req.agency_id, req.item_type, req.markup_type, req.value)
      on conflict (agency_id, item_type)
      do update set markup_type = excluded.markup_type, value = excluded.value;
    else
      delete from public.agency_markups
       where agency_id = req.agency_id
         and item_type is not distinct from req.item_type;
    end if;
  end if;

  update public.agency_markup_requests
     set status = p_decision,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_note = nullif(btrim(p_note), '')
   where id = p_request_id;

  v_scope := coalesce(req.item_type::text, 'all services');
  v_summary := case
    when req.action = 'remove' then 'Remove ' || v_scope || ' markup rule'
    when req.markup_type = 'percent' then trim_scale(req.value)::text || '% markup on ' || v_scope
    else 'USD ' || trim_scale(req.value)::text || ' markup on ' || v_scope
  end;

  insert into public.notifications (profile_id, type, title, body, data)
  values (
    req.requested_by,
    'markup_request_reviewed',
    case when p_decision = 'approved' then 'Markup change approved' else 'Markup change rejected' end,
    v_summary || case when p_decision = 'approved' then ' is now live.' else ' was not approved.' end
      || case when nullif(btrim(p_note), '') is not null then ' ' || btrim(p_note) else '' end,
    jsonb_build_object('agencyId', req.agency_id, 'requestId', req.id, 'decision', p_decision)
  );

  select id into v_account_id
    from public.partner_accounts
   where type = 'agency' and entity_id = req.agency_id
   limit 1;
  if v_account_id is not null then
    insert into public.partner_account_events (account_id, actor, action, reason)
    values (v_account_id, auth.uid(), 'markup_request_' || p_decision,
            v_summary || case when nullif(btrim(p_note), '') is not null then ' · ' || btrim(p_note) else '' end);
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- Approval seeds the default markup rule from the application.
-- ----------------------------------------------------------------------------
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
  v_markup numeric;
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

  v_markup := nullif(app.business_details->>'requestedMarkupPercent', '')::numeric;
  if v_markup is not null and v_markup >= 0 and v_markup <= 100 then
    insert into public.agency_markups (agency_id, item_type, markup_type, value)
    values (new_agency_id, null, 'percent', v_markup);
  end if;

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

-- ----------------------------------------------------------------------------
-- Sidebar badge on Agencies.
-- ----------------------------------------------------------------------------
create or replace function public.admin_nav_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  return jsonb_build_object(
    'queue',
      (select count(*) from public.hotel_bookings where status in ('pending', 'waitlisted'))
      + (select count(*) from public.hall_bookings where status = 'pending')
      + (select count(*) from public.umrah_bookings where booking_kind = 'private' and status = 'pending'),
    'refunds',
      (select count(*) from public.agency_refund_requests where status = 'pending'),
    'visa',
      (select count(*) from public.visa_applications where status = 'submitted'),
    'umrah_requests',
      (select count(*) from public.umrah_bookings where booking_kind = 'private' and status = 'pending'),
    'partner_applications',
      (select count(*) from public.agency_applications where status in ('pending', 'under_review'))
      + (select count(*) from public.hotel_partner_applications where status in ('pending', 'under_review'))
      + (select count(*) from public.affiliate_applications where status in ('pending', 'under_review'))
      + (select count(*) from public.venue_partner_applications where status in ('pending', 'under_review')),
    'markup_requests',
      (select count(*) from public.agency_markup_requests where status = 'pending')
  );
end;
$$;
