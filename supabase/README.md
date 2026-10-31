# Database

Postgres on Supabase. The schema lives in `migrations/`, applied in filename
order. `seed.sql` is demo data for local and QA databases only and is never
run against production.

## Domains

Tables are grouped by a name prefix. Every table is in `public`, has a
primary key, and has row level security enabled.

| Domain | Tables |
|---|---|
| Identity and security | `profiles`, `login_events`, `mfa_recovery_codes`, `account_deletion_requests`, `notification_preferences`, `notifications`, `audit_logs` |
| Orders and money | `orders`, `order_items`, `payments`, `payment_methods`, `invoices`, `fx_rates`, `booking_requests` |
| Travel agencies (B2B) | `agencies`, `agency_*` (members, tiers, markups, wallet, top-ups, refunds, commissions, payouts, customers) |
| Partner onboarding | `*_applications`, `partner_accounts`, `partner_account_events`, `partner_document_reviews` |
| Hotels | `hotels`, `hotel_*` (rooms, room types, units, inventory, rate plans and rules, extras, bookings, managers, partners) |
| Event halls | `event_venues`, `venue_*`, `hall_bookings`, `hall_booking_events` |
| Flights | `airlines`, `airports`, `flight_offers`, `flight_bookings`, `flight_passengers` |
| Umrah | `umrah_*` (packages, departures, pricing, bookings, pilgrims, documents, rooming, custom requests) |
| Visa | `visa_*` (types, applications, members, documents, passports, appointments, decisions, case events) |
| Affiliates | `affiliates`, `affiliate_links`, `affiliate_clicks`, `affiliate_conversions`, `commission_payouts` |
| Content and settings | `amenities`, `property_links`, `property_reviews`, `traveler_profiles`, `traveler_documents`, `platform_settings`, `platform_api_integrations`, `admin_calendar_events` |

## Conventions

These follow the Supabase database advisor and common Postgres practice.
Check new migrations against them.

**Names.** Tables are plural `snake_case`. Columns are singular. Foreign keys
are `<thing>_id`, or a role name for profile references (`reviewed_by`,
`created_by`, `actor_id`). Indexes are `<table>_<columns>_idx`. Policies are
`"<table>: <who> <what>"`.

**Keys.** Primary keys are `uuid default gen_random_uuid()`. Lookup tables
also carry a unique natural code that other tables may reference
(`airports.iata_code`). Human-facing references
(`STS-2026-000123`) come from a sequence through a `generate_*` function and
carry a unique constraint.

**Foreign keys.** Every foreign key column has an index whose leading columns
are the key's columns (`20261031000010`). State `on delete` on purpose:
`cascade` for rows owned by the parent, `set null` for audit references to
people, the default otherwise.

**Types.** Times are `timestamptz`, dates without a time are `date`. Money is
`numeric` with two decimals (`numeric(12,2)` for new columns) and a
currency column beside it, never `float`. Emails are
`citext`. Fixed state sets are enums; free-form detail is `jsonb` with a
`'{}'::jsonb` default, never a substitute for a column the code filters on.

**Timestamps.** `created_at timestamptz not null default now()`. Tables
whose rows change carry `updated_at` and the `set_updated_at` trigger.

**Integrity.** Business rules that must always hold go in the database:
`check` constraints, partial unique indexes (one default card per customer),
exclusion constraints, and guard triggers for state machines. Money that
cannot be negative, ISO currency and country codes, and counts carry a
`check` (`20261031000012`). Match the form's validation to the constraint, so
the user sees a field error instead of a database error. Add a constraint to
a table with data as `not valid`, then `validate constraint`. Append-only
history tables (`*_events`, `*_history`) reject update and delete.

**Row level security.**
- Wrap session-constant calls in a sub-select so they run once per statement:
  `(select auth.uid())`, `(select public.is_admin())`.
- Compare a row's column to a membership set instead of calling a helper per
  row: `agency_id = any ((select public.my_agency_ids())::uuid[])`.
- Give each policy a role (`to authenticated`), so it is skipped for others.
- Index the columns that policies filter on.

**Functions.** `security definer` functions set `search_path` and check the
caller inside the body. Other `plpgsql` functions also set `search_path`
(`20261031000011`). `language sql` helpers stay without one so the planner
can inline them, and reference only built-ins and schema-qualified objects.

**Reads at scale.** PostgREST returns at most 1000 rows. Counts, sums and
reports run in SQL (RPC or view), never by adding up rows in application
code.

## Migrations

- One migration per change, named `YYYYMMDDNNNNNN_<what>.sql`. Never edit a
  migration that has been merged; add a new one.
- Write them to be safe to run twice (`if not exists`, catalog-driven `do`
  blocks), and to keep existing data valid.
- Neither deploy runs migrations. Apply to the QA database, verify, then to
  production, after a backup.
- Index builds lock writes on their table. For a large table, run
  `create index concurrently` from psql outside a transaction first.
- After applying, open Supabase Studio, Advisors, and clear any new
  performance or security findings.
