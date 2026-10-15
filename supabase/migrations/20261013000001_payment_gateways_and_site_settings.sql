-- Payment gateways become admin-managed integrations (same encrypted store as
-- the flight/hotel/visa suppliers), and a small key/value table holds the
-- site-wide settings an admin edits directly: social links and the bank
-- account that offline transfers are paid into.

alter table public.platform_api_integrations drop constraint platform_api_integrations_category_check;
alter table public.platform_api_integrations add constraint platform_api_integrations_category_check
  check (category in ('flights', 'hotels', 'visa', 'visa_processing', 'payments'));

create table public.platform_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

create policy "platform_settings: admin manage"
  on public.platform_settings for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create trigger set_platform_settings_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

create trigger platform_settings_audit
  after insert or update or delete on public.platform_settings
  for each row execute function public.audit_log_row_change();

insert into public.platform_settings (key, value) values
  ('social_links', '[
    {"platform": "instagram", "url": "https://www.instagram.com/scouttravelsolution"},
    {"platform": "tiktok", "url": "https://www.tiktok.com/@scoutsts2"}
  ]'::jsonb),
  ('bank_transfer', '{
    "bankName": "Premier Bank",
    "accountName": "Scout Travel Solution LTD",
    "accountNumber": "020160002200"
  }'::jsonb);
