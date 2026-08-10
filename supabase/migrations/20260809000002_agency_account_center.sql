-- ============================================================================
-- Agent portal "My Account" center: bank details, formal credit/debit
-- notes, and a real refund-request workflow — the three pieces that had no
-- backing at all before this (bank details were write-once/never-surfaced;
-- credit/debit notes were an undifferentiated 'adjustment' wallet tx;
-- refunds were only a status label with no request/approval path).
-- Invoices and Statement reuse existing tables (invoices, agency_wallet_
-- transactions) — no schema change needed for those.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Bank details on the agency record itself.
-- Previously captured ONLY once, inside agency_applications.business_details
-- jsonb during onboarding, and never copied anywhere or surfaced again.
-- Already covered by the existing "agencies: owner or admin update own
-- agency" UPDATE policy (whole-row) — no new RLS needed.
-- ----------------------------------------------------------------------------
alter table public.agencies add column bank_name text;
alter table public.agencies add column bank_account_name text;
alter table public.agencies add column bank_account_number text;

-- ----------------------------------------------------------------------------
-- 2) Credit / debit notes as first-class wallet_tx_type values with their
-- own auto-generated document numbers (mirrors generate_invoice_number /
-- invoice_number_seq from b2b_phase1), instead of an undifferentiated
-- 'adjustment' row indistinguishable from any other correction.
--
-- Swap the enum rather than ALTER TYPE ADD VALUE, same reasoning as
-- agency_role in b2b_phase1: a freshly-created type with all values already
-- present can be used immediately in the same transaction (function bodies,
-- triggers) with none of the "unsafe use of new value" restrictions that
-- apply to incrementally-added enum values.
-- ----------------------------------------------------------------------------
create type public.wallet_tx_type_new as enum
  ('deposit', 'booking_payment', 'refund', 'adjustment', 'credit_note', 'debit_note');

alter table public.agency_wallet_transactions
  alter column type type public.wallet_tx_type_new
  using type::text::public.wallet_tx_type_new;

drop function public.apply_agency_wallet_transaction(uuid, numeric, public.wallet_tx_type, uuid, text);
drop type public.wallet_tx_type;
alter type public.wallet_tx_type_new rename to wallet_tx_type;

-- Re-created with the widened enum. Also now returns the new transaction's
-- id (previously new_balance) — nothing in the app read the returned value
-- (both call sites in src/modules/agencies/admin-actions.ts and
-- src/modules/payments/actions.ts only check `error`), and
-- approve_agency_refund_request below needs the id to link the request to
-- the ledger row it created. Logic is otherwise unchanged from b2b_phase1.
create or replace function public.apply_agency_wallet_transaction(
  target_agency_id uuid,
  tx_amount numeric,
  tx_type public.wallet_tx_type,
  target_order_id uuid default null,
  tx_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  agency public.agencies;
  new_balance numeric(12,2);
  new_tx_id uuid;
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
    (target_agency_id, tx_type, tx_amount, new_balance, target_order_id, tx_note, auth.uid())
  returning id into new_tx_id;

  return new_tx_id;
end;
$$;

alter table public.agency_wallet_transactions add column document_number text unique;

create sequence public.credit_note_number_seq;
create sequence public.debit_note_number_seq;

create or replace function public.generate_wallet_document_number()
returns trigger
language plpgsql
as $$
begin
  if new.document_number is not null then
    return new;
  end if;
  if new.type = 'credit_note' then
    new.document_number := 'CN-' || to_char(now(), 'YYYY') || '-'
      || lpad(nextval('public.credit_note_number_seq')::text, 6, '0');
  elsif new.type = 'debit_note' then
    new.document_number := 'DN-' || to_char(now(), 'YYYY') || '-'
      || lpad(nextval('public.debit_note_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger agency_wallet_transactions_document_number
  before insert on public.agency_wallet_transactions
  for each row execute function public.generate_wallet_document_number();

-- ----------------------------------------------------------------------------
-- 3) Refund requests — an agent (booker role) can request a refund against
-- their own agency's order; an admin approves (crediting the wallet via
-- apply_agency_wallet_transaction, same function agent spending and admin
-- deposits/adjustments already go through, so the balance and ledger can
-- never diverge) or rejects. Previously "refund" was only an order/payment
-- status label an admin could set with no request or tracking mechanism at
-- all — an agent had no way to ask for one, and nothing recorded that they
-- had.
-- ----------------------------------------------------------------------------
create type public.refund_request_status as enum ('pending', 'approved', 'rejected');

create table public.agency_refund_requests (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  order_id uuid references public.orders (id),
  requested_by uuid not null references public.profiles (id),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'USD',
  reason text not null,
  status public.refund_request_status not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_notes text,
  wallet_transaction_id uuid references public.agency_wallet_transactions (id),
  created_at timestamptz not null default now()
);

create index agency_refund_requests_agency_idx on public.agency_refund_requests (agency_id, created_at desc);
create index agency_refund_requests_pending_idx on public.agency_refund_requests (created_at) where status = 'pending';

alter table public.agency_refund_requests enable row level security;

create policy "agency_refund_requests: member reads own agency"
  on public.agency_refund_requests for select to authenticated
  using (public.is_agency_member(agency_id));

create policy "agency_refund_requests: booker submits"
  on public.agency_refund_requests for insert to authenticated
  with check (
    public.is_agency_booker(agency_id)
    and requested_by = auth.uid()
    and (
      order_id is null
      or exists (select 1 from public.orders o where o.id = order_id and o.agency_id = agency_refund_requests.agency_id)
    )
  );

create policy "agency_refund_requests: admin manage"
  on public.agency_refund_requests for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.approve_agency_refund_request(request_id uuid, notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.agency_refund_requests;
  new_tx_id uuid;
begin
  if not public.is_admin() then
    raise exception 'only admins can approve refund requests';
  end if;

  select * into req from public.agency_refund_requests where id = request_id for update;
  if not found then
    raise exception 'refund request not found';
  end if;
  if req.status <> 'pending' then
    raise exception 'refund request already processed';
  end if;

  new_tx_id := public.apply_agency_wallet_transaction(
    req.agency_id, req.amount, 'refund', req.order_id,
    'Refund approved: ' || req.reason
  );

  update public.agency_refund_requests
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
        review_notes = notes, wallet_transaction_id = new_tx_id
    where id = request_id;
end;
$$;

create or replace function public.reject_agency_refund_request(request_id uuid, notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins can reject refund requests';
  end if;

  update public.agency_refund_requests
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_notes = notes
    where id = request_id and status = 'pending';
end;
$$;
