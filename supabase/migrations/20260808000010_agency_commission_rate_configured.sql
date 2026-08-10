-- ============================================================================
-- commission_rate is `numeric not null default 0` — a brand-new agency and
-- one an admin deliberately priced at 0% are indistinguishable today, which
-- is why the agent dashboard's "0% commission" badge reads as a bad deal on
-- day one. This adds an explicit "when was this actually configured"
-- signal, stamped by both write paths that set a real rate (a direct rate
-- edit, or applying a tier's defaults).
-- ============================================================================

alter table public.agencies add column commission_rate_set_at timestamptz;

-- Backfill: an agency with a non-zero rate or an assigned tier was clearly
-- configured already, even though we can't know exactly when — best
-- available signal is its own updated_at.
update public.agencies
set commission_rate_set_at = updated_at
where commission_rate > 0 or tier_id is not null;
