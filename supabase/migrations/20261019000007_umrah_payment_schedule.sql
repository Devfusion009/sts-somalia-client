-- Umrah payment terms, the full-payment gate on travel documents, and the
-- readiness gate on visa filing.
--
-- 1. Per-package deposit % (null = the platform-wide 50%) and balance due
--    days before departure (default 30). Private trips read
--    umrah_operations.privateDepositPercent / privateBalanceDueDays. Copied
--    onto orders.min_first_payment / balance_due_at when the order item is
--    created, recomputed when the order total changes (a private quote) or
--    the departure date moves.
-- 2. full_payment_before_documents (default true): e-tickets and hotel
--    vouchers stay hidden, and the booking cannot reach 'documents_ready',
--    until the order is fully paid. Visas may still be filed on a deposit.
--    Private trips read umrah_operations.privateFullPaymentBeforeDocuments.
-- 3. The stage function refuses visa_processing while any pilgrim is missing
--    passport data or a required document (umrah_operations
--    .visaRequiresPassport, default on; requiredDocuments, default none).
-- 4. Staff uploads notify the customer once the document is visible to them.
-- 5. Balance-due and departure reminders, deduplicated per order and kind.

-- ----------------------------------------------------------------------------
-- 1. Columns
-- ----------------------------------------------------------------------------
alter table public.umrah_packages
  add column if not exists deposit_percent numeric(5,2) check (deposit_percent between 0 and 100);
alter table public.umrah_packages
  add column if not exists balance_due_days smallint not null default 30 check (balance_due_days between 0 and 180);
alter table public.umrah_packages
  add column if not exists full_payment_before_documents boolean not null default true;

alter table public.orders add column if not exists min_first_payment numeric(12,2)
  check (min_first_payment is null or min_first_payment >= 0);
alter table public.orders add column if not exists balance_due_at date;

-- ----------------------------------------------------------------------------
-- 2. Terms for an order
-- ----------------------------------------------------------------------------
create or replace function public._umrah_order_terms(
  p_order_id uuid,
  out deposit_percent numeric,
  out due_date date
)
language plpgsql
stable
security definer
set search_path = public
as $$
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
end;
$$;

revoke execute on function public._umrah_order_terms(uuid) from public, anon, authenticated;

create or replace function public.order_items_apply_umrah_terms()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
begin
  if new.umrah_booking_id is null then
    return new;
  end if;
  select * into t from public._umrah_order_terms(new.order_id);
  update public.orders o
     set min_first_payment = case when t.deposit_percent is null then null
                                  else round(o.total * t.deposit_percent / 100, 2) end,
         balance_due_at = t.due_date
   where o.id = new.order_id;
  return new;
end;
$$;

revoke execute on function public.order_items_apply_umrah_terms() from public, anon, authenticated;

drop trigger if exists order_items_apply_umrah_terms on public.order_items;
create trigger order_items_apply_umrah_terms
  after insert on public.order_items
  for each row execute function public.order_items_apply_umrah_terms();

-- A re-quoted private trip keeps its deposit share of the new total.
create or replace function public.orders_recompute_umrah_deposit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
begin
  if new.total is not distinct from old.total then
    return new;
  end if;
  if not exists (select 1 from public.order_items oi where oi.order_id = new.id and oi.umrah_booking_id is not null) then
    return new;
  end if;
  select * into t from public._umrah_order_terms(new.id);
  new.min_first_payment := case when t.deposit_percent is null then null
                                else round(new.total * t.deposit_percent / 100, 2) end;
  return new;
end;
$$;

revoke execute on function public.orders_recompute_umrah_deposit() from public, anon, authenticated;

drop trigger if exists orders_recompute_umrah_deposit on public.orders;
create trigger orders_recompute_umrah_deposit
  before update of total on public.orders
  for each row execute function public.orders_recompute_umrah_deposit();

create or replace function public.umrah_departures_recompute_due()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.departure_date is not distinct from old.departure_date then
    return new;
  end if;
  update public.orders o
     set balance_due_at = (select t.due_date from public._umrah_order_terms(o.id) t)
    from public.order_items oi
    join public.umrah_bookings b on b.id = oi.umrah_booking_id
   where oi.order_id = o.id
     and b.departure_id = new.id
     and o.status in ('pending_payment', 'held', 'partially_paid');
  return new;
