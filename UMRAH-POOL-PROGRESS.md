# Request-first Umrah implementation evidence

Work is local and uncommitted. Six migrations (`20261117000001`–`20261117000006`) were applied to QA project `uvmxxtdneryuuiqcwegx`. Production was not modified.

| Task | Result | Evidence |
| --- | --- | --- |
| 01 Baseline | Passed | Shared type compiler; 8 existing shared/web Umrah/agent suites; isolated SQL integration including last-seat race. Logs initially captured under `/tmp/sts-umrah-request-tests`. Sandbox prevented the test socket; isolated runner passed outside sandbox. |
| 02 Domain | Passed | `npx tsc -p packages/shared-types`; `node packages/shared-types/test/pool-request.test.mjs`: 17 tests passed. |
| 03 Schema/access | Passed | `python3 apps/api/test/public-umrah-integration.py --request-pool`: additive schema, legacy defaults, feature flag disabled, direct-write rejection, customer/traveler isolation and admin reads. |
| 04 Submission | Passed | Same isolated runner: server pricing, idempotent retry, changed-payload rejection, immutable terms/capacity, unauthorized withdrawal, release once, all-or-nothing agency batch, family counts, two concurrent final-seat submissions and one activation event. |
| 05–12 | In progress | Admin/customer/agent integration, activation, notifications, payments, expiry and full browser QA remain. |

The temporary PostgreSQL runner stops its database in `finally`. Unit/SQL results do not establish real provider or browser acceptance.

## QA acceptance checkpoint — 18 November 2026

- Admin browser: created and published fictional package `430b5640-77c8-4897-ac2c-3102df8be7d8`, slug `qa-14-day-umrah-formation-november-2026-fuef`.
- Departure `9476f02a-1a6f-4a3e-9e3c-14e09b6ceab1`: 10–23 February 2027, 40 places, USD 1,800 quad sharing, 8 Makkah / 5 Madinah nights, half board. Four generated QA-labelled images uploaded through the admin browser and verified persisted.
- Customer browser: request `2faf2e09-c13b-4cec-a3a2-60384a53edc9` / `UMR-3C3243CAEECD4F20` shows Awaiting group completion. Remote read verified 1 allocated, 39 remaining, status requested, order_id null.
- Email acceptance NOT passed: received notification remains pending after seven failed attempts. The previous temporary SMTP sink did not implement authenticated SMTP correctly. Added `apps/web/test/helpers/smtp-capture.cjs` and `apps/web/test/smtp-capture.test.cjs`; authenticated Nodemailer capture test passes. Actual worker delivery must be retried against this corrected sink.
- API pagination tests: six service tests pass, including requests beyond 500 rows and a failed later page rejecting incomplete totals.
- Isolated SQL tests passed activation rollback/retry, last-seat race, payment guards, expiry, replacement and outbox leases. These are not browser/provider acceptance.
- Remaining: agent browser request/batch, complete 40-place activation, worker mail capture, customer simulated payment, agent wallet/manual-review acceptance, mobile/error states and final regression checks. Do not promote this feature as fully accepted yet.
- Previous local API/web/mail services are no longer running (verified process inventory on resume). Temporary test files were cleared between sessions; no credentials were added to source.
- Resume checks: 6 API service tests, 6 request-form tests, 4 email-template tests, and 1 authenticated SMTP-capture test passed. Preserved existing `agency_members` and `quote_hotel_stay` type overrides when regenerating QA database types.

## Notification fix and QA retry

- Found an application cause beyond the SMTP test fixture: `rootOrigin()` returns an empty string for path-based deployments. The pool worker rejected mail before sending even when `NEXT_PUBLIC_SITE_URL` was configured.
- Fixed worker origin selection: agent hostname, then public hostname, then configured site URL. Two regression tests cover customer and agent path-based deployments.
- Ran actual pool worker logic and email templates against QA with a Nodemailer loopback capture transport substituted for the production email wrapper. Result: sent 1, failed 0, skipped 0; request receipt job became `sent` on attempt 8. Captured one email, no external delivery. This validates worker/template/outbox/SMTP integration; the full Next.js email wrapper and provider acceptance remain separate checks.
- Temporary capture server closed in `finally`; no portal servers were started during this retry.

## README gates continued — 18 November 2026

