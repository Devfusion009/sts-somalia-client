-- ============================================================================
-- Manual booking system + venue partner program.
--
-- 1) Waitlist-aware inventory triggers: a 'waitlisted' hotel booking reserves
--    nothing on insert; promoting it out of the waitlist runs the same
--    reservation (and fails loudly if the nights are still full); releasing
--    inventory skips bookings that never reserved any.
-- 2) New-order alerting: an AFTER INSERT trigger on orders notifies every
--    platform admin (type 'new_order') — powering the admin queue bell.
-- 3) Venue partner: entity + members + application + approval/rejection RPCs
--    + event_venues ownership + RLS, mirroring the hotel partner program.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Waitlist-aware inventory triggers
-- ----------------------------------------------------------------------------

-- A waitlisted request deliberately reserves nothing: it exists precisely
-- because the nights were full, and holding phantom units would deadlock the
-- calendar. Everything else keeps the original serialized check-and-reserve.
create or replace function public.reserve_room_inventory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  short_date date;
begin
  if new.status = 'waitlisted' then
    return new;
  end if;

  perform 1 from public.hotel_room_inventory
    where room_id = new.room_id and date >= new.check_in and date < new.check_out
    for update;

  select date into short_date
  from public.hotel_room_inventory
  where room_id = new.room_id
    and date >= new.check_in and date < new.check_out
    and total_units - booked_units < new.num_rooms
  limit 1;

  if short_date is not null then
    raise exception 'not enough rooms available on %', short_date;
  end if;

  update public.hotel_room_inventory
    set booked_units = booked_units + new.num_rooms
    where room_id = new.room_id and date >= new.check_in and date < new.check_out;
  return new;
end;
$$;

-- Promoting a waitlisted booking (admin confirms once space frees up) must
-- reserve at that moment — and must FAIL if the nights are still full, so an
-- admin can't accidentally double-book by confirming a stale waitlist entry.
create or replace function public.reserve_inventory_on_waitlist_promotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  short_date date;
begin
  if old.status = 'waitlisted' and new.status in ('pending', 'confirmed') then
    perform 1 from public.hotel_room_inventory
      where room_id = new.room_id and date >= new.check_in and date < new.check_out
      for update;

    select date into short_date
    from public.hotel_room_inventory
    where room_id = new.room_id
      and date >= new.check_in and date < new.check_out
      and total_units - booked_units < new.num_rooms
    limit 1;

    if short_date is not null then
      raise exception 'still not enough rooms available on %', short_date;
    end if;

    update public.hotel_room_inventory
      set booked_units = booked_units + new.num_rooms
      where room_id = new.room_id and date >= new.check_in and date < new.check_out;
  end if;
  return new;
end;
$$;

create trigger hotel_bookings_reserve_on_waitlist_promotion
  before update of status on public.hotel_bookings
  for each row execute function public.reserve_inventory_on_waitlist_promotion();

-- A waitlisted booking never incremented booked_units, so cancelling it must
-- not decrement them either — without this guard, cancelling a waitlist entry
-- would corrupt the calendar by freeing units that were never held.
create or replace function public.release_room_inventory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled'
     and old.status is distinct from new.status
     and old.status <> 'waitlisted' then
    update public.hotel_room_inventory
      set booked_units = greatest(0, booked_units - new.num_rooms)
      where room_id = new.room_id and date >= new.check_in and date < new.check_out;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) New-order admin alerting
-- ----------------------------------------------------------------------------

-- SECURITY DEFINER so the customer's own insert can fan out notifications the
-- customer could never write directly (notifications has no client insert
-- policy by design). One row per platform admin: the bell is per-profile.
create or replace function public.notify_admins_new_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (profile_id, type, title, body, data)
  select p.id,
         'new_order',
         'New order ' || new.order_number,
         'A customer placed an order totalling ' || new.currency || ' ' || new.total || '. It is waiting in the queue.',
         jsonb_build_object('order_id', new.id, 'order_number', new.order_number)
  from public.profiles p
  where p.is_platform_admin;
  return new;
end;
$$;

create trigger orders_notify_admins_new_order
  after insert on public.orders
  for each row execute function public.notify_admins_new_order();

-- ----------------------------------------------------------------------------
-- 3) Venue partner program
-- ----------------------------------------------------------------------------

create table public.venue_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  contact_email citext not null,
  contact_phone text,
  country_code text,
  status public.agency_status not null default 'pending',
  commission_rate numeric(5,2) not null default 0 check (commission_rate >= 0 and commission_rate <= 100),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_venue_partners_updated_at
  before update on public.venue_partners
  for each row execute function public.set_updated_at();

