-- An Umrah booking made after its balance due date (departure minus
-- balance_due_days) still offered a deposit and showed a due date in the
-- past. Inside that window the full amount is due at booking.

CREATE OR REPLACE FUNCTION public._umrah_order_terms(p_order_id uuid, OUT deposit_percent numeric, OUT due_date date)
 RETURNS record
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_kind text;
  v_pkg_pct numeric;
  v_pkg_days smallint;
  v_departure date;
  v_days numeric;
begin
  select b.booking_kind, pkg.deposit_percent, pkg.balance_due_days,
         coalesce(d.departure_date, cr.departure_date)
    into v_kind, v_pkg_pct, v_pkg_days, v_departure
    from public.order_items oi
    join public.umrah_bookings b on b.id = oi.umrah_booking_id
    left join public.umrah_packages pkg on pkg.id = b.package_id
    left join public.umrah_package_departures d on d.id = b.departure_id
    left join public.umrah_custom_requests cr on cr.id = b.custom_request_id
   where oi.order_id = p_order_id
   limit 1;
  if v_kind is null then
    return;
  end if;

  if v_kind = 'group' then
    deposit_percent := v_pkg_pct;
    v_days := v_pkg_days;
  else
    begin
      deposit_percent := (public.umrah_setting('privateDepositPercent'))::text::numeric;
      v_days := (public.umrah_setting('privateBalanceDueDays'))::text::numeric;
    exception when others then
      deposit_percent := null;
      v_days := null;
    end;
    v_days := coalesce(v_days, 30);
  end if;

  if deposit_percent is not null and (deposit_percent < 0 or deposit_percent > 100) then
    deposit_percent := null;
  end if;
  if v_departure is not null then
    due_date := v_departure - v_days::int;
  end if;
  -- Booked inside the balance window: the full amount is due now (100%, not
  -- null — null means the platform-wide deposit) and no due date in the past.
  if due_date is not null and due_date <= current_date then
    deposit_percent := 100;
    due_date := current_date;
  end if;
end;
$function$;

-- Re-apply to unpaid orders already caught by this.
update public.orders o
   set min_first_payment = o.total,
       balance_due_at = current_date
 where o.status = 'pending_payment'
   and o.balance_due_at < current_date
   and exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.umrah_booking_id is not null);