- Added `apps/api/test/pool-request-closure.sql` to the isolated integration runner. Passed: package/configuration transaction rollback, successful atomic creation, no early formation release, deadline closure, repeat sweep without duplicate release/notice, no order on formation failure, closed pool rejects new requests.
- Command: `python3 apps/api/test/public-umrah-integration.py --request-pool` — passed all legacy, request, activation, payment, queue and closure checks. Temporary PostgreSQL stopped by runner cleanup.
- Ran all eight baseline suites from README section 11. Initially, three component regressions failed because the VM lacked crypto. Review also identified `crypto.randomUUID()` is unavailable on QA's insecure HTTP origin. Updated form key generation to UUID v4 from `crypto.getRandomValues`; VM intentionally exposes only getRandomValues. Added 20-key format/uniqueness regression. All eight baseline suites now pass, including 15 Umrah QA regressions and 14 agent-booking tests.
- ESLint on changed booking form passed. Added `output/umrah-qa/asset-manifest.json` with byte sizes and SHA-256 hashes of the four uploaded illustrations.
- Full browser/payment acceptance remains incomplete; no production changes or commit/push performed.

## Agency browser acceptance — 18 November 2026

- Started local Next.js, API and loopback SMTP capture with QA-only environment overrides. Demo agency agent signed in through the actual browser and selected existing fictional customer `QA Agent Flow 01`.
- The agent booking desk displayed the published QA package, 39 places remaining and USD 1,800 per pilgrim. Submitted three named pilgrims through its actual form with the pool terms accepted. Result: request `ac5f894b-1659-4777-b7a5-6971975834e3`, reference `UMR-B8CAE4D2EA5849AA`, three pilgrims, USD 5,400 quote, “Awaiting group completion,” and no Pay now action. Screenshot: `output/umrah-qa/agent-request-three.png`.
- The same browser session showed a USD 5,505 available agency wallet before submission. Scoped post-request database verification did not complete because the command approval gate rejected escalation, then the temporary runtime was cleared. Consequently wallet balance, commission, persisted seat count (expected 4/40), order absence and email capture remain unverified for this agent request.
- Fixed the request form's pending label to “Submitting request…”; the legacy immediate-booking label remains “Creating booking…”. This is a copy correction, not a new lifecycle behavior.
- Updated `output/umrah-qa/asset-manifest.json` with QA `umrah-images` storage paths read from the package record. Images remain fictional QA illustrations.
- Local services are no longer listening on ports 3000, 4000 or 2525. No production change, commit or push was performed.

## Local verification after agency browser pass

- Added a request-first agency assertion in `apps/api/test/pool-request-checks.sql`: a 39-pilgrim agency request must retain agency attribution and remain `requested` with no order before activation.
- `python3 apps/api/test/public-umrah-integration.py --request-pool` was attempted after this assertion, but PostgreSQL could not bind its temporary Unix socket under the current sandbox (`Operation not permitted`). The assertion is therefore pending; earlier isolated SQL run passed before this assertion was added.
- From `apps/web`, `npx eslint 'src/app/(marketing)/umrah/[slug]/booking-form.tsx'` passed and `npx tsc --noEmit -p .` passed. A corrupted ignored `.next/dev/types/validator.ts` generated by the previous dev session was moved to `/tmp` before the successful type check.
- `node --test apps/web/test/umrah-qa-regressions.test.cjs` passed. The test runner reported the file as one passing subtest.
- Next browser acceptance requires customer B, agent batch, 40-place activation, payment and expiry paths. QA feature flag remains enabled for this fictional fixture.

## Live QA inventory verification

- Re-ran `python3 apps/api/test/public-umrah-integration.py --request-pool` with the approved temporary local PostgreSQL socket. Passed all request, activation, payment, closure and legacy assertions, including the new agency order/attribution assertion. The temporary cluster stopped in the runner's cleanup.
- Read the scoped fictional QA records after the agent browser request. Departure `9476f02a-1a6f-4a3e-9e3c-14e09b6ceab1` shows `booked_seats=4`, `total_seats=40`, `formation_status=forming`: one customer place plus three agent places, leaving 36. Agent request `ac5f894b-1659-4777-b7a5-6971975834e3` is `requested`, three pilgrims, USD 5,400, agency attributed and `order_id=null`. Its receipt email job is `sent` after one attempt. The prior browser screenshot shows no payment action; no fresh rendered mail capture was retained after the temporary runtime reset.
- These observations complete the agent's first three-place request gate, but do not establish the separate batch, wallet/commission balances or full-capacity activation gates.

