-- Agency earnings become a reviewed, withdrawable balance.
--
-- Before this, a commission entry was written straight to 'confirmed' the
-- moment an order was paid, and the only way money ever left the ledger was
-- an admin manually recording a payout that had already happened outside
-- the system. The agent had no way to ask for their money and no signal
-- about what was actually theirs to take. The 'pending' value on
-- commission_entry_status existed but nothing ever wrote it.
--
-- The flow this establishes, end to end:
--   order paid  -> entry lands 'pending'      (In review — admin has to check it)
--   admin approves -> entry 'confirmed'       (Available — agent can withdraw)
--   agent requests -> agency_payout_requests  (Requested — held out of available)
--   admin settles  -> entry 'paid_out'        (Paid — bank transfer recorded)
-- Rejecting an entry sends it to 'reversed', which every earnings total
-- already excludes.

-- ----------------------------------------------------------------------------
-- 1) Commission entries now land pending, not confirmed.
-- ----------------------------------------------------------------------------
alter table public.agency_commission_entries
  alter column status set default 'pending';

-- Same settlement trigger as 20260806000001_b2b_v3.sql, with the status
-- written explicitly: a reader shouldn't have to know the column default to
-- know that new commission is unreviewed. Rows written before this
-- migration keep 'confirmed' — they were approved by the old rule, and
-- retroactively putting settled money back into review would be wrong.
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
      (agency_id, order_id, rate_applied, commission_amount, markup_amount, amount, status)
    select
      new.agency_id,
      new.id,
      a.commission_rate,
      round((new.total - new.markup_amount) * a.commission_rate / 100.0, 2),
      new.markup_amount,
      round((new.total - new.markup_amount) * a.commission_rate / 100.0, 2) + new.markup_amount,
      'pending'
    from public.agencies a
    where a.id = new.agency_id
    on conflict (order_id) do nothing;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) Payout requests — the agent's side of "transfer my earnings to my bank".
-- ----------------------------------------------------------------------------
create type public.payout_request_status as enum ('pending', 'approved', 'rejected', 'paid');

create table public.agency_payout_requests (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'USD',
  status public.payout_request_status not null default 'pending',
  -- Snapshot, not a join: the agency can edit its bank details at any time,
  -- and a paid request has to keep showing the account the money actually
  -- went to.
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  requested_by uuid not null references public.profiles (id),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_note text,
  payout_id uuid references public.agency_commission_payouts (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agency_payout_requests_agency_idx
  on public.agency_payout_requests (agency_id, requested_at desc);

create index agency_payout_requests_open_idx
  on public.agency_payout_requests (status)
  where status in ('pending', 'approved');

create trigger set_agency_payout_requests_updated_at
  before update on public.agency_payout_requests
  for each row execute function public.set_updated_at();

alter table public.agency_payout_requests enable row level security;

create policy "agency_payout_requests: members read own"
  on public.agency_payout_requests for select to authenticated
  using (public.is_agency_member(agency_id));

-- Same "withdraw while still pending" affordance agency_markup_requests has.
create policy "agency_payout_requests: owner cancels pending"
  on public.agency_payout_requests for delete to authenticated
  using (public.is_agency_owner_or_admin(agency_id) and status = 'pending');

create policy "agency_payout_requests: admin manage"
  on public.agency_payout_requests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3) One place that answers "where is this agency's money".
-- ----------------------------------------------------------------------------
-- Every surface (agent Overview, agent Withdraw, admin agency console) reads
-- these same six numbers, so they're computed once here rather than summed
-- from a ledger that grows unbounded on the client. `available` nets out
-- requests already in flight — otherwise an agent could request the same
-- balance twice before the first one settles.
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
  where agency_id = target_agency_id and status in ('pending', 'approved');

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
-- 4) Agent side: ask for a transfer.
-- ----------------------------------------------------------------------------
create or replace function public.request_agency_payout(
  p_agency_id uuid,
  p_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_available numeric;
  v_agency public.agencies;
begin
  if not public.is_agency_owner_or_admin(p_agency_id) then
    raise exception 'only the agency owner or an admin can request a payout';
  end if;

  select * into v_agency from public.agencies where id = p_agency_id;
  if not found then
    raise exception 'agency not found';
  end if;
  if coalesce(btrim(v_agency.bank_account_number), '') = '' then
    raise exception 'add your bank details before requesting a payout';
  end if;

  v_available := (public.agency_earnings_summary(p_agency_id) ->> 'available')::numeric;

  if p_amount is null or p_amount <= 0 then
    raise exception 'enter an amount greater than zero';
  end if;
  if p_amount > v_available then
    raise exception 'you can request up to USD %', trim_scale(v_available);
  end if;

  insert into public.agency_payout_requests
    (agency_id, amount, bank_name, bank_account_name, bank_account_number, requested_by)
  values
    (p_agency_id, p_amount, v_agency.bank_name, v_agency.bank_account_name,
     v_agency.bank_account_number, auth.uid())
  returning id into v_request_id;

  insert into public.notifications (profile_id, type, title, body, data)
  select p.id,
         'payout_request',
         'Payout request awaiting review',
         v_agency.name || ' requested a transfer of USD ' || trim_scale(p_amount) || '.',
         jsonb_build_object('agencyId', p_agency_id, 'requestId', v_request_id)
  from public.profiles p
  where p.is_platform_admin;

  return v_request_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) Admin side: review earnings, then review and settle payout requests.
