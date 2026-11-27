-- Additive request-first inventory. Existing departures remain immediate-payment.
alter table public.umrah_package_departures
 add column booking_mode text not null default 'immediate_payment' check (booking_mode in ('immediate_payment','request_then_pay')),
 add column formation_status text not null default 'draft' check (formation_status in ('draft','forming','activation_pending','payment_open','ready','completed','cancelled')),
 add column formation_closes_at timestamptz,
 add column payment_window_hours integer not null default 48 check(payment_window_hours between 1 and 168),
 add column payment_cutoff_at timestamptz,
 add column activated_at timestamptz,
 add column replacement_sales_open boolean not null default false,
 add column request_terms text,
 add column activation_error text,
 add constraint umrah_request_deadlines check (booking_mode='immediate_payment' or
   (formation_closes_at is not null and payment_cutoff_at is not null and request_terms is not null and length(btrim(request_terms))>=10
    and formation_closes_at + payment_window_hours * interval '1 hour' <= payment_cutoff_at
    and payment_cutoff_at < (departure_date::timestamp at time zone 'Africa/Mogadishu') and offline_seats=0));

insert into public.platform_settings(key,value) values('umrah_request_pools_enabled','false'::jsonb) on conflict(key) do nothing;

create table public.umrah_pool_submissions (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references public.profiles(id),
 idempotency_key uuid not null,
 departure_id uuid not null references public.umrah_package_departures(id),
 payload jsonb not null,
 created_at timestamptz not null default now(),
 unique(actor_id,idempotency_key)
);
create table public.umrah_pool_requests (
 id uuid primary key default gen_random_uuid(),
 reference text not null unique default ('UMR-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,16))),
 submission_id uuid not null references public.umrah_pool_submissions(id),
 departure_id uuid not null references public.umrah_package_departures(id),
 customer_id uuid not null references public.profiles(id),
 booked_by uuid not null references public.profiles(id),
 agency_id uuid references public.agencies(id),
 agency_customer_id uuid references public.agency_customers(id),
 num_pilgrims integer not null check(num_pilgrims between 1 and 60),
 room_sharing smallint check(room_sharing between 1 and 4),
 special_requests text not null default '',
 status text not null default 'requested' check(status in ('requested','payment_due','paid','withdrawn','expired','cancelled')),
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 unit_price numeric(10,2) not null check(unit_price>0),
 subtotal numeric(10,2) not null check(subtotal>0),
 markup_amount numeric(10,2) not null default 0 check(markup_amount>=0),
 total numeric(10,2) not null check(total>0),
 quote_snapshot jsonb not null,
 terms_accepted_at timestamptz not null default now(),
 booking_id uuid unique references public.umrah_bookings(id),
 order_id uuid unique references public.orders(id),
 payment_due_at timestamptz,
 closed_reason text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(subtotal=unit_price*num_pilgrims and total=subtotal+markup_amount),
 check((agency_id is null and agency_customer_id is null) or (agency_id is not null and agency_customer_id is not null)),
 check(status not in ('payment_due','paid') or (booking_id is not null and order_id is not null and payment_due_at is not null))
);
create unique index umrah_pool_one_active_customer on public.umrah_pool_requests(departure_id,coalesce(agency_customer_id,customer_id)) where status in ('requested','payment_due','paid');
create index umrah_pool_requests_owner on public.umrah_pool_requests(customer_id,created_at desc);
create index umrah_pool_requests_agency on public.umrah_pool_requests(agency_id,created_at desc);
create index umrah_pool_requests_departure on public.umrah_pool_requests(departure_id,status);
create index umrah_pool_requests_due on public.umrah_pool_requests(payment_due_at) where status='payment_due';
create table public.umrah_pool_request_travelers (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.umrah_pool_requests(id) on delete cascade,
 full_name text not null check(length(btrim(full_name)) between 2 and 120),
 gender public.pilgrim_gender not null,
 date_of_birth date, nationality text, passport_number text, passport_expiry date,
 mahram_name text, mahram_relation text
);
create index umrah_pool_travelers_request on public.umrah_pool_request_travelers(request_id);
create table public.umrah_pool_events (
 id uuid primary key default gen_random_uuid(),
 departure_id uuid not null references public.umrah_package_departures(id),
 request_id uuid references public.umrah_pool_requests(id),
 event_key text not null unique,
 kind text not null,
 actor_id uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 processed_at timestamptz,
 attempts integer not null default 0,
 last_error text
);
create index umrah_pool_events_pending on public.umrah_pool_events(created_at) where processed_at is null;
create table public.umrah_pool_email_jobs (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.umrah_pool_requests(id),
 kind text not null check(kind in ('received','payment_due','reminder','expired','cancelled','paid')),
 event_key text not null unique,
 status text not null default 'pending' check(status in ('pending','sending','sent','failed','skipped')),
 attempts integer not null default 0,
 available_at timestamptz not null default now(),
 claimed_at timestamptz,
 claim_token uuid,
 sent_at timestamptz,
 last_error text,
 created_at timestamptz not null default now()
);
create index umrah_pool_email_pending on public.umrah_pool_email_jobs(available_at) where status in ('pending','sending');

alter table public.umrah_bookings add column pool_request_id uuid unique references public.umrah_pool_requests(id);

alter table public.umrah_pool_submissions enable row level security;
alter table public.umrah_pool_requests enable row level security;
alter table public.umrah_pool_request_travelers enable row level security;
alter table public.umrah_pool_events enable row level security;
alter table public.umrah_pool_email_jobs enable row level security;
revoke all on public.umrah_pool_submissions,public.umrah_pool_requests,public.umrah_pool_request_travelers,public.umrah_pool_events,public.umrah_pool_email_jobs from anon,authenticated;
grant select on public.umrah_pool_requests,public.umrah_pool_request_travelers,public.umrah_pool_events,public.umrah_pool_email_jobs to authenticated;
grant all on public.umrah_pool_submissions,public.umrah_pool_requests,public.umrah_pool_request_travelers,public.umrah_pool_events,public.umrah_pool_email_jobs to service_role;
create policy pool_requests_read on public.umrah_pool_requests for select to authenticated using (
 public.is_admin() or (agency_id is null and customer_id=auth.uid()) or (agency_id is not null and public.is_agency_member(agency_id))
);
create policy pool_travelers_read on public.umrah_pool_request_travelers for select to authenticated using (
 exists(select 1 from public.umrah_pool_requests r where r.id=request_id)
);
create policy pool_events_admin on public.umrah_pool_events for select to authenticated using(public.is_admin());
create policy pool_emails_admin on public.umrah_pool_email_jobs for select to authenticated using(public.is_admin());
