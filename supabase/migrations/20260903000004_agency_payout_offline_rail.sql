-- Payouts become a tracked transfer, not a status flip.
--
-- Until now an admin could only approve a request and then mark it paid,
-- with the actual bank transfer happening entirely off-system and leaving
-- no trace: no record of how the money went out, no reference to match
-- against a bank statement, nothing the agent could look at to see where
-- their money had got to. This is the money-out mirror of what
-- 20260902000002 already built for money in (agency_topup_requests): the
-- same 'offline' / 'online' rail split, the same reference + proof_path
-- evidence, the same payment-proofs bucket.
--
--   offline (today)  an admin goes to the bank, sends it, records what
--                    they did here.
--   online (later)   a disbursement API is called, and its webhook moves
--                    the request through the same states.
--
-- Nothing about the state machine changes when that day comes — only who
-- performs the transitions — which is why the evidence columns below are
-- named for a payment rather than for a bank counter.

alter table public.agency_payout_requests
  add column rail text not null default 'offline' check (rail in ('offline', 'online'));

-- Mirrors PaymentMethodId in modules/payments/registry.ts, minus 'card':
-- money goes out over bank_transfer, the mobile-money rails Somalia
-- actually runs on (evc_plus, zaad, sahal, edahab), or cash_office.
alter table public.agency_payout_requests add column method text;

/** Bank slip number, EVC transaction id — what to match on a statement. */
alter table public.agency_payout_requests add column reference text;

/** payment-proofs/{agency_id}/… — photo of the slip. Same bucket and
    policies as top-up proofs, so the agency already reads its own. */
alter table public.agency_payout_requests add column proof_path text;

/** When the transfer left, which is not when an admin got round to
    recording it — a Thursday bank run entered on Sunday still happened on
    Thursday, and the agent chasing their bank is asking about Thursday. */
alter table public.agency_payout_requests add column sent_at timestamptz;
alter table public.agency_payout_requests add column paid_at timestamptz;
alter table public.agency_payout_requests add column settled_by uuid references public.profiles (id);

/** Why a sent transfer bounced. Distinct from review_note, which is why a
    request was declined before any money moved. */
alter table public.agency_payout_requests add column failure_reason text;

/** Online rail only: which provider handled it and its transaction id. */
alter table public.agency_payout_requests add column provider text;
alter table public.agency_payout_requests add column provider_ref text;

-- 'processing' money is still committed, so it belongs in the same open
-- set as pending and approved.
drop index if exists agency_payout_requests_open_idx;
create index agency_payout_requests_open_idx
  on public.agency_payout_requests (status)
  where status in ('pending', 'approved', 'processing');