-- ----------------------------------------------------------------------------
-- Approving is what makes commission real money to the agent, so it is a
-- deliberate act on named entries rather than a blanket "approve all" —
-- p_entry_ids is what the admin actually ticked in the console.
create or replace function public.review_agency_commission_entries(
  p_entry_ids uuid[],
  p_decision text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_status public.commission_entry_status;
  v_count integer;
  v_amount numeric;
  v_agency_id uuid;
begin
  if not public.is_admin() then
    raise exception 'only admins can review earnings';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid decision';
  end if;
  v_new_status := case when p_decision = 'approved' then 'confirmed' else 'reversed' end;

  with updated as (
    update public.agency_commission_entries
       set status = v_new_status
     where id = any(p_entry_ids)
       and status = 'pending'
    returning agency_id, amount
  )
  select count(*), coalesce(sum(amount), 0), (array_agg(agency_id))[1]
    into v_count, v_amount, v_agency_id
  from updated;

  if v_count = 0 then
    return 0;
  end if;

  -- One notification per review action, not per entry: an admin clearing a
  -- month of bookings would otherwise bury the agent's bell.
  insert into public.notifications (profile_id, type, title, body, data)
  select m.profile_id,
         'earnings_reviewed',
         case when p_decision = 'approved' then 'Earnings approved' else 'Earnings reversed' end,
         case
           when p_decision = 'approved'
             then 'USD ' || trim_scale(v_amount) || ' is now available to withdraw.'
           else 'USD ' || trim_scale(v_amount) || ' was reversed after review.'
         end,
         jsonb_build_object('agencyId', v_agency_id, 'decision', p_decision)
  from public.agency_members m
  where m.agency_id = v_agency_id
    and m.status = 'active'
    and m.role_in_agency in ('owner', 'admin');

  return v_count;
end;
$$;

create or replace function public.review_agency_payout_request(
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
  req public.agency_payout_requests;
begin
  if not public.is_admin() then
    raise exception 'only admins can review payout requests';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid decision';
  end if;
  if p_decision = 'rejected' and coalesce(btrim(p_note), '') = '' then
    raise exception 'a note is required when rejecting';
  end if;

  select * into req from public.agency_payout_requests where id = p_request_id for update;
  if not found then
    raise exception 'request not found';
  end if;
  if req.status <> 'pending' then
    raise exception 'request already reviewed';
  end if;

  update public.agency_payout_requests
     set status = p_decision::public.payout_request_status,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_note = nullif(btrim(p_note), '')
   where id = p_request_id;

  insert into public.notifications (profile_id, type, title, body, data)
  values (
    req.requested_by,
    'payout_request_reviewed',
    case when p_decision = 'approved' then 'Payout approved' else 'Payout request declined' end,
    'USD ' || trim_scale(req.amount)
      || case when p_decision = 'approved' then ' is approved for transfer.' else ' was not approved.' end
      || case when nullif(btrim(p_note), '') is not null then ' ' || btrim(p_note) else '' end,
    jsonb_build_object('agencyId', req.agency_id, 'requestId', req.id, 'decision', p_decision)
  );
end;
$$;

-- Settling is the only step that moves entries to 'paid_out'. Entries are
-- indivisible, so they're consumed oldest-first up to the amount actually
-- transferred; a remainder smaller than the next entry stays available
-- rather than being silently swallowed by this payout.
create or replace function public.settle_agency_payout_request(
  p_request_id uuid,
  p_method text default null,
  p_reference text default null
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
  entry record;
begin
  if not public.is_admin() then
    raise exception 'only admins can settle payouts';
  end if;

  select * into req from public.agency_payout_requests where id = p_request_id for update;
  if not found then
    raise exception 'request not found';
  end if;
  if req.status <> 'approved' then
    raise exception 'only an approved request can be settled';
  end if;

  insert into public.agency_commission_payouts
    (agency_id, amount, method, payout_reference, created_by, status, paid_at)
  values
    (req.agency_id, req.amount, p_method, p_reference, auth.uid(), 'paid', now())
  returning id into v_payout_id;

  for entry in
    select id, amount
      from public.agency_commission_entries
     where agency_id = req.agency_id and status = 'confirmed'
     order by created_at
     for update
  loop
    exit when v_running + entry.amount > req.amount;
    update public.agency_commission_entries set status = 'paid_out' where id = entry.id;
    v_running := v_running + entry.amount;
  end loop;

  update public.agency_payout_requests
     set status = 'paid',
         payout_id = v_payout_id,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_request_id;

  insert into public.notifications (profile_id, type, title, body, data)
  values (
    req.requested_by,
    'payout_paid',
    'Payout sent',
    'USD ' || trim_scale(req.amount) || ' was transferred to '
      || coalesce(nullif(btrim(req.bank_name), ''), 'your bank account')
      || case when nullif(btrim(p_reference), '') is not null then ' · ref ' || btrim(p_reference) else '' end,
    jsonb_build_object('agencyId', req.agency_id, 'requestId', req.id, 'payoutId', v_payout_id)
  );

  return v_payout_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6) Sidebar badge: both new decisions land on the Agencies console.
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
      (select count(*) from public.agency_payout_requests where status in ('pending', 'approved'))
  );
end;
$$;
