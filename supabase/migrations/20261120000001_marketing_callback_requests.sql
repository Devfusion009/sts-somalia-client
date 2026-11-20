create table public.marketing_callback_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  phone text not null check (phone ~ '^\+?[0-9 -]{7,20}$'),
  service text not null check (service in ('flights','hotels','visa','umrah','events','other')),
  message text check (char_length(message) <= 1000),
  status text not null default 'new' check (status in ('new','contacted','closed')),
  submitted_on date not null default current_date,
  created_at timestamptz not null default now()
);
create unique index marketing_callback_daily_unique on public.marketing_callback_requests (phone, service, submitted_on);
create index marketing_callback_newest on public.marketing_callback_requests (created_at desc);
alter table public.marketing_callback_requests enable row level security;
create policy "marketing callbacks: admin read" on public.marketing_callback_requests for select to authenticated using (public.is_admin());
create policy "marketing callbacks: admin update" on public.marketing_callback_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant select,update on public.marketing_callback_requests to authenticated;
