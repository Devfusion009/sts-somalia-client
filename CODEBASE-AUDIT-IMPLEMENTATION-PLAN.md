# STS Somalia codebase audit and implementation brief

## Implementation status (19 November 2026, QA migration update)

The current working tree remains uncommitted and the application code has not been deployed. Six pending migrations were applied to the linked QA project `uvmxxtdneryuuiqcwegx`; production was not changed.

- **Completed locally:** deployment verification gates; durable callback storage, admin queue and status action; removal of the inactive newsletter form; complete/error-checked My Bookings reads beyond the PostgREST page limit; read-only public Umrah catalog queries with request-scoped detail memoization; pool-worker expiry, batched recipients and four-way bounded email sending; explicit catalog outage behavior; paged admin Umrah requests; single-RPC agency aging; parallel admin Orders reads; Docker context exclusions; current release notes in README.
- **Verified locally:** API and web TypeScript checks, touched-file lint, the focused booking/catalog/callback/Umrah worker tests, isolated PostgreSQL tests for callback and agency aging, and workflow YAML parsing. The six new SQL migrations are recorded in QA migration history.
- **Completed locally since the initial audit:** a bounded unified My Bookings page/count API with SQL ordering, exact timeframe counts, whole-trip page keys, and customer/agent ownership checks. Customer and agent booking lists and the account overview now use it. Isolated PostgreSQL tests cover 1,001 bookings, page boundaries, whole trips, and ownership; API tests cover bounded detail reads and source errors. A dedicated worker is configured for QA and production, with deployment checks that it starts.
- **Still required before claiming the performance gates:** QA baseline and after-change measurements; queue-age alerts; application-level QA smoke tests after code deployment; end-to-end QA/production release validation. Supabase types were regenerated from the migrated QA schema and the affected API/web type checks pass. A dedicated worker owns QA/production timers in deployment configuration; this needs QA runtime verification after deployment.

Date: 19 November 2026. Scope: the current local `qa-source` working tree, including the uncommitted Umrah changes. This is a static audit of the web app, API, shared types, SQL migrations, CI, deployment, and repository assets. It is not a production latency benchmark or an exhaustive security review. No application code, database, or deployment was changed for this audit.

## Findings, in priority order

