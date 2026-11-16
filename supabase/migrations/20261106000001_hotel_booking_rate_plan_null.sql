-- A hotel booking made without a rate plan stored the JSON literal `null` in
-- hotel_bookings.rate_plan (quote_hotel_stay builds 'rate_plan' => null and
-- the price guard copies it with `->`). hotel_refund_quote treats any
-- non-SQL-NULL rate_plan as a plan with no known policy and quotes a 100%
-- deduction, so customers on these bookings were told nothing is refundable.
--
-- 1. Normalise the value on every write, after the price guard has run.
-- 2. Backfill rows already stored that way.
-- 3. Make the quote read only a real snapshot object as a rate plan.

create or replace function public.hotel_bookings_rate_plan_null()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.rate_plan is not null and jsonb_typeof(new.rate_plan) <> 'object' then
    new.rate_plan := null;
  end if;
  return new;
end;
$$;

-- "ab_" sorts straight after aa_hotel_bookings_price_guard, which sets rate_plan.
drop trigger if exists ab_hotel_bookings_rate_plan_null on public.hotel_bookings;
create trigger ab_hotel_bookings_rate_plan_null
  before insert or update of rate_plan on public.hotel_bookings
  for each row execute function public.hotel_bookings_rate_plan_null();

update public.hotel_bookings
   set rate_plan = null
 where rate_plan is not null and jsonb_typeof(rate_plan) <> 'object';

CREATE OR REPLACE FUNCTION public.hotel_refund_quote(p_booking_id uuid, p_as_of date DEFAULT CURRENT_DATE)
 RETURNS TABLE(days_before integer, deduction_percent numeric, paid_amount numeric, refund_amount numeric, currency text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  hb public.hotel_bookings;
  v_partner uuid;
  v_days integer;
  v_pct numeric;
  v_paid numeric;
  v_order uuid;
  v_has_rules boolean;
begin
  select * into hb from public.hotel_bookings where id = p_booking_id;
  if not found then
    return;
  end if;

  select partner_id into v_partner from public.hotels where id = hb.hotel_id;
  if not (
    public.is_admin()
    or public.is_hotel_manager(hb.hotel_id)
    or public.is_hotel_partner_member(v_partner)
    or exists (
      select 1 from public.order_items oi
       where oi.hotel_booking_id = hb.id and public.can_access_order(oi.order_id)
    )
  ) then
    return;
  end if;

  v_days := greatest(hb.check_in - p_as_of, 0);
  v_has_rules := exists (select 1 from public.hotel_refund_rules r where r.hotel_id = hb.hotel_id);

  if hb.rate_plan ->> 'cancellation' = 'non_refundable' then
    v_pct := 100;
  elsif hb.rate_plan ->> 'cancellation' = 'flexible'
        and hb.check_in - p_as_of >= coalesce((hb.rate_plan ->> 'free_cancel_days')::integer, 0) then
    v_pct := 0;
  elsif v_has_rules then
    select r.deduction_percent into v_pct
      from public.hotel_refund_rules r
     where r.hotel_id = hb.hotel_id and r.days_before <= v_days
     order by r.days_before desc
     limit 1;
    v_pct := coalesce(v_pct, 100);
  elsif jsonb_typeof(hb.rate_plan) = 'object' then
    v_pct := 100;
  end if;

  select oi.order_id into v_order from public.order_items oi where oi.hotel_booking_id = hb.id limit 1;
  -- A desk booking marked paid has no payment rows; it was paid in full.
  v_paid := case
    when v_order is not null then public._order_amount_paid(v_order)
    when hb.paid_at is not null then hb.total_price
    else 0
  end;

  return query select
    v_days,
    v_pct,
    v_paid,
    case when v_pct is null then null else round(v_paid * (100 - v_pct) / 100, 2) end,
    hb.currency;
end;
$function$

;
