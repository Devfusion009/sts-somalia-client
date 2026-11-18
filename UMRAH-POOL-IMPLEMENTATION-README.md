# Umrah pool: request seats, fill the group, then collect payment

Implementation handoff for the STS Somalia coding agent. Prepared 17 November 2026 against local commit `824cc01`.

**Deliverable status:** this is a source-reviewed implementation specification. The proposed workflow is not implemented or verified by this document. No package, image, request, payment or email was created in production during its preparation.

## 1. Objective and interpretation

Build one understandable Umrah pool workspace. An admin configures a package, its dated departure, capacity, price, included services, organizer and images. Customers and authorized agents request places at those published terms. Requests occupy places while the group forms. When all places are allocated, the system confirms the group and invites each applicant to pay. Verified full payment confirms that applicant's booking.

The latest request supersedes the earlier immediate-payment requirement **for new public pools using this workflow**. Preserve existing bookings and the private quotation/deposit workflow.

Capacity counts **pilgrims**, not customer accounts, requests or invoices. A 40-place pool with one pilgrim has **39 places remaining**, not 49. One customer requesting four pilgrims consumes four places. Display customer and request counts separately.

Use these distinct labels:

| Business event | Customer label | Payment allowed? |
| --- | --- | --- |
| Request accepted; group still forming | Awaiting group completion | No |
| Pool reaches capacity; invitation issued | Group confirmed — payment due | Yes, until its deadline |
| Provider settlement or verified manual payment covers full balance | Booking confirmed | No further payment if fully paid |
| Payment evidence submitted but not verified | Payment under review | No duplicate collection |
| Request withdrawn, expired or cancelled | Corresponding terminal status | No |

“Group confirmed” must never imply that an unpaid customer has a paid booking, an issued visa or a ticket. Keep payment, participation and fulfillment states separate.

### Proposed defaults for unspecified business decisions

Implement the following explicit defaults; document any agreed change before altering the state machine:

- The activation threshold equals capacity. No minimum smaller than capacity and no automatic partial-group activation in version 1.
- Valid requests are automatically accepted in submission order. Do not add a mandatory staff approval step.
- Payment window defaults to 48 hours, configured by admin before publication. A later invitation must still leave the full window before the operational payment cutoff.
- Formation closes at an explicit admin-selected timestamp. If the pool is not full then, cancel the unactivated requests and notify applicants; collect no money.
- Once activated, the group does not automatically revert to forming when someone withdraws or misses payment. Admin sees the shortfall and can open replacement places or cancel through the existing cancellation/refund workflow.
- No waitlist or partial acceptance of a family's request in version 1. Reject a request exceeding available places and show the current number available.
- One active request per booking owner/customer and departure. Provide a safe edit/cancel path before activation; HTTP retries never create another request.
- Private custom requests and agency-exclusive pools keep their current behavior in this release. Public B2B requests participate in the same new pool as B2C requests.
- No anonymous aggregate `offline_seats` edits for new request-first pools. Version 1 accepts named B2C/B2B requests only. Legacy offline inventory remains intact. Named staff-assisted/offline applications can be a subsequent feature.

## 2. Current system: verified source behavior

Paths below are relative to the repository root.