-- ----------------------------------------------------------------------------
-- The accounting rule 'processing' has to obey.
-- ----------------------------------------------------------------------------
-- Identical to 20260902000001 except for the open-request filter. A
-- transfer that has been sent but not settled is the LAST moment you want
-- to hand the balance back: the agent could request the same money a
-- second time while the first transfer is still in flight, and the platform
-- would pay twice. In flight means unavailable, until it either lands
-- ('paid', where the commission entries themselves go to 'paid_out') or
-- bounces ('failed', which is what releases it).
create or replace function public.agency_earnings_summary(target_agency_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total numeric;
  v_pending numeric;
  v_confirmed numeric;
  v_paid numeric;
  v_open numeric;
begin
  if not (public.is_agency_member(target_agency_id) or public.is_admin()) then
    raise exception 'not authorised';
  end if;

  select
    coalesce(sum(amount) filter (where status <> 'reversed'), 0),
    coalesce(sum(amount) filter (where status = 'pending'), 0),
    coalesce(sum(amount) filter (where status = 'confirmed'), 0),
    coalesce(sum(amount) filter (where status = 'paid_out'), 0)
    into v_total, v_pending, v_confirmed, v_paid
  from public.agency_commission_entries
  where agency_id = target_agency_id;

  select coalesce(sum(amount), 0) into v_open
  from public.agency_payout_requests
  where agency_id = target_agency_id
    and status in ('pending', 'approved', 'processing');

  return jsonb_build_object(
    'totalEarned', v_total,
    'inReview', v_pending,
    'confirmed', v_confirmed,
    'requested', v_open,
    'available', greatest(v_confirmed - v_open, 0),
    'paidOut', v_paid
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- Admin: the money has left, but hasn't landed.
-- ----------------------------------------------------------------------------
create or replace function public.mark_agency_payout_sent(
  p_request_id uuid,
  p_method text,
  p_reference text default null,
  p_proof_path text default null,
  p_sent_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.agency_payout_requests;
begin
  if not public.is_admin() then
    raise exception 'only admins can record a payout transfer';
  end if;
  if coalesce(btrim(p_method), '') = '' then
    raise exception 'record how the transfer was sent';
  end if;

  select * into req from public.agency_payout_requests where id = p_request_id for update;
  if not found then
    raise exception 'request not found';
  end if;
  if req.status <> 'approved' then
    raise exception 'only an approved request can be sent';
  end if;

  update public.agency_payout_requests
     set status = 'processing',
         method = btrim(p_method),
         reference = nullif(btrim(p_reference), ''),
         proof_path = nullif(btrim(p_proof_path), ''),
         sent_at = coalesce(p_sent_at, now()),
         settled_by = auth.uid()
   where id = p_request_id;

  insert into public.notifications (profile_id, type, title, body, data)
  values (
    req.requested_by,
    'payout_sent',
    'Transfer sent',
    'USD ' || trim_scale(req.amount) || ' is on its way to '
      || coalesce(nullif(btrim(req.bank_name), ''), 'your payout account')
      || case when nullif(btrim(p_reference), '') is not null then ' · ref ' || btrim(p_reference) else '' end,
    jsonb_build_object('agencyId', req.agency_id, 'requestId', req.id)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- Admin: the money landed.
-- ----------------------------------------------------------------------------
-- Dropped rather than replaced: the added parameters would otherwise make
-- the old 3-argument call ambiguous against this one, and PostgREST picks
-- an overload by the argument names it is given.
drop function if exists public.settle_agency_payout_request(uuid, text, text);

create function public.settle_agency_payout_request(
  p_request_id uuid,
  p_method text default null,
  p_reference text default null,
  p_proof_path text default null,
  p_paid_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.agency_payout_requests;
  v_payout_id uuid;
  v_running numeric := 0;
  v_method text;
  v_reference text;
  entry record;
begin
  if not public.is_admin() then
    raise exception 'only admins can settle payouts';
  end if;

  select * into req from public.agency_payout_requests where id = p_request_id for update;
  if not found then
    raise exception 'request not found';
  end if;
  -- 'approved' too, not just 'processing': a same-bank transfer clears
  -- while the admin is still standing there, and forcing it through an
  -- in-transit state it was never in would be bookkeeping theatre.
  if req.status not in ('approved', 'processing') then
    raise exception 'only an approved or in-transit request can be settled';
  end if;

  v_method := coalesce(nullif(btrim(p_method), ''), req.method, 'bank_transfer');
  v_reference := coalesce(nullif(btrim(p_reference), ''), req.reference);

  insert into public.agency_commission_payouts
    (agency_id, amount, method, payout_reference, created_by, status, paid_at)
  values (req.agency_id, req.amount, v_method, v_reference, auth.uid(), 'paid', coalesce(p_paid_at, now()))
  returning id into v_payout_id;

  for entry in
    select id, amount from public.agency_commission_entries
     where agency_id = req.agency_id and status = 'confirmed'
     order by created_at for update
  loop
    exit when v_running + entry.amount > req.amount;
    update public.agency_commission_entries set status = 'paid_out' where id = entry.id;
    v_running := v_running + entry.amount;
  end loop;

  update public.agency_payout_requests
     set status = 'paid',
         payout_id = v_payout_id,
         method = v_method,
         reference = v_reference,
         proof_path = coalesce(nullif(btrim(p_proof_path), ''), proof_path),
         paid_at = coalesce(p_paid_at, now()),
         settled_by = auth.uid(),
         reviewed_by = coalesce(reviewed_by, auth.uid()),
         reviewed_at = coalesce(reviewed_at, now())
   where id = p_request_id;

  insert into public.notifications (profile_id, type, title, body, data)
  values (
    req.requested_by,
    'payout_paid',
    'Payout paid',
    'USD ' || trim_scale(req.amount) || ' was transferred to '
      || coalesce(nullif(btrim(req.bank_name), ''), 'your payout account')
      || case when v_reference is not null then ' · ref ' || v_reference else '' end,
    jsonb_build_object('agencyId', req.agency_id, 'requestId', req.id, 'payoutId', v_payout_id)
  );

  return v_payout_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Admin: the transfer bounced.
-- ----------------------------------------------------------------------------
create or replace function public.fail_agency_payout_request(
  p_request_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.agency_payout_requests;
begin
  if not public.is_admin() then
    raise exception 'only admins can fail a payout';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'a reason is required';
  end if;

  select * into req from public.agency_payout_requests where id = p_request_id for update;
  if not found then
    raise exception 'request not found';
  end if;
  if req.status not in ('approved', 'processing') then
    raise exception 'only an approved or in-transit request can fail';
  end if;

  update public.agency_payout_requests
     set status = 'failed',
         failure_reason = btrim(p_reason),
         settled_by = auth.uid()
   where id = p_request_id;

  insert into public.notifications (profile_id, type, title, body, data)
  values (
    req.requested_by,
    'payout_failed',
    'Transfer failed',
    'USD ' || trim_scale(req.amount) || ' did not go through. ' || btrim(p_reason),
    jsonb_build_object('agencyId', req.agency_id, 'requestId', req.id)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- The four numbers the admin withdrawals queue opens with.
-- ----------------------------------------------------------------------------
-- Same reasoning as agency_earnings_summary: computed here rather than by
-- pulling every request to the server and summing it there, and 'paid this
-- month' is a moving window nobody should re-derive per page.
create or replace function public.admin_payout_queue_totals()
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

  return (
    select jsonb_build_object(
      'toReviewCount', count(*) filter (where status = 'pending'),
      'toReviewAmount', coalesce(sum(amount) filter (where status = 'pending'), 0),
      'toPayCount', count(*) filter (where status = 'approved'),
      'toPayAmount', coalesce(sum(amount) filter (where status = 'approved'), 0),
      'inTransitCount', count(*) filter (where status = 'processing'),
      'inTransitAmount', coalesce(sum(amount) filter (where status = 'processing'), 0),
      'paidThisMonth', coalesce(
        sum(amount) filter (
          where status = 'paid'
            and coalesce(paid_at, reviewed_at, requested_at) >= date_trunc('month', now())
        ), 0)
    )
    from public.agency_payout_requests
  );
end;
$$;
