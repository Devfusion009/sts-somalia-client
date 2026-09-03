-- Funding the agency wallet becomes a real flow instead of a WhatsApp message.
--
-- Two rails, one record. `agency_topup_requests` is the single place money
-- entering a wallet is tracked, whichever way it arrives:
--
--   offline  — the way STS works today: the agent pays by bank transfer,
--              EVC Plus, or cash at an office, files the request with a
--              reference (and optionally a photo of the receipt), and an
--              admin approves it once the money lands. Approval is what
--              credits the wallet.
--   online   — the agent pays a gateway from inside the app. The same row
--              is settled by the gateway's confirmation instead of a human.
--
-- Both rails end in exactly one place: a 'deposit' row on
-- agency_wallet_transactions, written by credit_agency_wallet_internal.
-- Nothing else may credit a wallet, so the balance can never diverge from
-- the ledger regardless of which rail (or which future gateway) was used.

-- ----------------------------------------------------------------------------
-- 1) One internal credit path, shared by every caller.
-- ----------------------------------------------------------------------------
-- Extracted verbatim from apply_agency_wallet_transaction's body. It carries
-- NO permission check of its own — that is the point: each caller above it
-- enforces its own rule (a member spending, an admin crediting, a gateway
-- settling), and they all land on the same locked balance update. EXECUTE is
-- revoked from every client role so it is reachable only from the
-- security-definer functions below.
create or replace function public.credit_agency_wallet_internal(
  target_agency_id uuid,
  tx_amount numeric,
  tx_type public.wallet_tx_type,
  target_order_id uuid default null,
  tx_note text default null,
  actor uuid default null
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
    (target_agency_id, tx_type, tx_amount, new_balance, target_order_id, tx_note, actor)
  returning id into new_tx_id;

  return new_tx_id;
end;
$$;

revoke execute on function public.credit_agency_wallet_internal(uuid, numeric, public.wallet_tx_type, uuid, text, uuid)
  from public, anon, authenticated;

-- Unchanged contract and unchanged permission rules — the balance mutation
-- just moved into the shared helper.
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

  return public.credit_agency_wallet_internal(
    target_agency_id, tx_amount, tx_type, target_order_id, tx_note, auth.uid()
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) The top-up record.
-- ----------------------------------------------------------------------------
create type public.topup_status as enum ('pending', 'approved', 'rejected', 'cancelled', 'failed');

create table public.agency_topup_requests (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'USD',
  -- 'offline' waits on an admin; 'online' waits on a gateway.
  rail text not null check (rail in ('offline', 'online')),
  -- Mirrors PaymentMethodId in modules/payments/registry.ts so the same
  -- method list drives checkout and funding: bank_transfer, cash_office,
  -- card, evc_plus, zaad, sahal, edahab.
  method text not null,
  status public.topup_status not null default 'pending',
  /** Agent's own evidence: transfer ref, EVC transaction id, receipt no. */
  reference text,
  /** payment-proofs/{agency_id}/… — a photo of the slip, optional. */
  proof_path text,
  note text,
  /** Online rail only: which gateway, and its session/transaction id. */
  provider text,
  provider_ref text,
  requested_by uuid not null references public.profiles (id),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_note text,
  wallet_transaction_id uuid references public.agency_wallet_transactions (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agency_topup_requests_agency_idx
  on public.agency_topup_requests (agency_id, requested_at desc);

create index agency_topup_requests_pending_idx
  on public.agency_topup_requests (requested_at)
  where status = 'pending';

create index agency_topup_requests_provider_ref_idx
  on public.agency_topup_requests (provider_ref)
  where provider_ref is not null;

create trigger set_agency_topup_requests_updated_at
  before update on public.agency_topup_requests
  for each row execute function public.set_updated_at();

alter table public.agency_topup_requests enable row level security;

create policy "agency_topup_requests: members read own"
  on public.agency_topup_requests for select to authenticated
  using (public.is_agency_member(agency_id));

create policy "agency_topup_requests: admin manage"
  on public.agency_topup_requests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3) Proof-of-payment uploads.
-- ----------------------------------------------------------------------------
-- Private bucket, path payment-proofs/{agency_id}/{file}. The folder is
-- compared as text rather than cast to uuid: a malformed object name would
-- make a cast raise inside the policy instead of simply failing to match.
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

create policy "payment-proofs: agency members read own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] in (
      select agency_id::text from public.agency_members
      where profile_id = auth.uid() and status = 'active'
    )
  );

create policy "payment-proofs: agency members upload own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] in (
      select agency_id::text from public.agency_members
      where profile_id = auth.uid() and status = 'active'
    )
  );

create policy "payment-proofs: admin all"
  on storage.objects for all to authenticated
  using (bucket_id = 'payment-proofs' and public.is_admin())
  with check (bucket_id = 'payment-proofs' and public.is_admin());