| Area | Current behavior and implementation |
| --- | --- |
| Admin workspace | `apps/web/src/app/admin/(portal)/umrah/pool/page.tsx` already combines package creation and capacity display. Its rows show confirmed/offline seats as filled and unpaid bookings as held. Detail is under `/admin/umrah/pool/[id]`; configuration components remain under `catalog/umrah`. Do not introduce another sidebar item. |
| Package setup | `apps/api/src/modules/umrah/services/package-admin.service.ts` creates a public package and first departure through `create_public_umrah_package`. Package details, hotels, sharing prices, itinerary, agencies and gallery already exist. |
| Database | `20261116000001_public_umrah_packages.sql` validates required details and forces public group full payment. `20261116000002_unified_umrah_pool.sql` adds organizer, visibility and assigned-agency restrictions. One **dated departure**, not a package spanning multiple dates, owns inventory. |
| Customer submission | `apps/web/src/modules/umrah/actions.ts` calls `umrah.createGroupBooking`, then sends public customers directly to `/checkout/[orderId]`. |
| API submission | `GroupBookingService.create` in `apps/api/src/modules/umrah/services/group-booking.service.ts` resolves agency/customer context, calls a booking RPC, creates an order separately and deletes the booking if order creation fails. This is not an atomic request-to-order transaction. |
| Agent flow | `apps/web/src/app/agent/(portal)/book/umrah/[slug]/page.tsx` reuses the public booking form. Multiple selected customers go through `apps/web/src/modules/agencies/batch-booking-actions.ts`, which currently handles individual orders and possible partial results. Audit this path explicitly. |
| Inventory | `20260917000001_umrah_seat_integrity.sql` owns `booked_seats` through booking insert/update/delete triggers, locks departure rows and counts pending/confirmed/completed/no-show group bookings. Availability currently subtracts booked and offline seats. |
| Expiry | `release_public_umrah_checkouts` releases abandoned public checkouts after 30 minutes, with special handling for payment processing/review. Catalog/detail/checkout/pool reads invoke cleanup. Other unpaid/stale-seat routines also exist. |
| Payment confirmation | `guard_public_umrah_payment` checks payment amount and checkout expiry. `umrah_confirm_group_bookings_on_payment` advances fully paid group bookings; `guard_public_umrah_confirmation` blocks early confirmation. Preserve the paid-booking meaning. |
| Public catalog | `umrah-catalog.service.ts`, `package.repository.ts`, package mapper and shared rules exclude unavailable public departures. Agency-assigned/private visibility has independent authorization. |
| Notifications | API `umrah-notify.service.ts` uses best-effort fire-and-forget delivery. `apps/web/src/lib/notifications/email-outbox.ts` explicitly skips the `umrah_` prefix. The generic outbox claim SQL has three-attempt and three-day limits. A new event name alone will not produce reliable Umrah email. |
| Fulfillment | Existing pilgrim documents, manifest, rooms, travel stages and voucher gates remain relevant after payment. `packages/shared-types/src/umrah/rules.ts` defines shared stages and voucher availability. |

This is code inspection, not an assertion that every path has passed a browser or live-provider test. The older `apps/api/test/public-umrah.md` describes immediate checkout; update that documentation with the implementation so two contradictory specifications do not remain.

## 3. Target customer, admin and agent journeys

### Admin

1. Open **Catalog & inventory → Umrah pool → Create pool**.
2. Enter all required package details and the first dated departure in one workflow. Save atomically; a failed capacity/date validation must not leave a partial package.
3. Upload images, choose the cover, preview the public package and publish after validation.
4. See `Requested 1 / 40`, `Remaining 39`, `Paid 0`, `1 request`, and `1 booking customer`. A request for three pilgrims must show three requested places, not one.
5. See the live applicant list with B2C/B2B source, agency where relevant, reference, pilgrim count, quoted total, request state, payment state, invitation deadline and notification delivery state.
6. At capacity, see the group activation and payment invitations. Paid seats increase only after settlement; requested/allotted seats must not double when orders are created.
7. Handle overdue payments, payment review, replacement places and cancellation from the same pool workspace. Preserve audit records.

### B2C customer

1. Browse available public pools and open a package.
2. See admin-configured dates, duration, organizer contact, itinerary summary, meals, flights, accommodation, transport, available places and per-person price. Show the exact total for the selected party and sharing option before submission.
3. Sign in, choose an offered departure/sharing option, enter the required traveler information, review terms and select **Request places**.
4. Receive a request reference and see **Awaiting group completion** in My Bookings, without checkout, money due, wallet debit or a paid invoice.
5. Once the group fills, receive an in-app notification and email, and see **Group confirmed — payment due**, a fixed amount, deadline and **Pay now**.
6. Pay through the existing supported payment workflow. A redirect/success page or uploaded bank receipt alone must not confirm the booking.
7. After verified full settlement, see **Booking confirmed**, the receipt and the existing fulfillment timeline. Existing travel-document gates still apply.

### B2B agent

Use the same prices/availability source and inventory transaction for public pools. Preserve agency ownership, permissions, selected customer, server-side markup rules and customer-facing totals. Do not treat the agent account as the actual traveling customer.

An agent may request a party for one customer or submit an explicitly grouped batch for multiple selected customers. The latter must either accept the entire requested seat count transactionally or return a clear failure with no partial allocation. Do not silently reuse the current partial-success booking loop. Individual requests keep separate references and later orders; link them with a batch identifier.

At activation the agent sees payment invitations and can use supported agency payment methods, including wallet, only then. Preserve per-customer receipts and existing commission eligibility; an unpaid request earns no commission. If an agency customer has no verified linked platform account, notify the agent and do not invent an account link based on matching email text.

## 4. Required package data and validation

Reuse existing fields instead of creating a second package model.

