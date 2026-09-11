-- M8, reframed: no real vendor exists yet, and one won't be built against
-- guessed documentation. Instead this makes the partner contract itself
-- admin-configurable — a "custom" REST adapter that reads its behaviour
-- (submit request shape, where to find the reference/status in the
-- response, how to poll, what a webhook payload's fields are called, how
-- vendor statuses map onto ours) from data an admin fills in through the
-- Integrations page, not from a new adapter file a developer has to write
-- and deploy. Whatever vendor STS eventually signs, if it exposes a
-- reasonably ordinary REST + webhook API, it can be wired up without a
-- single line of new code.
--
-- config is generic on platform_api_integrations (not visa-specific by
-- column name) because the same "admin fills in request shape instead of a
-- developer writing an adapter" idea is not inherently visa-only — nothing
-- about the column ties it to visa, only how the "custom" case in
-- modules/visa/partner/registry.ts happens to interpret it.
alter table public.platform_api_integrations
  add column config jsonb not null default '{}'::jsonb;

comment on column public.platform_api_integrations.config is
  'Provider-specific behavioural config (non-secret) — e.g. the "custom" visa-processing adapter''s request/response shape and status map. Secrets stay in credentials_encrypted; this column is plaintext and admin-editable.';
