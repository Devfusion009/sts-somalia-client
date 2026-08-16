-- ============================================================================
-- Affiliate commission payouts — closes the exact gap the agency commission
-- payout migration (20260808000004) flagged as "noted for later": the
-- affiliate `commission_payouts` table has existed since the original
-- affiliates migration but nothing has ever written to it — no RPC, no
-- admin action. This is that write path, a direct structural clone of
-- record_agency_commission_payout() adapted to affiliate_conversions'
-- status naming (approved -> paid, vs. agency's confirmed -> paid_out).
--
-- Also: per product decision, affiliate commissions skip a manual
-- approval step entirely (matching how agency_commission_entries already
-- behaves — they default straight to 'confirmed', never sit in 'pending')
-- — a commission becomes payable the moment the order is paid. The
-- `pending` and `reversed` values stay in conversion_status for now
-- (reversed remains meaningful for a future refund-handling pass; pending
-- is simply never assigned by new rows going forward).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) commission_payouts: add method/created_by, matching
--    agency_commission_payouts' richer shape (audit trail: how the money
--    actually moved, and which admin recorded it).
-- ----------------------------------------------------------------------------
alter table public.commission_payouts
  add column method text,
  add column created_by uuid references public.profiles (id);

-- ----------------------------------------------------------------------------
-- 2) affiliates.total_earned / total_paid — dead columns, never written by
--    any code path (confirmed: default 0, no INSERT/UPDATE anywhere sets
--    them), yet displayed on the affiliate's own dashboard and the admin
--    partner console as if they were real running totals — always
--    silently reading $0.00. Dropped rather than left in place: a
--    numeric column on a money table that looks authoritative but never
--    updates is worse than no column at all — a future reader has no way
--    to tell it's dead without this comment. Both call sites are updated
--    in the same change to compute the real totals live from
--    affiliate_conversions/commission_payouts instead (the same "no
--    denormalized counter to keep in sync" approach the agency side
--    already uses — see agencies/queries.ts).
-- ----------------------------------------------------------------------------
alter table public.affiliates
  drop column total_earned,
  drop column total_paid;

-- ----------------------------------------------------------------------------
-- 3) record_affiliate_conversion(): insert as 'approved', not 'pending' —
--    the only change from the original (20260806000001_b2b_v3.sql). Skips
--    the approval step per the product decision above.
-- ----------------------------------------------------------------------------
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
           round(new.total * a.commission_rate / 100.0, 2), 'approved'
    from public.affiliates a where a.id = new.affiliate_id
    on conflict (order_id) do nothing;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) record_affiliate_commission_payout(): records a payout already sent
--    outside the system, and marks the matching approved conversions as
--    paid — atomically, so the conversion ledger and the payout record
--    can never drift apart. Direct clone of
--    record_agency_commission_payout(), same "one function does the
--    whole state transition" pattern.
-- ----------------------------------------------------------------------------
create or replace function public.record_affiliate_commission_payout(
  target_affiliate_id uuid,
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

  insert into public.commission_payouts
    (affiliate_id, amount, method, payout_reference, period_start, period_end, created_by, status, paid_at)
  values
    (target_affiliate_id, payout_amount, payout_method, payout_ref, target_period_start, target_period_end, auth.uid(), 'paid', now())
  returning id into new_payout_id;

  update public.affiliate_conversions
    set status = 'paid'
    where affiliate_id = target_affiliate_id
      and status = 'approved'
      and (target_period_start is null or created_at::date >= target_period_start)
      and (target_period_end is null or created_at::date <= target_period_end);

  return new_payout_id;
end;
$$;