| Section | Required data |
| --- | --- |
| Identity | Package name, description, public/group type, visibility, currency |
| Dates | Departure and return dates, duration, Makkah/Madinah nights, request closing timestamp, final payment cutoff |
| Capacity | Positive integer total seats; activation target equals total seats |
| Price | Positive per-pilgrim rate; only configured sharing options; explicit taxes/fees/inclusions; currency precision |
| Accommodation | Hotels or clearly stated accommodation category, city, nights, room-sharing details |
| Services | Facilities, meals, flight arrangement, ground/intercity transport, included and excluded items |
| Organizer | Organization name, responsible person's name, phone and email; optional separately approved public agent contacts |
| Customer terms | Formation deadline, invitation payment window, cancellation/refund terms version, consent record |
| Media | At least one valid cover image before publication, descriptive alt text; optional gallery |

Rules:

- Inclusive duration is `return_date - departure_date + 1`. Nights must reconcile with accommodation/transit details; reject contradictory dates rather than silently changing duration.
- Require `formation_closes_at + payment_window <= payment_cutoff_at < departure_at` using a defined business timezone (`Africa/Mogadishu`) and UTC timestamps for persisted deadlines. Date-only trip dates stay date-only.
- Show only offered sharing options. Do not imply that 40 pilgrim places guarantees arbitrary single-room inventory; either honor the configured room allocation or constrain offered sharing options. Version 1 may use one offered sharing option.
- Calculate prices and fees on the server with decimal/minor-unit arithmetic. Never trust browser totals, agency IDs, owner IDs or status fields.
- Snapshot accepted currency, rate, sharing, fees, markup, dates and terms per request. Do not silently reprice an accepted request later.
- Freeze capacity, monetary terms, travel dates and booking mode after the first active request. For material changes, use explicit cancellation/re-offer with fresh acceptance; do not rewrite existing commitments. Nonmaterial corrections such as contact spelling remain audited.
- Validate in UI, API and database where appropriate. Database authorization remains authoritative.
- Do not add fabricated visa eligibility or guaranteed flight issuance claims. Operational travel requirements remain configured and reviewed through existing workflows.

## 5. Data model and state machines

### Extend the existing departure

Add a booking mode such as `immediate_payment | request_then_pay` on `umrah_package_departures`. Backfill every existing departure to `immediate_payment`; new public pools created through the redesigned form default to `request_then_pay`. Do not infer mode from whether the pool is currently paid/full. Existing private types/visibility are separate concepts.

Proposed additional fields: `formation_status`, `formation_closes_at`, `payment_window_hours`, `payment_cutoff_at`, `activated_at`, `replacement_sales_open`, and a state/version field for optimistic updates. Keep listing status and departure operational status independent.

Pool state transitions:

```text
draft → forming → activation_pending → payment_open → ready → completed
           │              │                  │
           └──────────────┴──────────────────┴──→ cancelled
```

- `forming`: published and accepting initial requests before the formation deadline.
- `activation_pending`: capacity reached; activation work is durably scheduled, new requests blocked.
- `payment_open`: invitations and payable orders created successfully.
- `ready`: all currently allocated participants are fully paid and capacity is filled. This is a group/payment milestone, not automatic visa or ticket issuance.
- Operational staff still controls travel readiness and completion through existing fulfillment rules. A cancellation that creates a shortfall can return `ready` to `payment_open`, with an audit event, but never undo received money.
- Draft formation state and published listing must be consistent; publish transitions formation to `forming`.

### Add a participation request entity

Suggested table: `umrah_pool_requests` with ID/reference, departure ID, requester/booked-by profile, B2C owner or agency/customer ownership, source, optional batch ID, pilgrim count, sharing, immutable quote/terms snapshot, lifecycle status, idempotency key/payload hash, timestamps, nullable linked booking/order IDs, invitation version, payment due timestamp and withdrawal/cancellation reason.

Store request travelers in a child table, with equivalent ownership protection to existing pilgrims. Only collect required request-stage information; documents remain private, and passport completion can follow existing fulfillment requirements. Copy/link traveler data into the existing pilgrim model during activation without losing identity or audit history.

Request transitions:

```text
requested → payment_due → paid
    │            │
    ├→ withdrawn ├→ withdrawn / expired
    └→ cancelled └→ cancelled
```

Payment processing/review state comes from payment attempts and evidence; it is not synonymous with `paid`. After payment, use the existing booking cancellation/refund path and record request cancellation only as part of its transaction. A refund alone does not imply a released seat unless the booking cancellation rules also release it.