create table public.venue_partner_members (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.venue_partners (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role_in_partner public.agency_member_role not null default 'staff',
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (partner_id, profile_id)
);

create index venue_partner_members_profile_idx on public.venue_partner_members (profile_id);

create or replace function public.is_venue_partner_member(target_partner_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.venue_partner_members
    where partner_id = target_partner_id and profile_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.is_venue_partner_owner(target_partner_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.venue_partner_members
    where partner_id = target_partner_id and profile_id = auth.uid()
      and status = 'active' and role_in_partner = 'owner'
  );
$$;

alter table public.venue_partners enable row level security;
alter table public.venue_partner_members enable row level security;

create policy "venue_partners: admin manage"
  on public.venue_partners for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "venue_partners: members read own"
  on public.venue_partners for select to authenticated
  using (public.is_venue_partner_member(id));

create policy "venue_partners: owner update own"
  on public.venue_partners for update to authenticated
  using (public.is_venue_partner_owner(id))
  with check (public.is_venue_partner_owner(id));

create policy "venue_partner_members: admin manage"
  on public.venue_partner_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "venue_partner_members: members read teammates"
  on public.venue_partner_members for select to authenticated
  using (public.is_venue_partner_member(partner_id));

-- Application table — born with the review columns (reference_number,
-- assigned_reviewer, internal_notes, submitted_at) the other three kinds had
-- bolted on later in 20260808000003.
create table public.venue_partner_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  business_name text not null default '',
  business_details jsonb not null default '{}'::jsonb,
  document_refs jsonb not null default '[]'::jsonb,
  status public.application_status not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_notes text,
  reference_number text unique,
  assigned_reviewer uuid references public.profiles (id),
  internal_notes text,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create sequence public.venue_partner_application_ref_seq;

create or replace function public.generate_venue_partner_application_ref()
returns text language sql as $$
  select 'STS-VP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.venue_partner_application_ref_seq')::text, 6, '0');
$$;

alter table public.venue_partner_applications enable row level security;

create policy "venue_partner_applications: applicant reads own"
  on public.venue_partner_applications for select to authenticated
  using (applicant_id = auth.uid());

create policy "venue_partner_applications: applicant submits"
  on public.venue_partner_applications for insert to authenticated
  with check (applicant_id = auth.uid());

create policy "venue_partner_applications: applicant edits own unless decided"
  on public.venue_partner_applications for update to authenticated
  using (
    applicant_id = auth.uid()
    and status in ('draft', 'more_info_requested', 'pending', 'under_review')
  );

create policy "venue_partner_applications: admin manage"
  on public.venue_partner_applications for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create trigger venue_partner_applications_audit
  after insert or update or delete on public.venue_partner_applications
  for each row execute function public.audit_log_row_change();

-- Venue ownership. Nullable: the existing admin-created catalog keeps
-- partner_id null and stays admin-managed; partner-created venues carry it.
alter table public.event_venues
  add column partner_id uuid references public.venue_partners (id) on delete set null;

create index event_venues_partner_idx on public.event_venues (partner_id);

create policy "event_venues: venue partner reads own"
  on public.event_venues for select to authenticated
  using (partner_id is not null and public.is_venue_partner_member(partner_id));

create policy "event_venues: venue partner creates own"
  on public.event_venues for insert to authenticated
  with check (partner_id is not null and public.is_venue_partner_member(partner_id));

create policy "event_venues: venue partner updates own"
  on public.event_venues for update to authenticated
  using (partner_id is not null and public.is_venue_partner_member(partner_id))
  with check (partner_id is not null and public.is_venue_partner_member(partner_id));

-- Venue partners see and work the booking requests for their own venues —
-- previously only customer/agency/admin could even read a hall booking.
create policy "hall_bookings: venue partner reads own venue bookings"
  on public.hall_bookings for select to authenticated
  using (
    exists (
      select 1 from public.event_venues v
      where v.id = venue_id and v.partner_id is not null
        and public.is_venue_partner_member(v.partner_id)
    )
  );

create policy "hall_bookings: venue partner updates own venue bookings"
  on public.hall_bookings for update to authenticated
  using (
    exists (
      select 1 from public.event_venues v
      where v.id = venue_id and v.partner_id is not null
        and public.is_venue_partner_member(v.partner_id)
    )
  )
  with check (
    exists (
      select 1 from public.event_venues v
      where v.id = venue_id and v.partner_id is not null
        and public.is_venue_partner_member(v.partner_id)
    )
  );

-- partner_accounts / partner_document_reviews learn the fourth kind.
alter table public.partner_accounts
  drop constraint partner_accounts_type_check;
alter table public.partner_accounts
  add constraint partner_accounts_type_check
  check (type in ('agency', 'hotel_partner', 'affiliate', 'venue_partner'));

alter table public.partner_document_reviews
  drop constraint partner_document_reviews_application_type_check;
alter table public.partner_document_reviews
  add constraint partner_document_reviews_application_type_check
  check (application_type in ('agency', 'hotel_partner', 'affiliate', 'venue_partner'));

