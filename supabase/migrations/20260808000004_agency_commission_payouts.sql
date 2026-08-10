-- ============================================================================
-- Agency commission payout tracking — mirrors the affiliate commission_payouts
-- table/pattern (which already existed but, on inspection, was never
-- actually written to by any code path — read-only schema). Building the
-- real version here for agencies since that's what Part 4 of the commission
-- section needs; the affiliate side has the identical gap, noted for later.
-- ============================================================================

create table public.agency_commission_payouts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'USD',
  status public.payout_status not null default 'paid',
  method text,
  payout_reference text,
  period_start date,
  period_end date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  paid_at timestamptz not null default now()
);

create index agency_commission_payouts_agency_idx on public.agency_commission_payouts (agency_id, created_at desc);

alter table public.agency_commission_payouts enable row level security;

create policy "agency_commission_payouts: members read own"
  on public.agency_commission_payouts for select to authenticated
  using (public.is_agency_member(agency_id));

create policy "agency_commission_payouts: admin manage"
  on public.agency_commission_payouts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Records a payout and marks the corresponding confirmed commission
-- entries as paid_out in one atomic step, so the ledger and the payout
-- record can never drift (same "one function does the whole state
-- transition" pattern as cancel_order / apply_agency_wallet_transaction).
create or replace function public.record_agency_commission_payout(
  target_agency_id uuid,
  payout_amount numeric,
  payout_method text default null,
  payout_ref text default null,
  target_period_start date default null,
  target_period_end date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_payout_id uuid;
begin
  if not public.is_admin() then
    raise exception 'only admins can record commission payouts';
  end if;

  insert into public.agency_commission_payouts
    (agency_id, amount, method, payout_reference, period_start, period_end, created_by, status, paid_at)
  values
    (target_agency_id, payout_amount, payout_method, payout_ref, target_period_start, target_period_end, auth.uid(), 'paid', now())
  returning id into new_payout_id;

  update public.agency_commission_entries
    set status = 'paid_out'
    where agency_id = target_agency_id
      and status = 'confirmed'
      and (target_period_start is null or created_at::date >= target_period_start)
      and (target_period_end is null or created_at::date <= target_period_end);

  return new_payout_id;
end;
$$;