Do not introduce prepayment requests as a generic unpaid order or the old `pending` group booking. They would be caught by existing expiry/payment logic. Create financial orders and fulfillment bookings at activation, not at initial interest submission.

### One inventory authority per mode

For `request_then_pay`, derive allocated seats from active requests in `requested`, `payment_due`, or `paid` states, including any in-flight payment protection. Terminal cancelled/withdrawn/expired requests do not allocate seats. Then:

```text
allocated = sum(active request pilgrim counts)
remaining = capacity - allocated
paid = sum(allocated pilgrims whose linked order has verified full settlement)
unpaid = allocated - paid
0 <= paid <= allocated <= capacity
```

Expose `allocated`, `remaining`, `paid`, `unpaid`, `request_count` and `customer_count` explicitly. Avoid “filled” without clarifying whether it means requests or payments. All public, admin and agent reads must use the same mode-aware inventory projection.

For legacy mode, retain existing booking/offline inventory. During request conversion, booking triggers must not reserve those seats a second time. Introduce a controlled request linkage and make the relevant booking seat triggers branch by departure mode; require the linked request on every request-first booking. Direct booking inserts must not bypass the request path. Do not just skip a trigger without adding the corresponding database invariants.

Audit every `booked_seats` consumer, including manifests, admin capacity edits and catalog mappers. A new computed count on only one screen is insufficient. Never mask negative inventory with `max(0, ...)` instead of detecting an invariant violation.

## 6. Transactions, activation and recovery

### Submit or amend a request

One database transaction must authenticate the caller, resolve ownership, lock the departure, check current mode/publication/deadline/access, verify available capacity and server-side price, persist the request/travelers and reserve its allocation. Apply a unique idempotency key scoped to the actor; the same key and payload returns the original response, while the same key with a changed payload conflicts.

Use a consistent lock order for all competing paths: departure, requests in stable ID order, orders, then payment rows. Read locking behavior in existing payment functions before implementation to avoid a new deadlock cycle. Amendments apply the seat-count delta atomically and cannot change terms after activation.

The last accepted request sets `activation_pending` and writes a unique activation event in the same transaction. If that transaction rolls back, neither allocation nor activation event survives. Use a unique event key based on departure and activation version. Two last-seat contenders must never both succeed.

### Activate the full group

A durable worker processes the event, not a browser page visit or a fire-and-forget promise. In a database transaction, recheck the pool is full and eligible, create exactly one booking/order/item per request using the frozen quote and existing order/fee/agency rules, link the rows, set invitation deadlines, enqueue notifications and transition the pool to `payment_open`.

Reuse/refactor the existing order creation semantics behind a transaction boundary; do not call today's multi-step `GroupBookingService.create` repeatedly and call it atomic. A failed activation must leave either no payable invitations or a fully consistent activated pool. Unique request-to-booking/order constraints make worker retries safe. For unusually large pools, if chunking is necessary, keep payment globally blocked until all activation rows are complete and the final activation transaction commits.

If a withdrawal happens before activation commits, lock and recheck capacity: return the pool to forming if still before its formation deadline, or cancel the unformed pool after it. Never invite the remaining applicants prematurely.

Check `now + payment_window <= payment_cutoff` when activation executes. If an outage has consumed that window, place activation in a visible staff-action failure state; do not shorten the promised window or send already expired invitations. Keep the reserved places until a staff decision; surface overdue activation to admins.

### Payment, expiry and replacement places

- Use the existing checkout/provider/manual/wallet flows only for an activated, owned, payable invitation with remaining balance. Enforce this in API and SQL, including direct RPC and manual payment paths.
- Keep existing public full-payment confirmation. Changing the time payment becomes available does not allow partial payment to confirm a booking.
- Request-first invitations expire by `payment_due_at`, not by order creation plus 30 minutes. Branch all public/legacy expiry functions by mode, including `release_public_umrah_checkouts`, `release_stale_umrah_seats`, `_expire_unpaid_umrah_orders`, agent holds and lazy catalog cleanup.
- At deadline, release only unpaid invitations with no unresolved processing/review payment. Reconcile uncertain provider outcomes and bank proofs; flag stale review for staff. Do not keep uncertain payments invisible forever or automatically release a seat that may already be paid.
- Serialize payment settlement against expiry/cancellation. If money arrives after allocation was irrevocably released and reused, record the funds for reconciliation/refund, alert staff, and do not auto-confirm or oversell. Test this explicitly.
- Provider webhooks must be authenticated and idempotent; repeat callbacks cannot duplicate money, seats, commission, invoices or notifications. Reuse existing provider integrations rather than adding fake success states.
- A released place after activation remains unavailable publicly until an admin opens replacement sales. A replacement request receives its own payment invitation immediately because the group is already activated; it must fit the same capacity, frozen offering and full payment window before cutoff. Earlier invitations are not reissued.
- Cancelling a paid booking invokes the existing approval/refund rules. Cancelling the whole group blocks new collection, closes unpaid invitations, and creates the appropriate review/refund work for received payments. Never erase ledger history or declare a refund complete before provider/ledger confirmation.

