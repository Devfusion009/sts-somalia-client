-- ============================================================================
-- Admin-managed third-party API integrations (flights/hotels/visa search
-- suppliers). Credentials are encrypted application-side (AES-256-GCM, see
-- src/lib/integrations-crypto.ts) before they ever reach this table — the
-- column only ever holds ciphertext, never a plaintext key/secret. Only
-- admins can read/write this table at all; the live search code path reads
-- it via the service-role client (createAdminClient()), which bypasses RLS
-- entirely, exactly the "trusted server-side integration" case its own doc
-- comment anticipates.
-- ============================================================================

create table public.platform_api_integrations (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('flights', 'hotels', 'visa')),
  provider_key text not null unique,
  is_active boolean not null default false,
  credentials_encrypted text,
  last_tested_at timestamptz,
  last_test_ok boolean,
  last_test_message text,
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index platform_api_integrations_category_idx on public.platform_api_integrations (category);

alter table public.platform_api_integrations enable row level security;

create policy "platform_api_integrations: admin manage"
  on public.platform_api_integrations for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create trigger set_platform_api_integrations_updated_at
  before update on public.platform_api_integrations
  for each row execute function public.set_updated_at();

create trigger platform_api_integrations_audit
  after insert or update or delete on public.platform_api_integrations
  for each row execute function public.audit_log_row_change();
