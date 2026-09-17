-- Umrah bookings get a fulfillment track with one door, shaped like the visa
-- state machine (20260908000002).
--
-- booking_status only answers "is this booking alive and paid for" — it has
-- no way to say the visas are being processed, the flights are ticketed or the
-- travel pack is ready, which is what a pilgrim actually waits on. And group
-- bookings never left 'pending' after payment: payments_settle_order marks the
-- order paid and nothing ever looked at the umrah booking behind it. No umrah
-- notification of any kind existed.
--
-- fulfillment_stage sits alongside status rather than replacing it, because
-- status is shared with orders, cancellation cascades, badges and seat
-- inventory (20260917000001) that must keep working unchanged.

create type public.umrah_fulfillment_stage as enum (
  'booked',
  'confirmed',
  'visa_processing',
  'visa_issued',
  'travel_confirmed',
  'documents_ready',
  'completed'
);

alter table public.umrah_bookings
  add column fulfillment_stage public.umrah_fulfillment_stage not null default 'booked';

update public.umrah_bookings
   set fulfillment_stage = case status
     when 'confirmed' then 'confirmed'::public.umrah_fulfillment_stage
     when 'completed' then 'completed'::public.umrah_fulfillment_stage
     else 'booked'::public.umrah_fulfillment_stage
   end;

-- ----------------------------------------------------------------------------
-- 1) History — the customer-facing timeline
-- ----------------------------------------------------------------------------
create table public.umrah_booking_stage_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.umrah_bookings (id) on delete cascade,
  stage public.umrah_fulfillment_stage not null,
  note text,
  actor uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index umrah_booking_stage_history_booking_idx
  on public.umrah_booking_stage_history (booking_id, created_at);

alter table public.umrah_booking_stage_history enable row level security;

create policy "umrah_booking_stage_history: admin manage"
  on public.umrah_booking_stage_history for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Read-only for everyone else: rows are only ever written by the transition
-- function and the insert trigger, both of which bypass RLS.
create policy "umrah_booking_stage_history: read via parent booking"
  on public.umrah_booking_stage_history for select to authenticated
  using (
    exists (
      select 1 from public.umrah_bookings b
      where b.id = umrah_booking_stage_history.booking_id
        and (b.customer_id = auth.uid() or b.booked_by = auth.uid()
             or (b.agency_id is not null and public.is_agency_member(b.agency_id)))
    )
  );

-- Existing bookings start their timeline at the stage they were backfilled to.
insert into public.umrah_booking_stage_history (booking_id, stage, actor, created_at)
select b.id, b.fulfillment_stage, null, b.created_at
  from public.umrah_bookings b;

-- ----------------------------------------------------------------------------
-- 2) The transition — authorization is the caller's job, not this one's
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
-- 3) Public entry point — staff only
-- ----------------------------------------------------------------------------
create or replace function public.set_umrah_booking_stage(
  p_booking_id uuid,
  p_stage public.umrah_fulfillment_stage,
  p_note text default null
)
returns public.umrah_fulfillment_stage
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only STS staff can change an umrah booking''s stage';
  end if;

  return public.apply_umrah_stage_transition_internal(p_booking_id, p_stage, auth.uid(), p_note);
end;
$$;

revoke execute on function public.set_umrah_booking_stage(uuid, public.umrah_fulfillment_stage, text)
  from public, anon;
grant execute on function public.set_umrah_booking_stage(uuid, public.umrah_fulfillment_stage, text)
  to authenticated;

-- ----------------------------------------------------------------------------
-- 4) The door is the only door
-- ----------------------------------------------------------------------------
create or replace function public.guard_umrah_stage_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.fulfillment_stage is distinct from old.fulfillment_stage
     and coalesce(current_setting('sts.umrah_stage_transition', true), '') <> new.id::text then
    raise exception
      'umrah booking stage must change through set_umrah_booking_stage()';
  end if;
  return new;
end;
$$;

create trigger umrah_bookings_guard_stage
  before update of fulfillment_stage on public.umrah_bookings
  for each row execute function public.guard_umrah_stage_transition();

-- An insert cannot skip the track: whatever a client sends, a booking starts
-- at 'booked' and its timeline gets that first row.
create or replace function public.umrah_bookings_start_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and tg_when = 'BEFORE' then
    new.fulfillment_stage := 'booked';
    return new;
  end if;

  insert into public.umrah_booking_stage_history (booking_id, stage, actor)
  values (new.id, 'booked', new.booked_by);
  return new;
end;
$$;

revoke execute on function public.umrah_bookings_start_stage() from public, anon, authenticated;

create trigger umrah_bookings_force_initial_stage
  before insert on public.umrah_bookings
  for each row execute function public.umrah_bookings_start_stage();

create trigger umrah_bookings_record_initial_stage
  after insert on public.umrah_bookings
  for each row execute function public.umrah_bookings_start_stage();

-- ----------------------------------------------------------------------------
-- 5) A paid group booking is a confirmed one. Group departures are fixed
--    products with seats already held, so there is nothing for staff to
--    decide once the money is in.
-- ----------------------------------------------------------------------------
create or replace function public.umrah_confirm_group_bookings_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id uuid;
begin
  if new.status not in ('paid', 'partially_paid') or old.status = new.status then
    return new;
  end if;

  for v_booking_id in
    select b.id
      from public.order_items oi
      join public.umrah_bookings b on b.id = oi.umrah_booking_id
     where oi.order_id = new.id
       and b.booking_kind = 'group'
       and b.fulfillment_stage = 'booked'
  loop
    -- This runs inside payments_settle_order. A booking that cannot be
    -- confirmed (e.g. cancelled while the payment was in flight) must never
    -- roll back the payment itself; staff can still confirm it by hand.
    begin
      perform public.apply_umrah_stage_transition_internal(v_booking_id, 'confirmed', null, 'Payment received');
    exception when others then
      null;
    end;
  end loop;

  return new;
end;
$$;

revoke execute on function public.umrah_confirm_group_bookings_on_payment() from public, anon, authenticated;

create trigger orders_confirm_umrah_group_bookings
  after update of status on public.orders
  for each row execute function public.umrah_confirm_group_bookings_on_payment();
