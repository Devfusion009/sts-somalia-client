-- ============================================================================
-- B2B Portal Phase 1 — foundation
-- 1) Granular agency sub-user roles (owner/admin/booking_staff/accountant/viewer).
-- 2) Agency tiers (Silver/Gold) carrying default commission/credit settings.
-- 3) Low-balance alerts on the wallet.
-- 4) Auto-created draft invoice per paid order (PDF rendered lazily by the app).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Agency roles
-- Swap the enum rather than ALTER TYPE ADD VALUE — safe regardless of PG
-- version/transaction semantics, and lets us re-map existing rows in the
-- same statement ('staff' has no successor here, so backfill to
-- 'booking_staff', the closest existing meaning).
-- ----------------------------------------------------------------------------
create type public.agency_role as enum
  ('owner', 'admin', 'booking_staff', 'accountant', 'viewer');

drop policy "agency_members: owner invites staff" on public.agency_members;
drop policy "agency_members: owner removes staff" on public.agency_members;

alter table public.agency_members alter column role_in_agency drop default;

alter table public.agency_members
  alter column role_in_agency type public.agency_role
  using (case role_in_agency::text
    when 'owner' then 'owner'
    else 'booking_staff'
  end)::public.agency_role;

alter table public.agency_members alter column role_in_agency set default 'booking_staff';

-- NOTE: the ORIGINAL public.agency_member_role type ('owner'/'staff') is
-- intentionally left in place — hotel_partner_members.role_in_partner still
-- uses it and is out of scope here. agency_members.role_in_agency now uses
-- the new, distinct public.agency_role type instead.

create or replace function public.is_agency_owner_or_admin(target_agency_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.agency_members
    where agency_id = target_agency_id
      and profile_id = auth.uid()
      and role_in_agency in ('owner', 'admin')
      and status = 'active'
  );
$$;

-- owner/admin/booking_staff may spend the wallet (create bookings & pay for
-- them); accountant/viewer are financial-visibility-only, never spenders.
create or replace function public.is_agency_booker(target_agency_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.agency_members
    where agency_id = target_agency_id
      and profile_id = auth.uid()
      and role_in_agency in ('owner', 'admin', 'booking_staff')
      and status = 'active'
  );
$$;

-- Owner/admin can add any non-owner role. Nobody can self-appoint 'owner'
-- through this policy (the approval flow is the only path to 'owner').
create policy "agency_members: owner or admin adds members"
  on public.agency_members for insert
  to authenticated
  with check (public.is_agency_owner_or_admin(agency_id) and role_in_agency <> 'owner');

-- Owner/admin can change role/status of non-owner rows. Because `with check`
-- re-validates the FULL new row, an update targeting the owner's own row
-- (whose role_in_agency stays 'owner') always fails this check — the owner
-- row is implicitly un-editable and un-removable via this policy.
create policy "agency_members: owner or admin manages members"
  on public.agency_members for update
  to authenticated
  using (public.is_agency_owner_or_admin(agency_id))
  with check (public.is_agency_owner_or_admin(agency_id) and role_in_agency <> 'owner');

-- Wallet spend authorization now checks role, not just membership.
create or replace function public.apply_agency_wallet_transaction(
  target_agency_id uuid,
  tx_amount numeric,
  tx_type public.wallet_tx_type,
  target_order_id uuid default null,
  tx_note text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  agency public.agencies;
  new_balance numeric(12,2);
begin
  if not public.is_admin() then
    if not public.is_agency_booker(target_agency_id) then
      raise exception 'not authorized to spend this agency''s wallet';
    end if;
    if tx_type <> 'booking_payment' or tx_amount >= 0 then
      raise exception 'agency members can only make booking payments';
    end if;
    if target_order_id is null or not exists (
      select 1 from public.orders
      where id = target_order_id and agency_id = target_agency_id
    ) then
      raise exception 'order does not belong to this agency';
    end if;
  end if;

  select * into agency from public.agencies where id = target_agency_id for update;
  if not found then
    raise exception 'agency not found';
  end if;

  new_balance := agency.credit_balance + tx_amount;
  if tx_amount < 0 and new_balance < -agency.credit_limit then
    raise exception 'insufficient agency balance (available: %)',
      agency.credit_balance + agency.credit_limit;
  end if;

  update public.agencies set credit_balance = new_balance where id = target_agency_id;

  insert into public.agency_wallet_transactions
    (agency_id, type, amount, balance_after, order_id, note, created_by)
  values
    (target_agency_id, tx_type, tx_amount, new_balance, target_order_id, tx_note, auth.uid());

  return new_balance;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) Agency tiers
-- ----------------------------------------------------------------------------
create table public.agency_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_commission_rate numeric(5,2) not null default 0
    check (default_commission_rate >= 0 and default_commission_rate <= 100),
  default_credit_limit numeric(12,2) not null default 0 check (default_credit_limit >= 0),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_agency_tiers_updated_at
  before update on public.agency_tiers
  for each row execute function public.set_updated_at();