## 7. Notifications and email delivery

Required events: request received, group confirmed/payment due, payment reminder, request expired, group cancelled and verified payment received. Use separate event meanings and stable references.

Extend the existing notification outbox for explicit new Umrah event types, or implement one dedicated durable Umrah outbox. Choose **one owner per event**. Update the current `umrah_` skip logic deliberately; do not enable every old Umrah type and cause duplicates with the existing delivery service.

Persist event and recipient association in the transaction that changes state. Support retry/backoff, worker claim leases, failure visibility and an audited admin resend. Suppress stale invitations/reminders once paid, expired or cancelled. Existing generic three-day/three-attempt limits must not silently discard a valid payment invitation; escalate exhausted or overdue delivery to staff. Portal state must remain usable when email is unavailable.

Guarantee one logical event per request/invitation version. Do not claim SMTP provides exactly-once delivery: a crash after send but before acknowledgment can cause a retry. Use provider idempotency where available, stable message IDs and deduplication, and report the actual delivery guarantee.

Example payment invitation:

> Subject: Umrah group confirmed — payment due
>
> Your group for [package] on [departure date] is confirmed. Complete payment of [currency and amount] by [deadline and timezone] to confirm your [N] places.
>
> Reference: [request reference]
>
> [Open booking and pay]

The authenticated portal link must resolve on the correct customer/agent host and enforce ownership. Do not place passport details or bearer payment credentials in email. B2C goes to the account's verified contact; B2B goes to its authorized agency contact and, only where supported by verified linkage and consent, its customer. Test synthetic agent login email handling.

## 8. UI and authorization requirements

- Keep one Umrah pool entry in the admin sidebar. Within it, use clear package/departure context and applicant/payment tabs.
- Public cards show admin-configured starting price and true available places; detail computes the party total. Do not show applicants' names, email, passports or agency margins publicly.
- Hide full pools from new-request listings, while keeping an informative unavailable deep-link page and existing applicants' portal records accessible. If another departure is available, keep the package listed with that departure.
- Add request-only records to My Bookings and agent lists before an order exists. Do not require a fake order to render them. Suggested new detail routes: `/account/umrah/requests/[id]` and `/agent/umrah/requests/[id]`; link to existing order pages once activated.
- Provide a compact timeline: Requested → Group formed → Payment received → existing travel preparation. Use accurate status labels and accessible buttons, mobile layouts, keyboard focus and loading/error states.
- Respect `AGENTS.md` copy rules: avoid permanent helper paragraphs in internal console cards; use field labels, explicit statuses and concise validation errors.
- RLS: anonymous users see published permitted package information and safe aggregate counts only. Customers see their own requests/travelers; agency members see only authorized agency customers/requests; admin sees all. Customers cannot change prices, paid state, capacity, event delivery state or another applicant's ownership.
- Restrict mutation RPC grants and fix `search_path` for security-definer functions. Resolve trusted identity from the session. Never put service credentials into browser code or test output.
- Public package images and private traveler documents must use different storage policies. Validate upload type, size, content, package ownership and committed object existence; sanitize paths. Test cover reorder and failure recovery.

## 9. Implementation tasks and mandatory test gates

Work in order. For each task: implement a narrow change, add/run the listed behavioral tests, record command/result, resolve failures, then continue. Do not defer all testing until the last task. Static source-string checks alone do not prove financial or inventory correctness.