| Priority | Verified evidence | Effect | Instruction |
| --- | --- | --- | --- |
| P0 | `.github/workflows/ci.yml` triggers only on pull requests; `.github/workflows/deploy.yml` deploys every push to `main`. The documented release path pushes `main` directly. CI runs lint/build but no test suite. | The normal QA release can start without the CI checks or regression tests passing. | Make the deploy workflow depend on a verify job for the same commit. Run API/web type checks and a curated deterministic test suite before either QA deploy job. Keep production promotion gated by the same verified SHA and QA result. |
| P0 | `apps/web/src/components/marketing/lead-actions.ts:40,56` logs callback details and newsletter addresses, then returns `{ ok: true }`. | Customers see a success response although no lead or subscription is saved; contact data enters logs. | Replace these actions with durable submission and staff notification, or remove the forms until delivery exists. Do not log submitted personal details. Test save failure, duplicate submission, and staff visibility. |
| P0 | `apps/api/src/modules/bookings/bookings.service.ts:79-111` reads all five booking tables plus order items without pagination; it uses `*.data ?? []` without checking each query error. | Larger accounts can be truncated by the database API's row cap. A failed query can appear as an empty booking history. | Introduce a bounded, stable, server-side page or cursor API for unified bookings and an aggregate count. Check all six errors. Test more rows than the configured API limit and one failing vertical. Preserve order grouping and B2C/B2B ownership checks. |
| P1 | `apps/api/src/modules/umrah/repositories/package.repository.ts:49-74` calls `release_public_umrah_checkouts()` before public catalog reads and again on detail, then calls `release_stale_umrah_seats()` without checking its error. `apps/web/src/app/(marketing)/umrah/[slug]/page.tsx:31-49` invokes the detail query from both metadata and page rendering. | A public GET can perform global write/lock work and repeated database round trips; a failed second cleanup call is hidden. | Move expiration to a scheduled, observable job and keep checkout/seat reservation transactional. Make public reads side-effect free. Deduplicate metadata/page data loading. Add stale-seat, concurrent final-seat, and cleanup-failure regression tests. |
| P1 | `apps/web/src/app/admin/(portal)/umrah/bookings/page.tsx:59-72` calls `poolRequests.list.query()` for every request, then filters in memory. `apps/api/src/modules/umrah/services/pool-request.service.ts:40-54` fetches successive 500-row pages until all rows are loaded. | Umrah Orders latency, API traffic, and memory grow with the entire request history, even when showing one page. | Add a server-side filtered request page and aggregate counts. Fetch only requests visible for the current page/filter. Keep the pool-capacity summary separate. Test >500 requests, filters, total counts, and admin actions. |
| P1 | `apps/web/src/modules/agencies/queries.ts:727-763` runs one `agency_wallet_transactions` query per agency with negative credit balance. The aging page and export both call it. | The report has N+1 database round trips and slows as agency count rises. | Calculate the latest non-negative balance in one SQL query/RPC, preserving current aging semantics. Compare old/new results for never-clean, recently-clean, and many-transaction agencies. Inspect `EXPLAIN (ANALYZE, BUFFERS)` before adding an index. |
| P1 | `apps/web/src/instrumentation.ts:14-61` starts in-process email and Umrah timers; the Umrah timer requires `CRON_SECRET`. `apps/web/src/lib/notifications/email-outbox.ts:192-231` and `apps/web/src/modules/umrah/pool-worker.ts:20-47` process claimed email jobs serially, with per-job reads and sends. | Work depends on web process uptime/configuration; each additional web replica runs its own scheduler. A slow provider extends queue time. | Run one externally scheduled worker per environment, retain DB lease/idempotency rules, batch recipient reads, and use small bounded send concurrency. Record queue age, failed jobs, and run duration. Test restart, overlapping runs, missing scheduler config, provider timeout, and retry. |
| P1 | `apps/web/src/modules/umrah/queries.ts:12-30`, `apps/web/src/modules/visa/queries.ts:14-49`, and `apps/web/src/modules/hotels/queries.ts:54-70` turn catalog failures into empty lists. | A provider or API outage looks like no products and hides the real problem. | Use an explicit unavailable state and structured error telemetry. Allow a stale public catalog only where its data is safe to cache; do not cache live inventory or pricing. Test empty catalog separately from failed fetch. |
| P2 | `apps/web/src/app/admin/(portal)/orders/page.tsx:83-94` waits for the order queue before starting the independent Umrah request count, then fetches order details and payment proofs in stages. | Extra serial round trips add to admin page response time. | Start independent reads together; keep the detail read bounded to displayed orders. Profile the route before and after. |
| P2 | Several files exceed 700 lines, including `apps/web/src/modules/visa/components/steps.tsx` (1,503), `apps/web/src/modules/admin/actions.ts` (1,102), and `apps/web/src/modules/agencies/queries.ts` (1,255). | Review and targeted testing are harder; small changes touch broad modules. | Split by workflow or data responsibility only while changing those workflows. Keep exported contracts and tests stable; avoid a bulk rewrite. |
| P2 | `README.md` still describes a future Vercel deployment and older source locations, while `AGENTS.md` describes current QA/production AWS deployment. `output/`, `qa-evidence/`, and marketing originals are tracked; root `.dockerignore` does not exclude the first two from build context. | Operators can follow obsolete release steps, and unused evidence enters Docker build context. | Update the README from current deployment truth. Preserve QA evidence and historical booking records, but move/archive artifacts outside build context or exclude them from Docker context after checking CI use. Remove only proven unreferenced assets. |

## Implementation sequence for the coding agent

### 0. Establish a baseline

1. On QA, record p50/p95 response time, database query count, payload size, and error rate for: public Umrah listing/detail, B2C My Bookings, admin Umrah Orders, admin Orders & Payments, and agency aging report. Capture a small and a high-volume account/pool. Use synthetic data for high-volume cases.
2. Record email queue depth, oldest pending age, failed count, and processing duration. Record Core Web Vitals for the marketing home page and one portal page. Note the current first carousel video is about 2.8 MB, but change its delivery only if the trace shows an actual loading cost; its video is already delayed until page load on fast connections.
3. Keep the measurements and SQL plans in a dated QA evidence folder. Define an improvement target per route from this baseline, not from an assumed latency number.