-- ----------------------------------------------------------------------------
-- 4) Agent files a top-up.
-- ----------------------------------------------------------------------------
create or replace function public.request_agency_topup(
  p_agency_id uuid,
  p_amount numeric,
  p_rail text,
  p_method text,
  p_reference text default null,
  p_proof_path text default null,
  p_note text default null,
  p_provider text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_agency_name text;
begin
  if not public.is_agency_owner_or_admin(p_agency_id) then
    raise exception 'only the agency owner or an admin can add money';
  end if;
  if p_rail not in ('offline', 'online') then
    raise exception 'invalid rail';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'enter an amount greater than zero';
  end if;
  if p_amount > 1000000 then
    raise exception 'that amount is too large — contact STS to arrange it';
  end if;

  insert into public.agency_topup_requests
    (agency_id, amount, rail, method, reference, proof_path, note, provider, requested_by)
  values
    (p_agency_id, p_amount, p_rail, p_method, nullif(btrim(p_reference), ''),
     nullif(btrim(p_proof_path), ''), nullif(btrim(p_note), ''), p_provider, auth.uid())
  returning id into v_request_id;

  -- Only the offline rail needs a human. An online top-up that never
  -- completes is the agent's to retry, not an admin's to chase.
  if p_rail = 'offline' then
    select name into v_agency_name from public.agencies where id = p_agency_id;
    insert into public.notifications (profile_id, type, title, body, data)
    select p.id,
           'topup_request',
           'Wallet top-up awaiting confirmation',
           v_agency_name || ' says they sent USD ' || trim_scale(p_amount)
             || case when nullif(btrim(p_reference), '') is not null then ' · ref ' || btrim(p_reference) else '' end || '.',
           jsonb_build_object('agencyId', p_agency_id, 'requestId', v_request_id)
    from public.profiles p
    where p.is_platform_admin;
  end if;

  return v_request_id;
end;
$$;

create or replace function public.cancel_agency_topup(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.agency_topup_requests;
begin
  select * into req from public.agency_topup_requests where id = p_request_id for update;
  if not found then
    raise exception 'request not found';
  end if;
  if not public.is_agency_owner_or_admin(req.agency_id) then
    raise exception 'not authorised';
  end if;
  if req.status <> 'pending' then
    raise exception 'this top-up has already been processed';
  end if;

  update public.agency_topup_requests
     set status = 'cancelled', reviewed_at = now()
   where id = p_request_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) Admin confirms the money arrived (the offline rail's settlement).
-- ----------------------------------------------------------------------------
create or replace function public.review_agency_topup(
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
  req public.agency_topup_requests;
  v_tx_id uuid;
begin
  if not public.is_admin() then
    raise exception 'only admins can confirm a top-up';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid decision';
  end if;
  if p_decision = 'rejected' and coalesce(btrim(p_note), '') = '' then
    raise exception 'a note is required when rejecting';
  end if;

  select * into req from public.agency_topup_requests where id = p_request_id for update;
  if not found then
    raise exception 'request not found';
  end if;
  if req.status <> 'pending' then
    raise exception 'this top-up has already been processed';
  end if;

  if p_decision = 'approved' then
    v_tx_id := public.credit_agency_wallet_internal(
      req.agency_id, req.amount, 'deposit', null,
      'Top-up · ' || req.method || coalesce(' · ref ' || req.reference, ''),
      auth.uid()
    );
  end if;

  update public.agency_topup_requests
     set status = p_decision::public.topup_status,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_note = nullif(btrim(p_note), ''),
         wallet_transaction_id = v_tx_id
   where id = p_request_id;

  insert into public.notifications (profile_id, type, title, body, data)
  values (
    req.requested_by,
    'topup_reviewed',
    case when p_decision = 'approved' then 'Wallet topped up' else 'Top-up not confirmed' end,
    'USD ' || trim_scale(req.amount)
      || case when p_decision = 'approved' then ' was added to your wallet.' else ' could not be confirmed.' end
      || case when nullif(btrim(p_note), '') is not null then ' ' || btrim(p_note) else '' end,
    jsonb_build_object('agencyId', req.agency_id, 'requestId', req.id, 'decision', p_decision)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 6) A gateway confirms (the online rail's settlement).
-- ----------------------------------------------------------------------------
-- Callable only by the service role (webhooks and the server action that
-- just received a verified provider success) or an admin — never by the
-- agent's own session, which is what stops a client from self-crediting.
-- Idempotent on purpose: gateways retry webhooks, and a second delivery for
-- an already-approved row must not credit the wallet twice.
create or replace function public.settle_agency_topup(
  p_request_id uuid,
  p_provider_ref text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.agency_topup_requests;
  v_tx_id uuid;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorised to settle a top-up';
  end if;

  select * into req from public.agency_topup_requests where id = p_request_id for update;
  if not found then
    raise exception 'request not found';
  end if;
  if req.status = 'approved' then
    return req.wallet_transaction_id;
  end if;
  if req.status <> 'pending' then
    raise exception 'this top-up has already been processed';
  end if;

  v_tx_id := public.credit_agency_wallet_internal(
    req.agency_id, req.amount, 'deposit', null,
    'Top-up · ' || req.method || coalesce(' · ' || p_provider_ref, ''),
    req.requested_by
  );

  update public.agency_topup_requests
     set status = 'approved',
         provider_ref = coalesce(p_provider_ref, provider_ref),
         reviewed_at = now(),
         wallet_transaction_id = v_tx_id
   where id = p_request_id;

  insert into public.notifications (profile_id, type, title, body, data)
  values (
    req.requested_by,
    'topup_reviewed',
    'Wallet topped up',
    'USD ' || trim_scale(req.amount) || ' was added to your wallet.',
    jsonb_build_object('agencyId', req.agency_id, 'requestId', req.id, 'decision', 'approved')
  );

  return v_tx_id;
end;
$$;

create or replace function public.fail_agency_topup(
  p_request_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorised';
  end if;

  update public.agency_topup_requests
     set status = 'failed',
         review_note = nullif(btrim(p_reason), ''),
         reviewed_at = now()
   where id = p_request_id and status = 'pending';
end;
$$;

-- ----------------------------------------------------------------------------
-- 7) Sidebar badge.
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
      (select count(*) from public.agency_markup_requests where status = 'pending'),
    'earnings_reviews',
      (select count(*) from public.agency_commission_entries where status = 'pending'),
    'payout_requests',
      (select count(*) from public.agency_payout_requests where status in ('pending', 'approved')),
    'topup_requests',
      (select count(*) from public.agency_topup_requests where status = 'pending' and rail = 'offline')
  );
end;
$$;