| Task | Deliverable | Tests required before moving on |
| --- | --- | --- |
| 01 — Baseline | Trace current B2C, B2B, private, payment, expiry and notification callers; capture current test results and mode boundaries. | Existing shared Umrah, public catalog, unified pool, private and agent tests; current isolated SQL integration. Record pre-existing failures without calling them passes. |
| 02 — Domain rules | Shared types, lifecycle transitions, seat math, deadline policy and frozen quote calculation. | 40−1=39; one family of four consumes four; invalid state transitions; currency rounding; exact capacity; timezone/deadline boundaries; partial payment never means paid. |
| 03 — Migration and access | Add mode/deadlines/requests/travelers/events, constraints, indexes and RLS with forward-only migrations. | Existing departures/bookings unchanged; new rows opt in; negative/zero invalid counts rejected; owner/agency/admin matrices; anonymous/direct-write attacks; private visibility; uniqueness. |
| 04 — Request transaction | Request/amend/withdraw RPCs, server pricing and batch behavior. | Retry returns same request; changed idempotency payload conflicts; forged price/agency rejected; two last-seat requests yield one winner; concurrent family sizes cannot oversell; batch failure rolls everything back; cancellation vs last-seat race. |
| 05 — Admin configuration | Unified create/edit/publish flow, dates, organizer, prices, images and request capacity view. | Missing mandatory fields; bad dates/contact/price; atomic creation failure; immutable accepted terms; image upload failure and cover change; no cross-package image mutation; counts distinguish seats/customers. |
| 06 — B2C journey | Public offer, request form and request-only account pages. | No checkout/payment before activation; selected rate and total correct; full pool hidden; unavailable direct link; another departure stays listed; owner isolation; form double-submit; load/error/empty/mobile states. |
| 07 — Agent journey | Agency/customer context, request batches, portal list and later order links. | Two agents share inventory; agent cannot impersonate another agency/customer; no initial wallet debit; all-or-nothing batch; separate customer references; markup snapshot; assigned private pools unchanged. |
| 08 — Activation | Durable last-seat event and transactional order/booking conversion. | Threshold reached once; no early invitation; interrupted worker recovery; retry no duplicate orders; request-to-booking conversion does not double seats; withdrawal race; insufficient payment window becomes staff action; event/order rollback on fault. |
| 09 — Notifications | Reliable event queue, templates, portal links, delivery tracking and resend. | Umrah events not silently skipped; no old/new double sending; SMTP failure/retry; lease recovery; expired invitations suppressed; stale queue surfaced; correct B2C/agent recipients; no sensitive email fields. |
| 10 — Payment lifecycle | Mode-aware guards, verified settlement and account/payment views. | Every supported method rejects preactivation; full balance confirms once; partial/failed/processing/manual review do not; webhook replay; wrong currency/amount; direct SQL/RPC attempt; wallet atomic debit and commission regression. |
| 11 — Expiry and cancellation | Formation closure, payment deadline job, reconciliation and replacement controls. | 30-minute sweeps do not release forming requests/invited seats early; exact deadline; unresolved payment protected; late success vs reallocated seat; before/after activation cancellation; paid refund path; replacement capacity and no duplicate original invitations. |
| 12 — Full QA acceptance | Complete fixture below across all roles, evidence and operational worker verification. | Actual browser submissions, upload, pool-fill event, email capture, sandbox payment, receipt, inventory, cancelled/expired scenarios, private regressions and clean environment teardown. |

Do not label a unit-tested UI “fully working” until SQL concurrency tests, worker tests and the authenticated browser journeys also pass.

## 10. Fictional QA pool and image plan

Create this fixture **in QA**, with a unique run suffix. Publish it to the QA public catalog. Do not advertise fabricated travel offers or contact real customers on production.

| Field | Fixture value |
| --- | --- |
| Name | QA — 14-Day Umrah Group — [run ID] |
| Organizer | STS QA Travel Team |
| Responsible person | Amina QA Coordinator |
| Email | umrah-coordinator@example.test, routed into the test mail sink |
| Phone | +1 202 555 0147, fictional test contact; disable outbound SMS/WhatsApp in QA |
| Route | MGQ → JED; return JED → MGQ |
| Dates | Choose departure 90 days after test start; return departure + 13 days |
| Duration/stay | 14 days; 8 Makkah nights + 5 Madinah nights |
| Capacity | 40 pilgrims |
| Price | USD 2,400 per pilgrim; quad sharing only; fixture taxes/fees explicitly configured to zero; expected total for two pilgrims USD 4,800 |
| Accommodation | QA Makkah Residence and QA Madinah Residence; fictional properties, standard quad rooms |
| Meals | Breakfast, lunch and dinner on the 13 accommodation nights |
| Flight arrangement | Return economy airfare, fictional QA carrier; no real ticket/PNR or claim of issued tickets |
| Transport | Airport transfers and Makkah–Madinah air-conditioned coach |
| Facilities | Wi-Fi, accessible common areas, group assistance desk; fixture descriptions only |
| Included | Flights, visa handling, hotel, transport, meals, ziyarat tours, guide as configured |
| Excluded | Personal purchases, room upgrades, extra baggage |
| Organizer support | Test email and telephone only; customer contact actions must not send external messages |
| Formation deadline | Departure − 30 days, 18:00 Africa/Mogadishu |
| Payment window/cutoff | 48 hours; cutoff departure − 7 days, 18:00 Africa/Mogadishu |
| Test terms | Request has no payment obligation before activation; pay invited amount within 48 hours; fixture cancellation terms explicitly identified as QA-only |

