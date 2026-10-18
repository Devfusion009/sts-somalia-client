-- Hotel refund policy: per-hotel rules (the closer to check-in, the larger the
-- deduction), a quote function, and an atomic resolver for the customer
-- cancellation/refund requests that already land in booking_requests.

create table public.hotel_refund_rules (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  days_before integer not null check (days_before >= 0),
  deduction_percent numeric(5,2) not null check (deduction_percent >= 0 and deduction_percent <= 100),
  created_at timestamptz not null default now(),
  unique (hotel_id, days_before)
);

create index hotel_refund_rules_hotel_idx on public.hotel_refund_rules (hotel_id, days_before desc);

alter table public.hotel_refund_rules enable row level security;

create policy "hotel_refund_rules: public reads"
  on public.hotel_refund_rules for select
  using (true);

create policy "hotel_refund_rules: admin manages"
  on public.hotel_refund_rules for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "hotel_refund_rules: partner manages own"
  on public.hotel_refund_rules for all to authenticated
  using (public.is_hotel_partner_member((select partner_id from public.hotels where id = hotel_id)))
  with check (public.is_hotel_partner_member((select partner_id from public.hotels where id = hotel_id)));

create policy "hotel_refund_rules: manager writes when permitted"
  on public.hotel_refund_rules for all to authenticated
  using (public.hotel_manager_has_permission(hotel_id, 'profile'))
  with check (public.hotel_manager_has_permission(hotel_id, 'profile'));

-- ----------------------------------------------------------------------------
-- booking_requests: tie a request to the hotel booking it concerns
-- ----------------------------------------------------------------------------
alter table public.booking_requests
  add column hotel_booking_id uuid references public.hotel_bookings (id) on delete set null;

create index booking_requests_hotel_booking_idx on public.booking_requests (hotel_booking_id)
  where hotel_booking_id is not null;

-- A customer opens a request against an order; when that order carries a hotel
-- stay, the request is routed to that stay's hotel.
create or replace function public.booking_requests_link_hotel_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.hotel_booking_id is null then
    select oi.hotel_booking_id into new.hotel_booking_id
      from public.order_items oi
     where oi.order_id = new.order_id and oi.hotel_booking_id is not null
     order by oi.created_at
     limit 1;
  end if;
  return new;
end;
$$;

create trigger booking_requests_link_hotel_booking
  before insert on public.booking_requests
  for each row execute function public.booking_requests_link_hotel_booking();

-- Backfill requests opened before this migration.
update public.booking_requests br
   set hotel_booking_id = (
     select oi.hotel_booking_id from public.order_items oi
      where oi.order_id = br.order_id and oi.hotel_booking_id is not null
      order by oi.created_at limit 1)
 where br.hotel_booking_id is null;

create policy "booking_requests: hotel staff read"
  on public.booking_requests for select to authenticated
  using (
    hotel_booking_id is not null
    and exists (
      select 1
        from public.hotel_bookings hb
        join public.hotels h on h.id = hb.hotel_id
       where hb.id = hotel_booking_id
         and (public.is_hotel_manager(hb.hotel_id) or public.is_hotel_partner_member(h.partner_id))
    )
  );

-- ----------------------------------------------------------------------------
-- Quote: what a cancellation made on p_as_of would refund
-- ----------------------------------------------------------------------------
-- deduction_percent and refund_amount are null when the hotel has no rules:
-- the amount is then the hotel's call, not the policy's.
create or replace function public.hotel_refund_quote(p_booking_id uuid, p_as_of date default current_date)
returns table (
  days_before integer,
  deduction_percent numeric,
  paid_amount numeric,
  refund_amount numeric,
  currency text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  hb public.hotel_bookings;
  v_partner uuid;
  v_days integer;
  v_pct numeric;
  v_has_rules boolean;
  v_paid numeric;
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

  select exists (select 1 from public.hotel_refund_rules r where r.hotel_id = hb.hotel_id) into v_has_rules;

  if v_has_rules then
    select r.deduction_percent into v_pct
      from public.hotel_refund_rules r
     where r.hotel_id = hb.hotel_id and r.days_before <= v_days
     order by r.days_before desc
     limit 1;
    v_pct := coalesce(v_pct, 100);
  end if;

  if hb.paid_at is not null or exists (
    select 1
      from public.order_items oi
      join public.payments p on p.order_id = oi.order_id
     where oi.hotel_booking_id = hb.id and p.status = 'succeeded'
  ) then
    v_paid := hb.total_price;
  else
    v_paid := 0;
  end if;

  return query select
    v_days,
    v_pct,
    v_paid,
    case when v_pct is null then null else round(v_paid * (100 - v_pct) / 100, 2) end,
    hb.currency;
end;
$$;

grant execute on function public.hotel_refund_quote(uuid, date) to authenticated;

-- ----------------------------------------------------------------------------
-- Resolver: hotel staff (or admin) decide a request tied to their booking
-- ----------------------------------------------------------------------------
-- Approving a cancellation or refund also cancels the stay, in the same
-- transaction; hotel_bookings_decided then notifies the customer. Moving the
-- money and closing the request as 'completed' stays with admin.
create or replace function public.resolve_hotel_booking_request(
  p_request_id uuid,
  p_decision text,
  p_amount numeric default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.booking_requests;
  hb public.hotel_bookings;
  v_partner uuid;
  v_hotel text;
  v_amount numeric;
begin
  if p_decision not in ('approved', 'rejected', 'in_review') then
    raise exception 'Invalid decision.';
  end if;

  select * into r from public.booking_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found.';
  end if;
  if r.hotel_booking_id is null then
    raise exception 'This request is not tied to a hotel booking.';
  end if;

  select * into hb from public.hotel_bookings where id = r.hotel_booking_id for update;
  select partner_id, name into v_partner, v_hotel from public.hotels where id = hb.hotel_id;

  if not (
    public.is_admin()
    or public.hotel_manager_has_permission(hb.hotel_id, 'bookings')
    or public.is_hotel_partner_member(v_partner)
  ) then
    raise exception 'You do not have permission to decide this request.';
  end if;

  if r.status not in ('requested', 'in_review') then
    raise exception 'This request is already closed.';
  end if;

  v_amount := null;
  if p_decision = 'approved' and r.kind in ('cancellation', 'refund') then
    v_amount := coalesce(p_amount, r.requested_amount, 0);
    if v_amount < 0 or v_amount > hb.total_price then
      raise exception 'Refund cannot exceed the booking total.';
    end if;
  end if;

  update public.booking_requests
     set status = p_decision::public.booking_request_status,
         approved_amount = v_amount,
         staff_note = nullif(trim(coalesce(p_note, '')), ''),
         resolved_by = case when p_decision = 'in_review' then null else auth.uid() end,
         resolved_at = case when p_decision = 'in_review' then null else now() end
   where id = r.id;

  if p_decision = 'approved' and r.kind in ('cancellation', 'refund')
     and hb.status in ('pending', 'waitlisted', 'confirmed') then
    update public.hotel_bookings set status = 'cancelled' where id = hb.id;
  end if;

  insert into public.notifications (profile_id, type, title, body, data)
  values (
    r.requested_by,
    'booking_request_' || p_decision,
    case p_decision
      when 'approved' then 'Request approved — ' || v_hotel
      when 'rejected' then 'Request declined — ' || v_hotel
      else 'Request under review — ' || v_hotel
    end,
    nullif(trim(coalesce(p_note, '')), ''),
    jsonb_build_object('request_id', r.id, 'order_id', r.order_id)
  );
end;
$$;

grant execute on function public.resolve_hotel_booking_request(uuid, text, numeric, text) to authenticated;