### 1. Restore a trustworthy release and data path

1. Add a reusable verification job to the actual `main` deployment path. At minimum: shared-types tests, API/web type checks and lint, core booking/payment/Umrah tests, and the isolated PostgreSQL integration suite. Deploy only the verified commit. Keep tests independent of production credentials.
2. Make callback/newsletter actions persist and surface records, or remove their submission controls. Test the real staff handoff. Remove personal-data logging.
3. Replace unbounded My Bookings reads with a paginated unified query. Preserve the current sort/grouping rules. Make failures visible instead of returning partial history. Add >1,000-row fixtures and B2C/B2B isolation assertions.

**Gate:** CI must fail on a broken booking/payment test; My Bookings must show every page of a large account; a failed source must display an error, never “No bookings.”

### 2. Remove expensive work from customer reads

1. Move public Umrah expiration out of catalog/detail requests. Keep an idempotent scheduled cleanup with observable failures and a read-only availability query. Keep the database's final-seat lock/transaction as the authority.
2. Share one request-scoped package result between Umrah metadata and page rendering, then measure actual RPC count. Review `findPublishedCards` only after measuring catalog size; its in-memory availability filter currently has a correctness reason.
3. Replace hidden catalog failures with distinct empty/error states for Umrah, visa, and hotels. Preserve public cache invalidation and never cache seat inventory, payment state, or individualized prices.

**Gate:** public GETs do no cleanup writes; concurrent final-seat, stale checkout, publication, and outage tests pass; catalog p95 improves against baseline.

### 3. Bound admin queries and background work

1. Add filtering, stable pagination, and count queries to Umrah pool requests; update Umrah Orders to use them. Do not load the entire request history or all departures just to show the first page. Keep detailed capacity and applicant lists on the selected pool page.
2. Replace the agency aging N+1 calls with one authorized aggregate/RPC. Use the existing `(agency_id, created_at)` index as a starting point; add an index only if the QA plan shows it is needed.
3. Batch notification recipient lookup and add bounded concurrency after ensuring leases prevent duplicate sends. Move timer ownership outside the web request process. Alert on queue age and repeated failures.
4. Parallelize independent admin Orders reads and measure their contribution separately.

**Gate:** query count is bounded as row counts grow; admin filters and totals remain exact; overlapping worker invocations do not duplicate email; failed jobs remain retryable.

### 4. Remove verified waste and maintainability drag

1. Inventory imports/routes before deleting code or assets. Preserve private Umrah historical read paths, paid orders, invoices, and all applied SQL migrations. Archive evidence rather than deleting it blindly.
2. Exclude non-runtime QA artifacts from Docker context; update current deployment and database-type instructions in `README.md`.
3. Regenerate shared Supabase types after the pending Umrah migrations reach QA and remove the temporary `as never` RPC casts from `apps/api/src/modules/umrah/services/pool-request.service.ts` and `apps/web/src/modules/umrah/pool-request-actions.ts`. Keep one admin confirmation path through the API if its access and error behavior match the current server action.
4. Split large modules only when their affected workflow receives tests. Remove dead exports after an import/route scan and review.

**Gate:** no removed asset is referenced by a page, seed, email, or historical record; build context shrinks; type checks and affected workflow tests pass.

## Rules for every implementation slice

- One measurable bottleneck or correctness issue per slice. Add a regression test before or alongside its fix, run the relevant checks, then compare QA metrics. Stop optimizing when the target is met.
- Treat migrations as append-only. Apply new SQL to QA first, regenerate types, verify RLS and concurrent booking/payment behavior, then promote through the documented release path. Do not connect local or QA work to production Supabase.
- Keep all changes local and uncommitted until the user explicitly asks to commit/push. Do not start dev servers or full builds merely to work on this brief. Stop any task-started services after verification.
- Report completed changes, measurements, tests, and residual risks after each slice before starting the next.