Itinerary: day 1 arrival/transfers; days 2–8 Makkah stay and arranged activities; day 9 transfer to Madinah; days 10–13 Madinah stay; day 14 return. Verify the night allocation and rendered dates, rather than inventing contradictory day numbers.

Generate four QA images with the available image-generation tool: Makkah exterior cover, Madinah exterior, fictional hotel room, and coach/group transport. Suggested targets: 1600×1000 cover and 1200×800 gallery images, each under 1 MB after appropriate export. These are desired targets, not an assertion of current uploader limits; inspect and enforce actual supported file limits. Use no fabricated airline/hotel logos, documents or recognizable customer faces. Mark their fixture purpose in metadata/captions and do not imply they depict contracted accommodation.

Upload through the real admin gallery flow into `umrah-images`, commit storage paths, set cover and verify public rendering/alt text. Keep an asset manifest with filename, path, size and hash. Do not bypass the UI upload by only inserting image URLs into SQL; direct fixture data is not evidence the upload works.

### End-to-end acceptance script

1. Log in as QA admin; create the complete 40-seat pool, upload all four images, choose cover, preview and publish. Confirm `0 / 40 allocated`, `40 remaining`, `0 paid`.
2. Sign in as QA customer A. Read public price/availability, request one place, and verify reference, snapshot and **Awaiting group completion**. Admin shows `1 / 40`, `39 remaining`, `0 paid`. No order/payment invitation exists yet.
3. Request two places as customer B. Admin shows `3 / 40`, `37 remaining`; customer B has two travelers and USD 4,800, but no payable balance yet. Confirm A cannot access B's details.
4. Use the QA agent to submit three places for one agency customer. Admin shows `6 / 40`, `34 remaining`, with B2B attribution. Wallet and commission totals are unchanged. Also exercise a separate multi-customer batch scenario.
5. Withdraw B's two places before activation: `4 / 40`, `36 remaining`. Resubmit B as an intentional new request after withdrawal: `6 / 40`, `34 remaining`. Retrying that submission must not create another request.
6. Add **33** named synthetic pilgrims using controlled QA fixture helpers through the same business RPC, bringing allocation to `39 / 40`. Do not fill by manipulating aggregate seat counters. Keep at least the customer/agent/UI journeys above as actual browser actions.
7. Race two one-place requests from separate sessions. Exactly one succeeds. Admin shows `40 / 40`, `0 remaining`, and exactly one activation event. The losing applicant sees a clear unavailable result.
8. Let the real configured worker process activation. Confirm one booking/order/invitation per active request, pool total still 40, no duplicate counts, and customer/agent portal payment controls appear. Verify actual rendered messages in a mail capture inbox; an `email_status` flag alone is insufficient.
9. Pay customer A's USD 2,400 using a sandbox/test provider. Verify server settlement, one receipt, booking confirmed, `paid=1`, `allocated=40`, and correct fulfillment gate. Refresh and replay a callback; totals do not change.
10. Pay the agent's three places using a QA wallet. Verify the exact configured debit, ownership and receipt; ensure the unpaid requests still show payment due. Test insufficient wallet balance without partial unintended debit.
11. Submit bank evidence for another invitation. Show payment under review, not confirmed. Approve it as admin, verify payment and audit actor; reject a separate proof and verify safe retry.
12. In a separate fixture with controlled time, expire an unpaid invitation. Confirm the released places, closed payment control and staff shortfall. Open replacement sales as admin and request/pay a replacement; no earlier customer gets another group-formed invitation.
13. Separately test unfilled formation expiry, full group cancellation, paid cancellation/refund, activation-worker failure, email outage and late settlement after seat reuse. Preserve evidence for each outcome.
14. Run the private quotation/deposit and legacy immediate-payment flows unchanged. Verify no new public request appears in a private agency catalog.
15. Archive only this run's fixture, stop its workers/servers and remove its test uploads when safe. Preserve audit/payment evidence and never delete unrelated data. Report any residual fixture records explicitly.

