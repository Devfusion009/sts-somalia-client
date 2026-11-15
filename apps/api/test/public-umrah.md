# Public Umrah rebuild

Scope: public/group packages. Private package/request approval and deposit rules are preserved.

## Package setup

The administrator creates the name, description, airports, duration, price, included services, facilities, accommodation, meals, flights, transport, Makkah/Madinah nights and responsible person's name/telephone. The first departure date and capacity are required at creation. Package and departure save in one database transaction; return date is calculated as departure + duration − 1. Optional public agent contacts are entered explicitly by the administrator; internal agency records are not exposed.

Each dated departure is one inventory pool shared by B2C customers and B2B agents. Further departures retain their own dates and capacity. Existing departure operations remain available for manifests, room assignments, offline sales and cancellation.

Publication requires complete information and an open future departure with dates matching the package duration. Public prices and sharing rates must be positive. Published packages cannot lose their required details. Capacity cannot be reduced below held, confirmed and offline seats.

## Booking and payment

1. Catalog reads current inventory without the former seat-count cache. Sold-out groups and groups without an eligible departure do not appear. A subsequent available departure keeps the package listed.
2. Booking validates authentication, agency membership, package setup, departure cutoff, sharing rate and pilgrim count. Database row locks serialize reservations for the same departure. Both channels use server-side prices.
3. Checkout reserves seats temporarily, with booking status `pending`. Full payment is required; public agent bookings no longer offer a separate 24-hour hold.
4. A successful full receipt settles the order and confirms its booking through the existing fulfillment transition. Submitted bank/cash requests remain unconfirmed pending verification. Customer, wallet and manual payment paths share the database payment guard.
5. Abandoned/failed checkouts release seats after 30 minutes on the next catalog/detail/checkout/pool read or booking attempt. In-flight processing payments are protected for two hours; successful receipts and payments awaiting staff review remain protected for reconciliation. Orphan bookings without orders are also released after 30 minutes. Private bookings are excluded.
6. Public bookings cannot be inserted directly through customer table access or confirmed before full payment. Existing private inserts remain permitted under their existing ownership rules.

## Umrah pool

`/admin/umrah/pool` shows each public package/departure, responsible contact, capacity, confirmed seats, checkout holds, offline sales, remaining seats, applicants (pilgrims), live bookings and distinct booking customers. Links open package configuration and the existing departure manifest. Historical and closed departures remain visible to administrators.

## Verification

Run sequentially from the repository root:

```
npx tsc -p packages/shared-types
node packages/shared-types/test/public-umrah.test.mjs
node packages/shared-types/test/umrah.test.mjs
node apps/web/test/group-umrah-admin.test.cjs
node apps/web/test/private-umrah-packages.test.cjs
node apps/web/test/public-umrah-catalog.test.cjs
node apps/web/test/umrah-qa-regressions.test.cjs
node apps/web/test/agent-bookings.test.cjs
python3 apps/api/test/public-umrah-integration.py
npx tsc --noEmit -p apps/api
npx tsc --emitDeclarationOnly -p apps/api/tsconfig.build.json
npx tsc --noEmit -p apps/web
```

The integration runner creates a temporary PostgreSQL cluster with no TCP listener and stops it in `finally`. It loads production seat accounting, group booking, payment terms, payment settlement and fulfillment transition functions with isolated fixtures for external services. It exercises setup/publication errors, five-seat booking, overselling, invalid capacity reductions, full-payment enforcement, failed/expired checkout release, pending bank review, automatic confirmation, repeated settlement, cancellation, pool totals, authenticated row policies, unchanged private deposits and two concurrent sessions competing for the last seat. It never connects to an application database.

Component/service tests cover current catalog availability, released-seat relisting, offline sales, eligible departure selection, public phone links, required fields and existing agent/private regressions. They do not exercise live payment gateways or browser navigation.

## QA release gate

Apply `20261116000001_public_umrah_packages.sql` to QA before deploying the code. This migration has not been applied to QA or production by this task.

Older public packages lack the new required information and remain hidden until an administrator completes their setup. Existing bookings and private packages remain intact. Review those packages before releasing this change to a live environment.

After a requested QA deployment, verify the admin create/edit/publish flow, customer booking and successful payment, agent booking/payment, sold-out catalog removal, cancelled/expired-seat relisting and pool/manifest counts in the browser. Check the private approval/deposit flow as a regression before promotion. No live gateway transaction is part of the isolated tests.
