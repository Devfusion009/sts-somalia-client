-- ============================================================================
-- Affiliate Marketing
-- ============================================================================

create type public.conversion_status as enum ('pending', 'approved', 'paid', 'reversed');
create type public.payout_status as enum ('pending', 'processing', 'paid', 'failed');

create table public.affiliates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  referral_code text not null unique,
  status public.agency_status not null default 'pending',
  commission_rate numeric(5,2) not null default 5 check (commission_rate >= 0 and commission_rate <= 100),
  payout_details jsonb not null default '{}'::jsonb,
  total_earned numeric(12,2) not null default 0,
  total_paid numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_affiliates_updated_at
  before update on public.affiliates
  for each row execute function public.set_updated_at();

create table public.affiliate_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  notes text,
  status public.application_status not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now()
);

create or replace function public.is_affiliate_owner(target_affiliate_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.affiliates where id = target_affiliate_id and profile_id = auth.uid()
  );
$$;

create or replace function public.approve_affiliate_application(application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.affiliate_applications;
  new_affiliate_id uuid;
  code text;
begin
  if not public.is_admin() then
    raise exception 'only admins can approve affiliate applications';
  end if;

  select * into app from public.affiliate_applications where id = application_id for update;
  if not found then
    raise exception 'application not found';
  end if;
  if app.status <> 'pending' then
    raise exception 'application already processed';
  end if;

  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.affiliates (profile_id, referral_code, status)
  values (app.applicant_id, code, 'active')
  returning id into new_affiliate_id;

  update public.affiliate_applications
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = application_id;

  perform public.promote_user_role(app.applicant_id, 'affiliate');

  return new_affiliate_id;
end;
$$;

create or replace function public.reject_affiliate_application(application_id uuid, notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins can reject affiliate applications';
  end if;

  update public.affiliate_applications
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_notes = notes
    where id = application_id and status = 'pending';
end;
$$;

create table public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates (id) on delete cascade,
  campaign_name text,
  target_path text not null default '/',
  code text not null unique,
  clicks_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index affiliate_links_affiliate_idx on public.affiliate_links (affiliate_id);

-- High-volume table: clicks are written by a trusted server route (service
-- role, which hashes IPs before insert) so there is no client insert policy.
create table public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.affiliate_links (id) on delete cascade,
  visitor_id text,
  ip_hash text,
  user_agent text,
  referrer text,
  created_at timestamptz not null default now()
);

create index affiliate_clicks_link_idx on public.affiliate_clicks (link_id);
create index affiliate_clicks_created_idx on public.affiliate_clicks (created_at);

create table public.affiliate_conversions (
  id uuid primary key default gen_random_uuid(),
  click_id uuid references public.affiliate_clicks (id),
  affiliate_id uuid not null references public.affiliates (id),
  order_id uuid not null references public.orders (id),
  commission_amount numeric(12,2) not null check (commission_amount >= 0),
  status public.conversion_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (order_id)
);

create index affiliate_conversions_affiliate_idx on public.affiliate_conversions (affiliate_id);

create table public.commission_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates (id),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'USD',
  status public.payout_status not null default 'pending',
  payout_reference text,
  period_start date,
  period_end date,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index commission_payouts_affiliate_idx on public.commission_payouts (affiliate_id);

-- ----------------------------------------------------------------------------
-- Attribution: link orders back to the affiliate that referred them, and
-- auto-record a pending conversion once the order is paid.
-- ----------------------------------------------------------------------------
alter table public.orders add column affiliate_id uuid references public.affiliates (id);
create index orders_affiliate_idx on public.orders (affiliate_id);

create or replace function public.record_affiliate_conversion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.affiliate_id is not null and new.status = 'paid'
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.affiliate_conversions (affiliate_id, order_id, commission_amount, status)
    select new.affiliate_id, new.id, round(new.total * a.commission_rate / 100.0, 2), 'pending'
    from public.affiliates a where a.id = new.affiliate_id
    on conflict (order_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger orders_record_affiliate_conversion
  after insert or update of status on public.orders
  for each row execute function public.record_affiliate_conversion();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.affiliates enable row level security;
alter table public.affiliate_applications enable row level security;
alter table public.affiliate_links enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.affiliate_conversions enable row level security;
alter table public.commission_payouts enable row level security;

create policy "affiliates: self reads own"
  on public.affiliates for select to authenticated
  using (profile_id = auth.uid());

create policy "affiliates: admin manage"
  on public.affiliates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "affiliate_applications: applicant reads own"
  on public.affiliate_applications for select to authenticated
  using (applicant_id = auth.uid());

create policy "affiliate_applications: applicant submits"
  on public.affiliate_applications for insert to authenticated
  with check (applicant_id = auth.uid());

create policy "affiliate_applications: admin manage"
  on public.affiliate_applications for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "affiliate_links: owner manages own"
  on public.affiliate_links for all to authenticated
  using (public.is_affiliate_owner(affiliate_id))
  with check (public.is_affiliate_owner(affiliate_id));

create policy "affiliate_links: admin manage"
  on public.affiliate_links for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "affiliate_clicks: owner reads own link clicks"
  on public.affiliate_clicks for select to authenticated
  using (exists (select 1 from public.affiliate_links l where l.id = link_id and public.is_affiliate_owner(l.affiliate_id)));

create policy "affiliate_clicks: admin manage"
  on public.affiliate_clicks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "affiliate_conversions: owner reads own"
  on public.affiliate_conversions for select to authenticated
  using (public.is_affiliate_owner(affiliate_id));

create policy "affiliate_conversions: admin manage"
  on public.affiliate_conversions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "commission_payouts: owner reads own"
  on public.commission_payouts for select to authenticated
  using (public.is_affiliate_owner(affiliate_id));

create policy "commission_payouts: admin manage"
  on public.commission_payouts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