Use an injected clock or test-controlled timestamps for deadlines; do not wait 48 hours or change a production clock. Use a mail sink and sandbox payments. Do not claim sandbox tests verified real delivery, real bank reconciliation or real financial settlement.

## 11. Test execution and evidence

Existing baseline commands, run sequentially from the repository root:

```bash
npx tsc -p packages/shared-types
node packages/shared-types/test/public-umrah.test.mjs
node packages/shared-types/test/umrah.test.mjs
node apps/web/test/group-umrah-admin.test.cjs
node apps/web/test/private-umrah-packages.test.cjs
node apps/web/test/public-umrah-catalog.test.cjs
node apps/web/test/unified-umrah-pool.test.cjs
node apps/web/test/umrah-qa-regressions.test.cjs
node apps/web/test/agent-bookings.test.cjs
python3 apps/api/test/public-umrah-integration.py
npx tsc --noEmit -p apps/api
npx tsc --noEmit -p apps/web
```

Run ESLint on touched web/API files as well. If web type resolution requires refreshed API declarations, run the existing declaration-only compiler step. The Python integration runner starts an isolated temporary PostgreSQL cluster without a TCP listener and stops it in `finally`; it is not a live Supabase test.

Add new behavioral suites for request lifecycle, RLS, mode-aware inventory, concurrency, activation failures, email worker and payment/expiry races. Update existing expectations **only for explicitly new-mode fixtures**; keep legacy immediate-payment assertions. Run migrations against a clean test schema and a representative pre-change schema with existing paid/pending/private bookings.

For every task record: files changed, test names, exact commands, pass/fail/blocked result, unresolved limitations and relevant screenshot/log references. For Task 12 also record package/departure/request/order IDs, timestamps, expected vs actual seat counts, mail capture IDs and redacted sandbox transaction references. Never include credentials or real passport/payment data.

## 12. Release and rollback

Follow root `AGENTS.md`. Use new migrations; never edit merged migration history. Leave implementation changes uncommitted until the user requests commit/push. Apply/verify schema in QA before production and follow the existing main → production release process when authorized.

Use additive schema and a server-side creation feature flag. Deploy the new mode disabled, validate QA, then enable it for new public pools. Existing departures stay in legacy mode unless a separate, audited conversion is designed; this task must not convert live commitments automatically.

Verify the activation/outbox/deadline workers are actually scheduled in the deployed Docker/host environment. The existence of a Next.js route or `vercel.json` is not proof it runs. Require authenticated cron/worker invocation, surface failures and verify durable retry after restart. Production documentation already refers to host cron for Umrah housekeeping; extend the real deployed scheduler.

Production enablement gate: all task tests pass; QA browser evidence is complete; database backup/recovery path verified; secrets stay environment-specific; no fictional package is promoted into the live catalog.

Rollback first disables **new request-first pool creation/submission** while continuing to serve active requests, settlements, notifications and refunds. Do not deploy old code incapable of understanding active new-mode rows. Use a compatible forward fix or audited rollback migration, preserve all money/history, and explicitly reconcile any pending activation. Never reset the production database.

## 13. Final acceptance checklist

- [ ] Admin creates and publishes a complete, imaged pool through one workspace.
- [ ] Customer sees the admin's actual offer and current available places.
- [ ] One place in a 40-place pool leaves 39; multi-pilgrim requests count correctly.
- [ ] B2C and B2B requests share atomic inventory with no cross-tenant data access.
- [ ] No payment is accepted before activation; request-only records appear in both relevant portals.
- [ ] Full capacity generates one activation and one invitation per active request.
- [ ] Email delivery failures retry and remain visible; portal payment state does not depend on email success.
- [ ] Verified full payment confirms a booking exactly once; evidence submission alone does not.
- [ ] Unpaid expiry, payment races, cancellations and replacement places preserve capacity and ledger integrity.
- [ ] Legacy immediate-payment, private approvals/deposits, travel documents and agent accounting still pass.
- [ ] Browser, SQL concurrency, worker and payment tests have real evidence; blocked checks are disclosed.
- [ ] No invented production offer, real customer spam, leaked credentials or unintended financial transaction was used for testing.

The implementation agent's final report must separate implemented behavior, automated test evidence, browser evidence and unverified external integrations. “Fully functional” is not an acceptable substitute for those results.