## Final local checks for this checkpoint

- `npx tsc --noEmit -p apps/api` passed.
- ESLint passed across all touched web app routes, form, instrumentation, notifications, admin actions and Umrah modules.
- `npx tsc --noEmit -p apps/web` passed after clearing the stale generated validator.
- `git diff --check` passed. No local web/API/SMTP listener remained on ports 3000/4000/2525.

## Full-pool QA lifecycle — 18 November 2026

- Authenticated fictional customer B `d6f61c53-630d-4d12-b0a8-a452aae1e710` submitted two named pilgrims through the QA business RPC: request `6fee8007-cd8a-4c12-914c-fcb973646cfd`, USD 3,600, no order. A and B could not read each other's request rows. The pool reached 8/40 after the agency batch. B withdrew, releasing exactly two places (6/40), then resubmitted with a new idempotency key: request `c61fa214-797e-4a1e-964d-954971f6bdcc`. Retrying the same key returned the same request and 8/40.
- The agency batch used two previously unallocated fictional customers, creating requests `92690442-0776-4f16-8054-b5de829bd683` and `e1b9ee45-9224-488f-9c24-3b496777a15d`. Both remained `requested` with no order. A batch reusing a customer who already had an active request was rejected by the unique constraint; no partial allocation remained.
- Submitted 31 individually named synthetic QA pilgrims for another agency customer through the same RPC: request `ccd0c7b3-a156-495d-a746-130662a94df0`, reaching 39/40. Two disposable authenticated B2C sessions then raced for the final place. User 1 succeeded with request `61d17d6c-f30f-4dcd-bee7-b7b2716d156b`; user 2 received “Requests for this pool are closed.” Pool became `activation_pending`, 40/40, with exactly one activation event.
- Ran actual `processUmrahPools()` worker logic with QA Supabase and loopback Nodemailer capture. Activation returned `{activated:1,failed:0}`; expiry returned zero. The pool became `payment_open` at 40/40 with seven active requests, seven orders and seven invitations. Worker captured seven payment emails, routed four to customer portal links and three to agent portal links; it skipped six stale received notices. The capture file is private under `/tmp/sts-umrah-request-tests/activation-mail.json`; no email was forwarded. This is local worker orchestration, not proof that the deployed scheduler executes.
- Authenticated QA agent wallet: oversized 31-place payment rejected for insufficient agency balance, balance unchanged. Three-place request `ac5f894b-1659-4777-b7a5-6971975834e3` settled for USD 5,400. Agency credit balance moved from USD 505 to USD -4,895 against the existing USD 5,000 credit limit, exactly one wallet transaction was added, and request became paid.
- Authenticated customer A paid request `2faf2e09-c13b-4cec-a3a2-60384a53edc9` via local API `payments.initiate` with the QA-only simulated card method. One succeeded payment was recorded and request became paid. A replay returned “This order is not awaiting payment” and added no payment.
- Remaining live QA gates: browser payment controls/receipts, bank-proof review/approval and rejection, separate unpaid expiry/replacement fixture, browser mobile/error states, deployed scheduler, and external email provider delivery. Production remains untouched. Local API was stopped after the payment check.

- Final scoped QA rollup: two paid requests covering four pilgrims, five payment-due requests covering 36 pilgrims, and one withdrawn historical request covering two pilgrims. Active pilgrims total exactly 40; historical withdrawn places are excluded from the active 40-seat count.

## Browser payments, ownership and replacement — 18 November 2026

