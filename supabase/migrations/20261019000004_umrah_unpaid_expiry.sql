-- Unpaid group bookings stop holding seats forever.
--
-- umrah_booking_holds_seats counts 'pending', so an abandoned checkout kept
-- its seats with no end: a careless agent or a competitor could block a whole
-- departure without paying. A group booking whose order is still
-- 'pending_payment' after unpaidHoldHours (default 48) with no payment in
-- flight is cancelled through _apply_order_cancellation, which releases the
-- seats through the existing trigger. Bank transfers awaiting confirmation
-- ('requires_action') and gateway payments in progress ('processing') are
-- never touched.
--
-- Umrah agent holds (orders.status = 'held') past hold_expires_at are swept
-- the same way. Private trips are not expired: their price is set by staff
-- after the request, so a clock from creation would be wrong.
--
-- Runs from the daily umrah-housekeeping cron (service role), from an admin
-- button, and lazily for one package before its booking page renders.

-- ----------------------------------------------------------------------------
-- 1. Umrah operating settings (one row, edited from /admin/site-settings)
-- ----------------------------------------------------------------------------
insert into public.platform_settings (key, value) values
  ('umrah_operations', '{
    "unpaidHoldHours": 48,
    "privateDepositPercent": 50,
    "privateBalanceDueDays": 30,
    "privateLeadDays": 0,
    "privateFullPaymentBeforeDocuments": true,
    "visaRequiresPassport": true,
    "requiredDocuments": []
  }'::jsonb)
on conflict (key) do update
  set value = excluded.value || public.platform_settings.value;

create or replace function public.umrah_setting(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select value -> p_key from public.platform_settings where key = 'umrah_operations';
$$;

revoke execute on function public.umrah_setting(text) from public, anon;
grant execute on function public.umrah_setting(text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. The sweep
-- ----------------------------------------------------------------------------
create or replace function public._expire_unpaid_umrah_orders(p_package_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hours numeric;
  v_order_id uuid;
  v_swept integer := 0;
begin
  begin
    v_hours := (public.umrah_setting('unpaidHoldHours'))::text::numeric;
  exception when others then
    v_hours := null;
  end;
  v_hours := coalesce(v_hours, 48);

  -- Unpaid group bookings past the window.
  if v_hours >= 0 then
    for v_order_id in
      select o.id
        from public.orders o
       where o.status = 'pending_payment'
         and o.created_at < now() - v_hours * interval '1 hour'
         and exists (
           select 1
             from public.order_items oi
             join public.umrah_bookings b on b.id = oi.umrah_booking_id
            where oi.order_id = o.id
              and b.booking_kind = 'group'
              and b.status = 'pending'
              and (p_package_id is null or b.package_id = p_package_id)
         )
         and not exists (
           select 1 from public.payments p
            where p.order_id = o.id
              and p.status in ('succeeded', 'requires_action', 'processing')
         )
       for update of o skip locked
    loop
      perform set_config('sts.umrah_close_note', 'Unpaid. Seats released.', true);
      perform public._apply_order_cancellation(v_order_id, 'Unpaid. Seats released.');
      v_swept := v_swept + 1;
    end loop;
  end if;

  -- Umrah agent holds past their expiry.
  for v_order_id in
    select o.id
      from public.orders o
     where o.status = 'held'
       and o.hold_expires_at < now()
       and exists (
         select 1
           from public.order_items oi
           join public.umrah_bookings b on b.id = oi.umrah_booking_id
          where oi.order_id = o.id
            and (p_package_id is null or b.package_id = p_package_id)
       )
       and not exists (
         select 1 from public.payments p
          where p.order_id = o.id
            and p.status in ('succeeded', 'requires_action', 'processing')
       )
     for update of o skip locked
  loop
    perform set_config('sts.umrah_close_note', 'Hold expired.', true);
    perform public._apply_order_cancellation(v_order_id, 'Hold expired');
    v_swept := v_swept + 1;
  end loop;

  perform set_config('sts.umrah_close_note', '', true);
  return v_swept;
end;
$$;

revoke execute on function public._expire_unpaid_umrah_orders(uuid) from public, anon, authenticated;
grant execute on function public._expire_unpaid_umrah_orders(uuid) to service_role;

-- Admin button.
create or replace function public.expire_unpaid_umrah_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  return public._expire_unpaid_umrah_orders(null);
end;
$$;

revoke execute on function public.expire_unpaid_umrah_orders() from public, anon;
grant execute on function public.expire_unpaid_umrah_orders() to authenticated;

-- Lazy backstop before a package's booking page renders. Open to anyone: it
-- can only cancel orders that are already past their own window, which is
-- exactly what the cron would do on its next run.
create or replace function public.release_stale_umrah_seats(p_package_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_package_id is null then
    return 0;
  end if;
  return public._expire_unpaid_umrah_orders(p_package_id);
end;
$$;

revoke execute on function public.release_stale_umrah_seats(uuid) from public;
grant execute on function public.release_stale_umrah_seats(uuid) to anon, authenticated;