insert into public.agency_tiers (name, default_commission_rate, default_credit_limit, sort_order)
values
  ('Silver', 8, 500, 1),
  ('Gold', 12, 2000, 2);

alter table public.agencies add column tier_id uuid references public.agency_tiers (id);
alter table public.agencies add column low_balance_threshold numeric(12,2) not null default 100
  check (low_balance_threshold >= 0);

alter table public.agency_tiers enable row level security;

create policy "agency_tiers: authenticated reads"
  on public.agency_tiers for select to authenticated
  using (true);

create policy "agency_tiers: admin manage"
  on public.agency_tiers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3) Low-balance alerts
-- Edge-triggered: only fires the moment available balance (balance +
-- credit_limit) crosses from at-or-above to below the agency's threshold, so
-- a string of bookings while already low doesn't spam notifications.
-- ----------------------------------------------------------------------------
create or replace function public.notify_low_agency_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  agency public.agencies;
  old_available numeric;
  new_available numeric;
  member record;
begin
  select * into agency from public.agencies where id = new.agency_id;
  if not found then
    return new;
  end if;

  old_available := (new.balance_after - new.amount) + agency.credit_limit;
  new_available := new.balance_after + agency.credit_limit;

  if new_available < agency.low_balance_threshold and old_available >= agency.low_balance_threshold then
    for member in
      select profile_id from public.agency_members
      where agency_id = new.agency_id and role_in_agency in ('owner', 'admin') and status = 'active'
    loop
      insert into public.notifications (profile_id, type, title, body, data)
      values (
        member.profile_id,
        'low_balance',
        'Low wallet balance',
        format('%s''s available balance is %s %s, below your %s %s alert threshold.',
          agency.name, agency.credit_balance::text, 'USD',
          agency.low_balance_threshold::text, 'USD'),
        jsonb_build_object('agency_id', agency.id, 'available', new_available)
      );
    end loop;
  end if;

  return new;
end;
$$;

create trigger agency_wallet_transactions_notify_low_balance
  after insert on public.agency_wallet_transactions
  for each row execute function public.notify_low_agency_balance();

-- ----------------------------------------------------------------------------
-- 4) Auto-created draft invoice per paid order
-- PDF bytes are rendered lazily by the app (avoids doing PDF work inside a
-- DB trigger); this just guarantees every paid order has an invoice row and
-- a stable invoice_number the moment it settles.
-- ----------------------------------------------------------------------------
create sequence public.invoice_number_seq;

create or replace function public.generate_invoice_number()
returns text
language sql
as $$
  select 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0');
$$;

create or replace function public.create_invoice_for_paid_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.invoices (order_id, invoice_number, status, issued_at, total, currency)
    values (new.id, public.generate_invoice_number(), 'issued', now(), new.total, new.currency)
    on conflict (order_id) do nothing;
  end if;
  return new;
end;
$$;

alter table public.invoices add constraint invoices_order_id_unique unique (order_id);

create trigger orders_create_invoice
  after insert or update of status on public.orders
  for each row execute function public.create_invoice_for_paid_order();

-- ----------------------------------------------------------------------------
-- 5) Extend markup management to admin, matching the rest of Phase 1's
-- owner+admin model (was owner-only from the earlier B2B v3 migration).
-- ----------------------------------------------------------------------------
drop policy "agency_markups: owner manages own" on public.agency_markups;

create policy "agency_markups: owner or admin manages own"
  on public.agency_markups for all to authenticated
  using (public.is_agency_owner_or_admin(agency_id))
  with check (public.is_agency_owner_or_admin(agency_id));

-- ----------------------------------------------------------------------------
-- 6) Teammates can see each other's basic profile info.
-- Pre-existing gap: `profiles` SELECT was self-or-admin only, so any
-- "view your team" UI (agent team page, hotel-partner team) got a null
-- embed for every row except the viewer's own — real names/emails only
-- ever rendered for admins. Purely additive: widens SELECT, touches
-- nothing else.
-- ----------------------------------------------------------------------------
create or replace function public.shares_active_org_with(target_profile_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.agency_members m1
    join public.agency_members m2 on m1.agency_id = m2.agency_id
    where m1.profile_id = auth.uid() and m1.status = 'active'
      and m2.profile_id = target_profile_id and m2.status = 'active'
  ) or exists (
    select 1 from public.hotel_partner_members m1
    join public.hotel_partner_members m2 on m1.partner_id = m2.partner_id
    where m1.profile_id = auth.uid() and m1.status = 'active'
      and m2.profile_id = target_profile_id and m2.status = 'active'
  );
$$;

create policy "profiles: teammates read"
  on public.profiles for select to authenticated
  using (public.shares_active_org_with(id));