end;
$$;

revoke execute on function public.umrah_departures_recompute_due() from public, anon, authenticated;

drop trigger if exists umrah_departures_recompute_due on public.umrah_package_departures;
create trigger umrah_departures_recompute_due
  after update of departure_date on public.umrah_package_departures
  for each row execute function public.umrah_departures_recompute_due();

-- Existing unpaid/part-paid Umrah orders get their due date now.
update public.orders o
   set balance_due_at = (select t.due_date from public._umrah_order_terms(o.id) t)
 where o.status in ('pending_payment', 'held', 'partially_paid')
   and o.balance_due_at is null
   and exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.umrah_booking_id is not null);

-- ----------------------------------------------------------------------------
-- 3. Full payment before documents
-- ----------------------------------------------------------------------------
create or replace function public._umrah_full_payment_required(p_booking_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_flag boolean;
begin
  select b.booking_kind, pkg.full_payment_before_documents into v_kind, v_flag
    from public.umrah_bookings b
    left join public.umrah_packages pkg on pkg.id = b.package_id
   where b.id = p_booking_id;
  if v_kind = 'private' then
    begin
      v_flag := (public.umrah_setting('privateFullPaymentBeforeDocuments'))::text::boolean;
    exception when others then
      v_flag := null;
    end;
  end if;
  return coalesce(v_flag, true);
end;
$$;

revoke execute on function public._umrah_full_payment_required(uuid) from public, anon, authenticated;

create or replace function public.umrah_document_released(p_booking_id uuid, p_doc_type text, p_source text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_status public.order_status;
begin
  if p_source = 'customer' or p_doc_type not in ('e_ticket', 'hotel_voucher') then
    return true;
  end if;
  if not public._umrah_full_payment_required(p_booking_id) then
    return true;
  end if;
  select o.status into v_status
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.umrah_booking_id = p_booking_id
   order by o.created_at desc
   limit 1;
  return v_status in ('paid', 'processing', 'completed');
end;
$$;

revoke execute on function public.umrah_document_released(uuid, text, text) from public, anon;
grant execute on function public.umrah_document_released(uuid, text, text) to authenticated;

create index if not exists umrah_booking_documents_path_idx on public.umrah_booking_documents (storage_path);

create or replace function public.umrah_storage_object_released(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select public.umrah_document_released(d.booking_id, d.doc_type, d.source)
      from public.umrah_booking_documents d
     where d.storage_path = p_name
     limit 1
  ), true);
$$;

revoke execute on function public.umrah_storage_object_released(text) from public, anon;
grant execute on function public.umrah_storage_object_released(text) to authenticated;

drop policy if exists "umrah_booking_documents: read via parent booking" on public.umrah_booking_documents;
create policy "umrah_booking_documents: read via parent booking"
  on public.umrah_booking_documents for select to authenticated
  using (
    exists (
      select 1 from public.umrah_bookings b
      where b.id = umrah_booking_documents.booking_id
        and (b.customer_id = (select auth.uid()) or b.booked_by = (select auth.uid())
             or b.agency_id = any ((select public.my_agency_ids())::uuid[]))
    )
    and public.umrah_document_released(booking_id, doc_type, source)
  );

drop policy if exists "umrah_documents_bucket: read via booking access" on storage.objects;
create policy "umrah_documents_bucket: read via booking access"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'umrah-documents'
    and (
      (select public.is_admin())
      or (
        exists (
          select 1 from public.umrah_bookings b
          where b.id::text = (storage.foldername(name))[1]
            and (b.customer_id = (select auth.uid()) or b.booked_by = (select auth.uid())
                 or b.agency_id = any ((select public.my_agency_ids())::uuid[]))
        )
        and public.umrah_storage_object_released(name)
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 4. The stage transition, re-declared from 20260917000002 with two gates
-- ----------------------------------------------------------------------------
create or replace function public.apply_umrah_stage_transition_internal(
  p_booking_id uuid,
  p_stage public.umrah_fulfillment_stage,
  p_actor uuid default null,
  p_note text default null
)
returns public.umrah_fulfillment_stage
language plpgsql
security definer
set search_path = public
as $$
declare
  bk public.umrah_bookings;
  v_note text := nullif(btrim(p_note), '');
  v_order_id uuid;
  v_order_status public.order_status;
  v_label text;
  v_title text;
  v_body text;
  v_data jsonb;
  v_require_passport boolean;
begin
  select * into bk from public.umrah_bookings where id = p_booking_id for update;
  if not found then
    raise exception 'umrah booking not found';
  end if;

  -- A no-op writes no history and notifies nobody, so a redelivered payment
  -- webhook or a double-clicked button is harmless.
  if bk.fulfillment_stage = p_stage then
    return bk.fulfillment_stage;
  end if;

  if bk.status in ('cancelled', 'refunded', 'failed') then
    raise exception 'this booking is %', bk.status;
  end if;

  -- Forward only, but stages may be skipped: a pilgrim who already holds a
  -- visa goes straight from confirmed to travel_confirmed.
  if p_stage < bk.fulfillment_stage then
    raise exception 'an umrah booking cannot move back from % to %', bk.fulfillment_stage, p_stage;
  end if;

  select o.id, o.status into v_order_id, v_order_status
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.umrah_booking_id = p_booking_id
   order by o.created_at desc
   limit 1;

  -- Confirming is how a private request gets priced and offered for payment,
  -- so it cannot itself require payment. Anything after it commits real spend
  -- (visa fees, tickets, hotel vouchers) and does.
  if p_stage > 'confirmed'
     and (v_order_status is null
          or v_order_status not in ('paid', 'partially_paid', 'processing', 'completed')) then
    raise exception 'this booking has not been paid yet';
  end if;

  -- Visas cannot be filed without every pilgrim's passport data (and any
  -- documents the settings require).
  if p_stage >= 'visa_processing' and bk.fulfillment_stage < 'visa_processing' then
    begin
      v_require_passport := (public.umrah_setting('visaRequiresPassport'))::text::boolean;
    exception when others then
      v_require_passport := null;
    end;
    if coalesce(v_require_passport, true) and exists (
      select 1 from public._umrah_pilgrim_readiness(p_booking_id) r where cardinality(r.missing) > 0
    ) then
      raise exception 'pilgrim details incomplete';
    end if;
  end if;

  -- Travel documents are released on full payment where the package says so.
  if p_stage >= 'documents_ready'
     and public._umrah_full_payment_required(p_booking_id)
     and v_order_status not in ('paid', 'processing', 'completed') then
    raise exception 'this booking is not fully paid';
  end if;

  -- The guard trigger rejects any stage write that did not come through here.
  -- Transaction-local, and cleared straight after so a later direct write in
  -- the same transaction is still refused.
  perform set_config('sts.umrah_stage_transition', p_booking_id::text, true);

  update public.umrah_bookings
     set fulfillment_stage = p_stage,
         status = case
           when p_stage = 'completed' then 'completed'::public.booking_status
           when p_stage >= 'confirmed' and status = 'pending' then 'confirmed'::public.booking_status
           else status
         end,
         updated_at = now()
   where id = p_booking_id;

  perform set_config('sts.umrah_stage_transition', '', true);

  insert into public.umrah_booking_stage_history (booking_id, stage, note, actor)
  values (p_booking_id, p_stage, v_note, p_actor);

  select coalesce(
           (select p.name from public.umrah_packages p where p.id = bk.package_id),
           (select r.reference from public.umrah_custom_requests r where r.id = bk.custom_request_id),
           'Umrah booking'
         )
    into v_label;

  v_data := jsonb_build_object(
    'bookingId', p_booking_id,
    'orderId', v_order_id,
    'stage', p_stage::text
  );

  v_title := case p_stage
    when 'confirmed' then 'Umrah booking confirmed'
    when 'visa_processing' then 'Umrah visas in processing'
    when 'visa_issued' then 'Umrah visas issued'
    when 'travel_confirmed' then 'Umrah travel confirmed'
    when 'documents_ready' then 'Umrah travel documents ready'
    when 'completed' then 'Umrah trip completed'
    else 'Umrah booking updated'
  end;

  v_body := case p_stage
    when 'confirmed' then v_label || ' is confirmed.'
    when 'visa_processing' then 'Visas for ' || v_label || ' are with the authority.'
    when 'visa_issued' then 'Visas for ' || v_label || ' are issued.'
    when 'travel_confirmed' then 'Flights and hotels for ' || v_label || ' are confirmed.'
    when 'documents_ready' then 'Travel documents for ' || v_label || ' are ready to download.'
    when 'completed' then v_label || ' is complete.'
    else v_label || ' was updated.'
  end || case when v_note is not null then ' ' || v_note else '' end;

  -- The customer, whoever booked it, and — for an agency booking — the
  -- agency's active members. One row each, same fan-out as visa.
  insert into public.notifications (profile_id, type, title, body, data)
  select distinct r.profile_id, 'umrah_stage_changed', v_title, v_body, v_data
  from (
    select bk.customer_id as profile_id
    union
    select bk.booked_by
    union
    select m.profile_id
      from public.agency_members m
     where bk.agency_id is not null
       and m.agency_id = bk.agency_id
       and m.status = 'active'
  ) r
  where r.profile_id is not null;

  return p_stage;
end;
$$;

revoke execute on function public.apply_umrah_stage_transition_internal(uuid, public.umrah_fulfillment_stage, uuid, text)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. Staff uploads notify the traveller
-- ----------------------------------------------------------------------------
create or replace function public.umrah_documents_notify_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bk public.umrah_bookings;
  v_order_id uuid;
  v_label text;
begin
  if new.source <> 'staff' or not public.umrah_document_released(new.booking_id, new.doc_type, new.source) then
    return new;
  end if;

  select * into bk from public.umrah_bookings where id = new.booking_id;
  select o.id into v_order_id
    from public.order_items oi join public.orders o on o.id = oi.order_id
   where oi.umrah_booking_id = bk.id
   order by o.created_at desc limit 1;

  v_label := case new.doc_type
    when 'visa' then 'Visa uploaded'
    when 'e_ticket' then 'E-ticket uploaded'
    when 'hotel_voucher' then 'Hotel voucher uploaded'
    when 'itinerary' then 'Itinerary uploaded'
    when 'insurance' then 'Insurance uploaded'
    else 'Document uploaded'
  end;

  insert into public.notifications (profile_id, type, title, body, data)
  select distinct r.profile_id, 'umrah_document_added', v_label, new.title,
         jsonb_build_object('bookingId', bk.id, 'orderId', v_order_id, 'documentId', new.id)
  from (
    select bk.customer_id as profile_id
    union select bk.booked_by
    union select m.profile_id from public.agency_members m
           where bk.agency_id is not null and m.agency_id = bk.agency_id and m.status = 'active'
  ) r
  where r.profile_id is not null;

  return new;
end;
$$;

revoke execute on function public.umrah_documents_notify_added() from public, anon, authenticated;

drop trigger if exists umrah_documents_notify_added on public.umrah_booking_documents;
create trigger umrah_documents_notify_added
  after insert on public.umrah_booking_documents
  for each row execute function public.umrah_documents_notify_added();

-- ----------------------------------------------------------------------------
-- 6. Reminders
-- ----------------------------------------------------------------------------
create table if not exists public.umrah_reminders_sent (
  order_id uuid not null references public.orders (id) on delete cascade,
  kind text not null,
  sent_at timestamptz not null default now(),
  primary key (order_id, kind)
);

alter table public.umrah_reminders_sent enable row level security;

drop policy if exists "umrah_reminders_sent: admin reads" on public.umrah_reminders_sent;
create policy "umrah_reminders_sent: admin reads"
  on public.umrah_reminders_sent for select to authenticated
  using ((select public.is_admin()));

-- Inserts the in-app notifications and returns what was sent, so the cron
-- can send the same line by email / WhatsApp. One row per order and kind,
-- ever: a missed day sends the nearest threshold once, never a backlog.
create or replace function public._queue_umrah_reminders()
returns table (booking_id uuid, order_id uuid, kind text, line text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  r record;
  v_kind text;
  v_line text;
  v_inserted int;
begin
  for r in
    select o.id as order_id, o.total, o.currency, o.balance_due_at, o.status as order_status,
           b.id as booking_id, b.customer_id, b.booked_by, b.agency_id, b.status as booking_status,
           coalesce(d.departure_date, cr.departure_date) as departure_date,
           coalesce(pkg.name, cr.reference, 'Umrah booking') as label,
           coalesce((select sum(p.amount) from public.payments p
                      where p.order_id = o.id and p.status = 'succeeded'), 0) as paid
      from public.orders o
      join public.order_items oi on oi.order_id = o.id
      join public.umrah_bookings b on b.id = oi.umrah_booking_id
      left join public.umrah_packages pkg on pkg.id = b.package_id
      left join public.umrah_package_departures d on d.id = b.departure_id
      left join public.umrah_custom_requests cr on cr.id = b.custom_request_id
     where b.status = 'confirmed'
       and o.status in ('pending_payment', 'partially_paid', 'paid', 'processing')
       and coalesce(d.departure_date, cr.departure_date) >= current_date
  loop
    -- Balance due
    v_kind := null;
    if r.order_status in ('pending_payment', 'partially_paid') and r.balance_due_at is not null
       and r.total - r.paid > 0 then
      v_kind := case
        when r.balance_due_at - current_date <= 0 then 'balance_due_0'
        when r.balance_due_at - current_date <= 3 then 'balance_due_3'
        when r.balance_due_at - current_date <= 7 then 'balance_due_7'
      end;
    end if;
    if v_kind is not null then
      insert into public.umrah_reminders_sent (order_id, kind) values (r.order_id, v_kind)
      on conflict do nothing;
      get diagnostics v_inserted = row_count;
      if v_inserted > 0 then
        v_line := r.label || ': ' || r.currency || ' ' || to_char(r.total - r.paid, 'FM999999990.00')
                  || ' due by ' || to_char(r.balance_due_at, 'DD Mon YYYY') || '.';
        insert into public.notifications (profile_id, type, title, body, data)
        select distinct x.profile_id, 'umrah_balance_due', 'Umrah balance due', v_line,
               jsonb_build_object('bookingId', r.booking_id, 'orderId', r.order_id)
        from (
          select r.customer_id as profile_id
          union select r.booked_by
          union select m.profile_id from public.agency_members m
                 where r.agency_id is not null and m.agency_id = r.agency_id and m.status = 'active'
        ) x
        where x.profile_id is not null;
        booking_id := r.booking_id; order_id := r.order_id; kind := 'balance_due'; line := v_line;
        return next;
      end if;
    end if;

    -- Departure
    v_kind := null;
    if r.order_status in ('partially_paid', 'paid', 'processing') then
      v_kind := case
        when r.departure_date - current_date <= 1 then 'departure_1'
        when r.departure_date - current_date <= 7 then 'departure_7'
      end;
    end if;
    if v_kind is not null then
      insert into public.umrah_reminders_sent (order_id, kind) values (r.order_id, v_kind)
      on conflict do nothing;
      get diagnostics v_inserted = row_count;
      if v_inserted > 0 then
        v_line := r.label || ' departs on ' || to_char(r.departure_date, 'DD Mon YYYY') || '.';
        insert into public.notifications (profile_id, type, title, body, data)
        select distinct x.profile_id, 'umrah_departure_reminder', 'Umrah departure reminder', v_line,
               jsonb_build_object('bookingId', r.booking_id, 'orderId', r.order_id)
        from (
          select r.customer_id as profile_id
          union select r.booked_by
          union select m.profile_id from public.agency_members m
                 where r.agency_id is not null and m.agency_id = r.agency_id and m.status = 'active'
        ) x
        where x.profile_id is not null;
        booking_id := r.booking_id; order_id := r.order_id; kind := 'departure_reminder'; line := v_line;
        return next;
      end if;
    end if;
  end loop;
end;
$$;

revoke execute on function public._queue_umrah_reminders() from public, anon, authenticated;
grant execute on function public._queue_umrah_reminders() to service_role;
