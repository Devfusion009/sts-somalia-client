-- Finance visibility + fee model (D2/D3/D4, locked with the client 08 Sep 2026).
--
-- D3: the STS processing fee becomes a real, customer-visible charge instead
-- of an internal-only number nobody bills. It is order-level, like agency
-- markup — not folded into order_items.unit_price, so it never gets marked
-- up (an agency's margin applies to the visa's net price, not to STS's own
-- fee) and never drifts from what the customer was actually quoted.
--
-- D2: an application entering the admin work queue on submit, whether or not
-- the order was ever paid, meant staff could work an abandoned checkout for
-- free. Enforced as a guard trigger, not a UI convenience — the same
-- reasoning as every other state-machine rule in this module: a check that
-- only lives in a page component is a check a second page can forget.
--
-- D4: no code here refunds anything. There is no generic (non-agency-wallet)
-- refund mechanism anywhere in this codebase yet — building one is a
-- payments-module-wide gap, not something to invent narrowly for visa. The
-- admin UI says so honestly rather than offering a button that doesn't work.

alter table public.orders
  add column fee_total numeric(12,2) not null default 0 check (fee_total >= 0);

comment on column public.orders.fee_total is
  'Order-level platform fee (e.g. visa processing fee) — added on top of subtotal + markup_amount, never marked up itself.';

alter table public.visa_applications
  add column fee_amount numeric(10,2) not null default 0;

comment on column public.visa_applications.fee_amount is
  'Snapshot of the STS fee actually charged at submit time — like price, does not change if visa_types.processing_fee changes later.';

-- ----------------------------------------------------------------------------
-- An application only becomes STS's problem to work once STS has been paid
-- for it. 'submitted' itself is never gated here: the order does not exist
-- yet at the instant submitVisaApplication sets that status (it's created
-- immediately after, in the same action, before checkout) — the real gate
-- belongs on the next transition, when a human actually starts reviewing.
-- ----------------------------------------------------------------------------
create or replace function public.guard_visa_requires_payment_to_review()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_order_status public.order_status;
begin
  if new.status = 'in_review' and old.status = 'submitted' then
    select o.status into v_order_status
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
     where oi.visa_application_id = new.id
     limit 1;

    if v_order_status is null or v_order_status not in ('paid', 'partially_paid') then
      raise exception 'this application has not been paid for yet — nothing to review until the order settles';
    end if;
  end if;
  return new;
end;
$$;

create trigger visa_applications_guard_requires_payment
  before update of status on public.visa_applications
  for each row execute function public.guard_visa_requires_payment_to_review();
