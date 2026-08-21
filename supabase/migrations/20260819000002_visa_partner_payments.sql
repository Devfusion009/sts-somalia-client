-- ============================================================================
-- 1) Visa processing mode: each visa_types row (STS's actual country/product
--    catalog) declares whether STS processes it in-house or hands it to a
--    partner. No real partner vendor is wired yet — this only prepares the
--    catalog + tracking columns so plugging one in later (mirroring the
--    Duffel/Hotelbeds/Zylalabs provider-catalog pattern) is additive.
-- 2) Partial payments: the payments ledger already supports multiple rows
--    per order (one per attempt/gateway) — a deposit now + a balance payment
--    later are just two rows. The only gap was the settlement trigger, which
--    assumed any single succeeded payment finished the order. It now sums
--    succeeded payments and lands the order on 'partially_paid' or 'paid'.
-- ============================================================================

alter table public.visa_types
  add column processing_mode public.visa_processing_mode not null default 'in_house',
  add column partner_provider_key text;

comment on column public.visa_types.partner_provider_key is
  'platform_api_integrations.provider_key of the visa-processing partner handling this country, when processing_mode = partner. Not a hard FK — same convention as other provider_key references in this codebase.';

alter table public.visa_applications
  add column partner_provider_key text,
  add column partner_ref text,
  add column partner_status text,
  add column partner_last_synced_at timestamptz,
  add column partner_raw_payload jsonb;

-- visa_processing lets the visa-processing-partner catalog entries (submit &
-- track applications) live alongside, but stay distinct from, 'visa' (the
-- Zylalabs visa-requirement checker) — different capability, same provider
-- catalog / credentials machinery.
alter table public.platform_api_integrations drop constraint platform_api_integrations_category_check;
alter table public.platform_api_integrations add constraint platform_api_integrations_category_check
  check (category in ('flights', 'hotels', 'visa', 'visa_processing'));

-- ----------------------------------------------------------------------------
-- Settlement: sum succeeded payments instead of reacting to a single row, so
-- a deposit followed by a balance payment settles the order correctly instead
-- of the first payment (of any size) instantly marking it fully 'paid'.
-- ----------------------------------------------------------------------------
create or replace function public.handle_payment_succeeded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  paid_total numeric;
  order_total numeric;
begin
  if new.status = 'succeeded' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.paid_at := coalesce(new.paid_at, now());

    select coalesce(sum(amount), 0) into paid_total
      from public.payments
      where order_id = new.order_id and status = 'succeeded' and id is distinct from new.id;
    paid_total := paid_total + new.amount;

    select total into order_total from public.orders where id = new.order_id;

    update public.orders
      set status = case when paid_total >= order_total then 'paid'::order_status else 'partially_paid'::order_status end,
          paid_at = case when paid_total >= order_total then coalesce(paid_at, now()) else paid_at end
      where id = new.order_id and status in ('pending_payment', 'held', 'partially_paid');
  end if;
  return new;
end;
$$;
