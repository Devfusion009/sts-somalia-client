-- ============================================================================
-- B2B v3 — dual-market build-out
-- 1) Agency client book + book-on-behalf attribution on orders.
-- 2) Agency commission ledger, settled by the same order-paid moment that
--    records affiliate conversions.
-- 3) Agency wallet: transaction ledger over agencies.credit_balance, with
--    credit_limit allowing negative balances (book now, settle weekly).
-- 4) Agency markups: agency-controlled margin on top of platform net rates.
-- 5) Affiliate click → order attribution chain (orders.affiliate_click_id).
-- 6) Hotel room inventory enforcement: bookings consume hotel_room_inventory.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Agency client book
-- ----------------------------------------------------------------------------
create table public.agency_customers (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  full_name text not null,
  email citext,
  phone text,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agency_customers_agency_idx on public.agency_customers (agency_id);

create trigger set_agency_customers_updated_at
  before update on public.agency_customers
  for each row execute function public.set_updated_at();

alter table public.agency_customers enable row level security;

create policy "agency_customers: members manage own agency's"
  on public.agency_customers for all to authenticated
  using (public.is_agency_member(agency_id))
  with check (public.is_agency_member(agency_id));

create policy "agency_customers: admin manage"
  on public.agency_customers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Orders carry who the agent booked for, the affiliate click that referred
-- the order, and the agency margin baked into the total.
alter table public.orders
  add column agency_customer_id uuid references public.agency_customers (id),
  add column affiliate_click_id uuid references public.affiliate_clicks (id),
  add column markup_amount numeric(12,2) not null default 0 check (markup_amount >= 0);

-- ----------------------------------------------------------------------------
-- 2) Agency commission ledger
-- ----------------------------------------------------------------------------
create type public.commission_entry_status as enum ('pending', 'confirmed', 'paid_out', 'reversed');

create table public.agency_commission_entries (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id),
  order_id uuid not null references public.orders (id),
  rate_applied numeric(5,2) not null,
  commission_amount numeric(12,2) not null check (commission_amount >= 0),
  markup_amount numeric(12,2) not null default 0 check (markup_amount >= 0),
  amount numeric(12,2) not null check (amount >= 0), -- commission + markup
  status public.commission_entry_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  unique (order_id)
);

create index agency_commission_entries_agency_idx
  on public.agency_commission_entries (agency_id, created_at);

alter table public.agency_commission_entries enable row level security;

create policy "agency_commission_entries: members read own"
  on public.agency_commission_entries for select to authenticated
  using (public.is_agency_member(agency_id));

create policy "agency_commission_entries: admin manage"
  on public.agency_commission_entries for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Settlement: when an order reaches 'paid', credit the booking agency its
-- commission (platform rate on the net) plus its own markup. Same firing
-- moment as the affiliate-conversion trigger in 20260101000009.
create or replace function public.record_agency_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.agency_id is not null and new.status = 'paid'
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.agency_commission_entries
      (agency_id, order_id, rate_applied, commission_amount, markup_amount, amount)
    select
      new.agency_id,
      new.id,
      a.commission_rate,
      round((new.total - new.markup_amount) * a.commission_rate / 100.0, 2),
      new.markup_amount,
      round((new.total - new.markup_amount) * a.commission_rate / 100.0, 2) + new.markup_amount
    from public.agencies a
    where a.id = new.agency_id
    on conflict (order_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger orders_record_agency_commission
  after insert or update of status on public.orders
  for each row execute function public.record_agency_commission();

-- Affiliate conversions gain the referring click, now that orders carry it.
create or replace function public.record_affiliate_conversion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.affiliate_id is not null and new.status = 'paid'
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.affiliate_conversions (affiliate_id, click_id, order_id, commission_amount, status)
    select new.affiliate_id, new.affiliate_click_id, new.id,
           round(new.total * a.commission_rate / 100.0, 2), 'pending'
    from public.affiliates a where a.id = new.affiliate_id
    on conflict (order_id) do nothing;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) Agency wallet
-- ----------------------------------------------------------------------------
create type public.wallet_tx_type as enum ('deposit', 'booking_payment', 'refund', 'adjustment');

create table public.agency_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  type public.wallet_tx_type not null,
  amount numeric(12,2) not null, -- signed: deposits positive, payments negative
  balance_after numeric(12,2) not null,
  order_id uuid references public.orders (id),
  note text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index agency_wallet_transactions_agency_idx
  on public.agency_wallet_transactions (agency_id, created_at);

alter table public.agency_wallet_transactions enable row level security;

create policy "agency_wallet_transactions: members read own"
  on public.agency_wallet_transactions for select to authenticated
  using (public.is_agency_member(agency_id));

create policy "agency_wallet_transactions: admin manage"
  on public.agency_wallet_transactions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- The only write path for wallet money. Admin may apply any transaction;
-- an agency member may only spend (booking_payment, negative amount) on an
-- order that belongs to their own agency. Balance may go negative down to
-- -credit_limit ("book now, settle weekly").
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
    if not public.is_agency_member(target_agency_id) then
      raise exception 'not a member of this agency';
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
-- 4) Agency markups
-- ----------------------------------------------------------------------------
create type public.markup_type as enum ('percent', 'fixed');

create table public.agency_markups (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  item_type public.order_item_type, -- null = default for all verticals
  markup_type public.markup_type not null default 'percent',
  value numeric(10,2) not null check (value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (agency_id, item_type)
);

create trigger set_agency_markups_updated_at
  before update on public.agency_markups
  for each row execute function public.set_updated_at();

alter table public.agency_markups enable row level security;

create policy "agency_markups: members read own"
  on public.agency_markups for select to authenticated
  using (public.is_agency_member(agency_id));

create policy "agency_markups: owner manages own"
  on public.agency_markups for all to authenticated
  using (public.is_agency_owner(agency_id))
  with check (public.is_agency_owner(agency_id));

create policy "agency_markups: admin manage"
  on public.agency_markups for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6) Hotel room inventory enforcement
-- Availability: for dates with an inventory row, available = total - booked;
-- dates without a row are unrestricted (partner hasn't capped them).
-- ----------------------------------------------------------------------------
create or replace function public.room_available_units(
  target_room_id uuid,
  stay_check_in date,
  stay_check_out date
)
returns integer
language sql
stable
set search_path = public
as $$
  select min(total_units - booked_units)::integer
  from public.hotel_room_inventory
  where room_id = target_room_id
    and date >= stay_check_in
    and date < stay_check_out;
$$;

create or replace function public.reserve_room_inventory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  short_date date;
begin
  -- Lock the stay's inventory rows, then fail if any night lacks capacity.
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

create trigger hotel_bookings_reserve_inventory
  before insert on public.hotel_bookings
  for each row execute function public.reserve_room_inventory();

create or replace function public.release_room_inventory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from new.status then
    update public.hotel_room_inventory
      set booked_units = greatest(0, booked_units - new.num_rooms)
      where room_id = new.room_id and date >= new.check_in and date < new.check_out;
  end if;
  return new;
end;
$$;

create trigger hotel_bookings_release_inventory
  after update of status on public.hotel_bookings
  for each row execute function public.release_room_inventory();
