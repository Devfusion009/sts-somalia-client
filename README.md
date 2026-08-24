# STS Somalia — All-in-One Travel Platform

Backend-first build for Scout Travel Solution's travel platform: B2C customer
portal, B2B agent portal, hotel partner portal, flight/hotel/visa/Umrah
booking, affiliate marketing, and admin dashboard — all on one Postgres
schema with row-level security doing the access control.

Stack: **Next.js 16 (App Router)** + **Supabase (Postgres, Auth, Storage)**,
developed fully locally via the Supabase CLI/Docker; Vercel deployment comes
later once the backend is solid.

## Prerequisites

- Node.js 22+
- Docker (for the local Supabase stack)
- Supabase CLI (`npm i -g supabase` or see [install docs](https://supabase.com/docs/guides/local-development/cli/getting-started))

## Getting started

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # pre-filled for this repo's local stack
cp apps/api/.env.example apps/api/.env.local
./start.sh                                     # Supabase + redis + api + web, hot reload
```

`./start.sh prod` runs the same stack against a production build instead of
`next dev`; `./start.sh --stop` shuts everything down. `./start.sh --help`
covers the rest.

- App: http://localhost:3000
- Admin portal: http://admin.stssomalia.test:3000
- Agent portal: http://agent.stssomalia.test:3000
- API (NestJS): http://localhost:4000
- Supabase Studio (DB/Auth/Storage GUI): http://127.0.0.1:54323
- Mailpit (captures auth emails locally): http://127.0.0.1:54324

To run the apps on the host instead of in containers, start the database on
its own with `npm run db:start`, then `npm run dev:web` and `npm run dev:api`.

Run `npm run db:status` any time to see the local API URL and keys — if you
ever reset your Docker volumes, the keys in `.env.local` may need updating
from there.

## Database workflow

Schema lives entirely in `supabase/migrations/*.sql`, applied in filename
order. There is no ORM — the schema, RLS policies, and the few pieces of
business logic that must be transactional (order-number generation,
affiliate commission attribution, audit logging, role-promotion functions)
all live in SQL so they hold regardless of which app talks to the database.

```bash
npm run db:reset      # drop + recreate local DB, replay all migrations + seed.sql
npm run db:diff -- some_change_name   # generate a new migration from a Studio schema edit
npm run db:types       # regenerate src/lib/types/database.types.ts after any schema change
```

Always run `db:types` after touching migrations — the whole app is typed
against the generated `Database` type.

## Architecture

### Roles & multi-tenancy

`public.profiles.role` (`customer | agent | hotel_partner | affiliate | admin`)
is the coarse switch for which portal a signed-in user lands in. It is
**never client-writable** — signup always creates a `customer` profile
(`handle_new_user` trigger), and promotion only happens through admin-gated
SQL functions (`promote_user_role`, and the `approve_*_application`
functions that call it) after an application/approval flow:

- `agency_applications` → `approve_agency_application()` → creates an
  `agencies` row, seats the applicant as `owner` in `agency_members`,
  promotes their role to `agent`.
- `hotel_partner_applications` → `approve_hotel_partner_application()` →
  same pattern for `hotel_partners` / `hotel_partner_members`.
- `affiliate_applications` → `approve_affiliate_application()` → creates an
  `affiliates` row with a generated referral code.

B2B agencies and hotel partners can have multiple staff members
(`agency_members` / `hotel_partner_members`, `owner` vs `staff`), so both
portals are ready for teams, not just single users.

### Booking verticals → unified orders

Each vertical is its own set of tables with its own booking status:

- **Hotels**: `hotel_partners` → `hotels` → `hotel_rooms` →
  `hotel_room_inventory` (per-date price/availability) → `hotel_bookings`.
- **Flights**: `airports` / `airlines` reference data, `flight_offers`
  (short-lived search cache written server-side from a GDS/NDC API),
  `flight_bookings` + `flight_passengers`.
- **Visa**: `visa_types` → `visa_applications` (with a full
  `visa_application_status_history` audit trail) → `visa_documents`.
- **Umrah**: `umrah_packages` → `umrah_package_departures` (dated, seat
  inventory) → `umrah_bookings` + `umrah_pilgrims`.

`orders` / `order_items` / `payments` / `invoices` sit on top as a single
checkout & finance ledger. `order_items` uses **nullable per-vertical
foreign keys** (`hotel_booking_id`, `flight_booking_id`, ...) with a check
constraint enforcing exactly one is set, rather than an untyped polymorphic
id — so Postgres still enforces referential integrity across verticals.

Order status transitions (e.g. `pending_payment` → `paid`) are expected to
happen from a payment-provider webhook handler using the service-role
client (`src/lib/supabase/admin.ts`), which bypasses RLS by design.

### Affiliates

`affiliate_links` (per-affiliate tracked links) → `affiliate_clicks`
(high-volume, written server-side only) → `affiliate_conversions`. A
trigger on `orders` (`record_affiliate_conversion`) automatically creates a
pending conversion + computes commission whenever an attributed order
becomes `paid`. `commission_payouts` tracks payout runs to affiliates.

### Cross-cutting

- **Audit log**: `audit_logs` is append-only (no client grants at all);
  rows are written by a `SECURITY DEFINER` trigger on orders/bookings/
  payments/visa applications.
- **Notifications**: `notifications` per profile; clients can only mark
  their own as read, all other fields are system-authored.
- **Storage**: buckets `avatars`, `hotel-images`, `umrah-images` (public
  read), `kyc-documents`, `visa-documents`, `invoices` (private, scoped by
  folder-prefix RLS policies matching the owning entity's id).

### RLS shape (applies everywhere)

Every table has RLS enabled. The recurring pattern is: the row's owner
(customer/applicant/submitter) can read/manage their own rows; a B2B
agency/hotel-partner member can read rows tied to their organization
(`is_agency_member()`, `is_hotel_partner_member()` helper functions); admin
(`is_admin()`) can do anything; and public catalog data (published hotels,
rooms, visa types, Umrah packages, airports/airlines) is readable by
anonymous visitors so the B2C site can be browsed pre-login.

## App-layer integration

- `src/lib/supabase/client.ts` — browser client (Client Components).
- `src/lib/supabase/server.ts` — Server Component / Server Action / Route
  Handler client, runs as the signed-in user (RLS enforced).
- `src/lib/supabase/admin.ts` — service-role client. **Bypasses RLS.**
  Server-only (`import "server-only"` guards against accidental client
  bundling); use only for webhooks, trusted background jobs, and admin
  operations that legitimately need to cross RLS boundaries.
- `src/lib/auth/session.ts` — `getCurrentProfile()`, `requireUser()`,
  `requireRole(...roles)` for gating Server Components/layouts.
- `proxy.ts` (repo root) — Next.js 16 renamed `middleware.ts` → `proxy.ts`.
  Refreshes the Supabase session cookie on every request and redirects
  signed-out users away from `/account`, `/agent`, `/partner`, `/admin`,
  `/affiliate`. Fine-grained role checks happen per-portal via
  `requireRole()` in that portal's layout.

## Environment variables

See `.env.example`. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is safe for the
browser; `SUPABASE_SECRET_KEY` must never reach client code.

## Deploying later (Vercel)

Nothing here is local-only by design — when ready, create a hosted Supabase
project, run `supabase link` + `supabase db push` to apply these same
migrations, point `NEXT_PUBLIC_SUPABASE_URL`/keys at the hosted project via
`vercel env`, and deploy. No schema changes needed to move environments.
