-- ============================================================================
-- Unified Orders & Payments
-- A single order/payment ledger sits on top of the four booking verticals
-- (hotel/flight/visa/umrah) so checkout, invoicing, and reporting are
-- consistent platform-wide instead of duplicated per vertical. order_items
-- uses nullable per-vertical FKs (rather than a untyped polymorphic id) so
-- referential integrity is still enforced by Postgres.
-- ============================================================================

create type public.order_item_type as enum ('hotel', 'flight', 'visa', 'umrah');
create type public.order_status as enum ('pending_payment', 'paid', 'processing', 'completed', 'cancelled', 'refunded');
create type public.payment_status as enum ('requires_action', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded');
create type public.invoice_status as enum ('draft', 'issued', 'paid', 'void');

create sequence public.order_number_seq;

create or replace function public.generate_order_number()
returns text
language sql
as $$
  select 'STS-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
$$;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default public.generate_order_number(),
  customer_id uuid not null references public.profiles (id),
  booked_by uuid not null references public.profiles (id),
  agency_id uuid references public.agencies (id),
  status public.order_status not null default 'pending_payment',
  currency text not null default 'USD',
  subtotal numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_customer_idx on public.orders (customer_id);
create index orders_agency_idx on public.orders (agency_id);
create index orders_status_idx on public.orders (status);

create trigger set_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  item_type public.order_item_type not null,
  hotel_booking_id uuid references public.hotel_bookings (id),
  flight_booking_id uuid references public.flight_bookings (id),
  visa_application_id uuid references public.visa_applications (id),
  umrah_booking_id uuid references public.umrah_bookings (id),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  quantity integer not null default 1 check (quantity > 0),
  total_price numeric(10,2) not null check (total_price >= 0),
  created_at timestamptz not null default now(),
  constraint order_items_exactly_one_target check (
    (case when hotel_booking_id is not null then 1 else 0 end)
  + (case when flight_booking_id is not null then 1 else 0 end)
  + (case when visa_application_id is not null then 1 else 0 end)
  + (case when umrah_booking_id is not null then 1 else 0 end) = 1
  ),
  constraint order_items_type_matches_target check (
    (item_type = 'hotel' and hotel_booking_id is not null) or
    (item_type = 'flight' and flight_booking_id is not null) or
    (item_type = 'visa' and visa_application_id is not null) or
    (item_type = 'umrah' and umrah_booking_id is not null)
  )
);

create index order_items_order_idx on public.order_items (order_id);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null, -- e.g. 'stripe'
  provider_customer_id text,
  provider_payment_method_id text not null,
  brand text,
  last4 text,
  exp_month smallint,
  exp_year smallint,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (provider, provider_payment_method_id)
);

create index payment_methods_customer_idx on public.payment_methods (customer_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  method_id uuid references public.payment_methods (id),
  provider text not null,
  provider_payment_intent_id text,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'USD',
  status public.payment_status not null default 'processing',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_order_idx on public.payments (order_id);
create index payments_status_idx on public.payments (status);

create trigger set_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  invoice_number text not null unique,
  status public.invoice_status not null default 'draft',
  issued_at timestamptz,
  due_at timestamptz,
  pdf_storage_path text,
  total numeric(12,2) not null check (total >= 0),
  currency text not null default 'USD',
  created_at timestamptz not null default now()
);

create index invoices_order_idx on public.invoices (order_id);

-- ----------------------------------------------------------------------------
-- Helper: can the current user read this order (customer/booked_by/agency/admin)?
-- ----------------------------------------------------------------------------
create or replace function public.can_access_order(target_order_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.orders o
    where o.id = target_order_id
      and (
        o.customer_id = auth.uid()
        or o.booked_by = auth.uid()
        or (o.agency_id is not null and public.is_agency_member(o.agency_id))
        or public.is_admin()
      )
  );
$$;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_methods enable row level security;
alter table public.payments enable row level security;
alter table public.invoices enable row level security;

create policy "orders: reads via ownership/agency/admin"
  on public.orders for select to authenticated
  using (
    customer_id = auth.uid()
    or booked_by = auth.uid()
    or (agency_id is not null and public.is_agency_member(agency_id))
    or public.is_admin()
  );

create policy "orders: creator creates own order"
  on public.orders for insert to authenticated
  with check (booked_by = auth.uid() and (customer_id = auth.uid() or (agency_id is not null and public.is_agency_member(agency_id))));

create policy "orders: admin manage"
  on public.orders for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "order_items: read via parent order"
  on public.order_items for select to authenticated
  using (public.can_access_order(order_id));

create policy "order_items: creator inserts into own order"
  on public.order_items for insert to authenticated
  with check (public.can_access_order(order_id));

create policy "order_items: admin manage"
  on public.order_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "payment_methods: customer manages own"
  on public.payment_methods for all to authenticated
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

create policy "payment_methods: admin read"
  on public.payment_methods for select to authenticated
  using (public.is_admin());

create policy "payments: read via parent order"
  on public.payments for select to authenticated
  using (public.can_access_order(order_id));

create policy "payments: creator initiates payment on own order"
  on public.payments for insert to authenticated
  with check (public.can_access_order(order_id));

create policy "payments: admin manage"
  on public.payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "invoices: read via parent order"
  on public.invoices for select to authenticated
  using (public.can_access_order(order_id));

create policy "invoices: admin manage"
  on public.invoices for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