-- KYC storage: the three applicant policies enumerate kinds in their folder
-- checks — recreate each with the venue_partner arm added.
drop policy "kyc_documents: applicant reads own application folder" on storage.objects;
create policy "kyc_documents: applicant reads own application folder"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (
      ((storage.foldername(name))[1] = 'agency' and exists (
        select 1 from public.agency_applications a
        where a.id::text = (storage.foldername(objects.name))[2] and a.applicant_id = auth.uid()))
      or ((storage.foldername(name))[1] = 'hotel_partner' and exists (
        select 1 from public.hotel_partner_applications a
        where a.id::text = (storage.foldername(objects.name))[2] and a.applicant_id = auth.uid()))
      or ((storage.foldername(name))[1] = 'affiliate' and exists (
        select 1 from public.affiliate_applications a
        where a.id::text = (storage.foldername(objects.name))[2] and a.applicant_id = auth.uid()))
      or ((storage.foldername(name))[1] = 'venue_partner' and exists (
        select 1 from public.venue_partner_applications a
        where a.id::text = (storage.foldername(objects.name))[2] and a.applicant_id = auth.uid()))
    )
  );

drop policy "kyc_documents: applicant writes own application folder" on storage.objects;
create policy "kyc_documents: applicant writes own application folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'kyc-documents'
    and (
      ((storage.foldername(name))[1] = 'agency' and exists (
        select 1 from public.agency_applications a
        where a.id::text = (storage.foldername(objects.name))[2] and a.applicant_id = auth.uid()))
      or ((storage.foldername(name))[1] = 'hotel_partner' and exists (
        select 1 from public.hotel_partner_applications a
        where a.id::text = (storage.foldername(objects.name))[2] and a.applicant_id = auth.uid()))
      or ((storage.foldername(name))[1] = 'affiliate' and exists (
        select 1 from public.affiliate_applications a
        where a.id::text = (storage.foldername(objects.name))[2] and a.applicant_id = auth.uid()))
      or ((storage.foldername(name))[1] = 'venue_partner' and exists (
        select 1 from public.venue_partner_applications a
        where a.id::text = (storage.foldername(objects.name))[2] and a.applicant_id = auth.uid()))
    )
  );

drop policy "kyc_documents: applicant deletes own application folder" on storage.objects;
create policy "kyc_documents: applicant deletes own application folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (
      ((storage.foldername(name))[1] = 'agency' and exists (
        select 1 from public.agency_applications a
        where a.id::text = (storage.foldername(objects.name))[2] and a.applicant_id = auth.uid()))
      or ((storage.foldername(name))[1] = 'hotel_partner' and exists (
        select 1 from public.hotel_partner_applications a
        where a.id::text = (storage.foldername(objects.name))[2] and a.applicant_id = auth.uid()))
      or ((storage.foldername(name))[1] = 'affiliate' and exists (
        select 1 from public.affiliate_applications a
        where a.id::text = (storage.foldername(objects.name))[2] and a.applicant_id = auth.uid()))
      or ((storage.foldername(name))[1] = 'venue_partner' and exists (
        select 1 from public.venue_partner_applications a
        where a.id::text = (storage.foldername(objects.name))[2] and a.applicant_id = auth.uid()))
    )
  );

-- Approval: mirrors approve_hotel_partner_application step for step —
-- entity, owner membership, application flip, role promotion, partner
-- account keyed by reference number, and the account_created event.
create or replace function public.approve_venue_partner_application(
  application_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.venue_partner_applications;
  new_partner_id uuid;
begin
  if not public.is_admin() then
    raise exception 'only admins can approve venue partner applications';
  end if;

  select * into app from public.venue_partner_applications where id = application_id for update;
  if not found then raise exception 'application not found'; end if;
  if app.status not in ('pending', 'under_review') then
    raise exception 'application already processed';
  end if;
  if app.reference_number is null then
    raise exception 'application has no reference number';
  end if;

  insert into public.venue_partners (name, contact_email, created_by, status)
  select app.business_name, p.email, app.applicant_id, 'active'
  from public.profiles p where p.id = app.applicant_id
  returning id into new_partner_id;

  insert into public.venue_partner_members (partner_id, profile_id, role_in_partner, status)
  values (new_partner_id, app.applicant_id, 'owner', 'active');

  update public.venue_partner_applications
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = application_id;

  perform public.promote_user_role(app.applicant_id, 'venue_partner');

  insert into public.partner_accounts (id, type, application_id, entity_id, created_by)
  values (app.reference_number, 'venue_partner', application_id, new_partner_id, auth.uid());

  insert into public.partner_account_events (account_id, actor, action, to_status, reason)
  values (app.reference_number, auth.uid(), 'account_created', 'onboarding', p_note);

  return new_partner_id;
end;
$$;

create or replace function public.reject_venue_partner_application(
  application_id uuid,
  notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins can reject venue partner applications';
  end if;

  update public.venue_partner_applications
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_notes = notes
    where id = application_id and status in ('pending', 'under_review');

  if not found then
    raise exception 'application not found or already processed';
  end if;
end;
$$;