- Customer A browser: request `2faf2e09-c13b-4cec-a3a2-60384a53edc9` showed Booking confirmed, one pilgrim, USD 1,800 and no stale payment deadline. Its order `453d9de0-c6fd-4811-8832-dd1b70610dd4` rendered USD 1,800 paid, successful card payment, invoice `INV-2026-000034`, and the Umrah fulfillment timeline. Screenshots: `output/umrah-qa/customer-paid-request.png`, `output/umrah-qa/customer-paid-booking.png`.
- Customer B browser: active two-pilgrim request `c61fa214-797e-4a1e-964d-954971f6bdcc` showed USD 3,600 due, payment deadline and Pay now. Direct navigation to customer A's request returned 404 after fixing the UI's handling of an API NOT_FOUND response. Screenshots: `output/umrah-qa/customer-payment-due.png`, `output/umrah-qa/customer-isolation-404.png`.
- Agent browser: the 31-place unpaid invitation opened its order review, with USD 55,800 due and an agency wallet shortfall of USD 55,695. The existing-order review previously displayed the stale selected booking customer. Hiding `BookingContextBar` on `/agent/book/order/*` leaves the order's actual customer, QA Agent Flow 04, visible. Screenshot: `output/umrah-qa/agent-payment-shortfall.png`.
- Admin browser: package workspace showed 40/40 allocated, zero remaining and four paid pilgrims. Screenshot: `output/umrah-qa/admin-pool-40-paid-4.png`.
- QA latency exposed a three-second tRPC timeout on new Umrah request detail/list/admin views and existing customer/agent Umrah booking files. Those reads now have a 15-second request timeout. The paid detail and both customer and agent booking pages rendered after this change; unrelated default tRPC timeouts remain unchanged.
- Expired one unpaid fictional agency request `92690442-0776-4f16-8054-b5de829bd683` by advancing only its QA payment deadline. The first expiry sweep released one place (39/40); a second sweep released zero. The paid requests stayed intact. Admin browser showed one remaining and successfully opened replacement sales.
- Fictional replacement request `cc5088f7-9fb4-4b74-af80-51d4ae36c3b2` filled that place. Local worker processing created order `b17ee351-3b7a-4d17-95b6-a78bc96c8a4a` and a sent replacement invitation. The pool returned to 40/40. There are eight total payment invitation jobs: seven original plus one replacement. Loopback capture recorded the new invitation and expired notice without external delivery.
- ESLint passed for the edited timeout/booking pages. Web type check and remaining validation follow. Local browser tab and API/web services were closed; ports 3000/4000/2525 have no listeners.

- Final checks for this pass: `npx tsc --noEmit -p apps/web` passed; ESLint passed on all six edited web files; `git diff --check` passed. Direct browser retests validated the timeout and 404 corrections. Bank proof upload/rejection/approval, a dedicated formation-failure browser fixture, responsive viewport checks and deployed worker scheduling remain unverified.

## QA bank proof and correction gate — 18 November 2026

- Customer B opened order `3013b5a4-73e9-4549-92fa-64c93121ecec` from the two-pilgrim request. The checkout initially showed “temporarily unavailable” because the joined order read took 3.6 seconds against a 3-second tRPC timeout. Raised only this checkout read to 15 seconds; browser reload showed the USD 3,600 checkout and Bank Transfer option.
- The pool-generated order incorrectly showed an already-expired immediate-booking seat-hold notice. The checkout read now includes `pool_request_id` and omits that notice for pool requests. Its real payment deadline remains visible.
- Initiated the bank instruction flow in the isolated QA project. Uploaded a PNG that explicitly states “QA TEST ONLY - NO BANK TRANSFER”; proof `1911e41a-f8ac-417a-9a0a-b8ca366c865f` was submitted against payment `c992bb2b-70a6-47a3-99ff-a6a6f016749c`. Customer checkout showed “Transfer proof under review.” A scoped read confirmed request `payment_due`, payment `requires_action`, and pool 40/40: submission did not settle the booking or alter seats.
- The Umrah request detail previously treated bank instructions alone as “Payment under review.” It now checks for a submitted proof; pending instructions or a rejected proof keep the customer’s “Continue payment” link available. Added unit tests for both states and rebuilt the API. Browser confirmed the submitted state reads “Payment under review.”
- Admin opened order STS-2026-000084 in Orders & Payments and rejected the fictional file with the reason that no transfer occurred. Scoped QA read confirmed proof `rejected`, payment still `requires_action`, request still `payment_due`, and capacity still 40/40. Customer logged back in and saw the correction reason and “Submit corrected proof” control. No approval was attempted because no funds reached STS.
- API build and web type check passed. `node --test` passed the pool request service and bank review suites; `git diff --check` passed. Local browser proof and rejection were exercised against QA only. Real bank approval remains dependent on actual verified funds; deployed scheduler and external mail delivery remain unverified.
