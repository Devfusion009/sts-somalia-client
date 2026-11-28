# WaafiPay payments

This integration collects order payments and agency wallet funding into the STS merchant account. Mobile-money methods currently covered are EVC Plus, ZAAD and Sahal. Card acquiring is not advertised through WaafiPay without a documented, merchant-enabled card flow.

## Environment configuration

| Setting | QA | Production |
|---|---|---|
| `DEPLOYMENT_ENV` | `qa` | `production` |
| `WAAFI_ENVIRONMENT` | `sandbox` | `production` |
| Provider endpoint | `https://sandbox.waafipay.com/asm` | `https://api.waafipay.net/asm` |
| `PAYMENTS_TEST_MODE` | `false` | `false` |
| Supabase | QA project | Production project |
| Merchant credentials | Sandbox merchant | Live merchant |

The QA workflow and production Compose file set the deployment environment. A published deployment without an explicit environment stays disconnected. Local development cannot select the production gateway. The payment simulator is restricted to development.

Generate a cryptographically random key of at least 32 bytes. Set one persistent `INTEGRATIONS_ENCRYPTION_KEY` on both the web and API services within each environment. Use a different key between QA and production. Keep it in deployment secrets or the server's protected environment file. Do not generate a new key on every deploy: existing encrypted credentials would become unreadable.

For QA, the existing deployment workflow reads the repository secret `INTEGRATIONS_ENCRYPTION_KEY`. Production reads its own key from the production environment's `PROD_ENV_FILE`. No gateway credentials belong in Git, public environment variables, screenshots or logs.

Both sites need public HTTPS domains. The existing HTTP-only QA address can display the portals but cannot complete reliable HPP/webhook setup. Set `NEXT_PUBLIC_SITE_URL` to the HTTPS site origin and configure `NEXT_PUBLIC_API_URL`, API `WEB_ORIGIN`, and portal origins for that environment. The public API also needs HTTPS; `API_INTERNAL_URL` is reserved for an explicitly trusted private network, such as the production Docker network. Keep web/API credentials and Supabase projects aligned. Do not change QA to point at the production database.

Optional environment-only provisioning uses `WAAFI_MERCHANT_UID`, `WAAFI_API_USER_ID`, `WAAFI_API_KEY`, `WAAFI_STORE_ID`, `WAAFI_HPP_KEY`, and `WAAFI_WEBHOOK_SECRET`. A complete saved admin configuration takes precedence; disabled or unreadable saved credentials never fall back to another merchant's environment credentials. `WAAFI_API_URL`, if present, must exactly match that environment's official endpoint.

## Admin-only sandbox desk on the production website

Admin → Integrations → WaafiPay → Open sandbox test desk provides an isolated
HPP test flow, including on the production domain. It always uses
`https://sandbox.waafipay.com/asm` and the documented test wallet numbers.

The desk saves encrypted credentials under `waafi_sandbox_test`, with
`is_active=false`; the live `waafi` integration is never changed. Attempts
use per-admin `SBX-` references and encrypted credential snapshots in
project-scoped Redis with a one-hour expiry. If Redis is unavailable, the
request fails before gateway initiation. Repeated submissions use the same
reservation instead of starting another checkout.

The HTTPS return page verifies the reference, amount, currency and final
transaction status through `HPP_GETTRANINFO`. It ignores provider callback
claims and never registers a merchant webhook. No order, booking, wallet,
payment settlement or accounting write is part of this test path. Success
is labelled **Sandbox test approved**, never a real payment receipt.

The HTTP-only QA site can render the desk and validate credentials but cannot
launch hosted checkout; complete the isolated HPP test on an HTTPS domain.
No sandbox credential or test PIN belongs in source control. The normal
production checkout continues to reject sandbox credentials.

## Setup and release

1. Disable new WaafiPay payments and reconcile any legacy in-flight WaafiPay records before the cutover; do not fabricate receipts for old records. Apply `supabase/migrations/20261109000001_waafi_payment_reliability.sql` to QA first. It adds payment-attempt reservations, transaction receipts, webhook receipts, and atomic settlement functions. Deploy the web and API changes together.
2. In Admin → Integrations → WaafiPay, select Sandbox for QA and enter credentials issued for the sandbox merchant. Saving credentials disables the gateway until it is checked again. Existing in-flight payments must be resolved before changing the merchant, store or environment, or removing saved credentials. Keys for the same merchant/store may be repaired or rotated while confirmations remain pending. Disabling new payments preserves confirmations for already-started attempts.
3. Test the connection. This performs `WEBHOOK_LIST`; it never makes a test charge. Authentication failure remains a failure and cannot be activated.
4. Register the webhook. The web app registers `https://<site-origin>/api/payments/waafi/webhook`, stores WaafiPay's signing secret encrypted, and forwards signed requests without changing raw bytes to the API. The direct API endpoint is `/payments/waafi/webhook`.
5. If a merchant already has a webhook, review its destination in WaafiPay. The app will not overwrite another application or rotate its secret automatically. For the same existing URL, save its existing signing secret. If the secret was lost during an interrupted registration, recover/rotate it through the provider before enabling the gateway.
6. Enable WaafiPay. Activation checks HTTPS, the environment, a successful connection test, a signing secret, the database migration, and whether the API can decrypt the same saved credentials as the web app. Failed setup leaves payments disabled with an admin error.
7. Complete a small sandbox order payment and a wallet top-up using the provider's sandbox test accounts. Verify the order/invoice, wallet ledger, gateway transaction reference, and webhook receipt. Repeat a return and delivery: the wallet must still be credited once.
8. After QA acceptance and explicit approval to promote, apply the same migration to the production database and deploy through the production release flow. Configure the live merchant separately and register the live HTTPS callback. Production must never reuse the sandbox credentials or signing secret.

The credentials supplied during investigation returned authentication error `1001` at the documented sandbox endpoint. WaafiPay must confirm or replace that credential set; code changes cannot establish a successful provider transaction using rejected credentials.

## Confirmation and recovery

Each gateway call uses an STS payment/top-up UUID as both its request and merchant reference. The database reserves the attempt before contacting WaafiPay. Concurrent order payments and repeated submissions cannot initiate another charge for the same active attempt. Wallet submissions also carry a stable client intent key. Failed attempts may start a new intent; unknown network outcomes remain pending rather than being retried as new charges.

The hosted redirect is restricted to WaafiPay HTTPS domains in the correct environment. Browser query strings never establish success. Order and top-up returns re-check the provider through the authenticated API; customers can also check payment status and resume a cached hosted session.

Webhooks verify HMAC-SHA256 over `timestamp.event_id.raw_body`, use constant-time comparison, reject timestamps outside five minutes, and check the merchant and stored environment. Authorization requires the exact reference, amount, currency and transaction ID. Customers may only insert pending payment records; gateway settlement and manual confirmation remain server-authoritative. Settlement and receipt creation are a single database transaction. Provider transaction IDs cannot credit a second STS record, and duplicate events cannot credit a wallet twice.

An unrecorded settlement returns HTTP 503 so WaafiPay retries. A later failure cannot overwrite a recorded success. Unsigned registration pings never mutate payments. Refund and reversal events create a single finance-review notification, not another incoming payment or an automatic wallet debit. Reconcile these through the normal refund/accounting process.

The always-on API checks up to five pending attempts every minute. It does not issue another purchase. An attempt still unresolved after 15 minutes creates one admin review notification. Inspect the matching gateway reference and internal receipt before taking any manual action. Never mark a gateway payment paid merely because a customer returned to a success URL or uploaded a screenshot.

If authorization arrives after an order closed, its transaction is recorded but the cancelled/expired booking is not reopened. Finance receives a review notification. Resolve the receipt against a refund or an approved booking correction. Pending gateway payments cannot be manually confirmed as cash or replaced by an unverified charge.

## Verification

- Shared protocol: `node packages/shared-types/test/waafi-server.test.mjs`
- Gateway adapters: `node apps/api/test/waafi-payments.test.cjs`
- Signatures and settlement service: `node apps/api/test/waafi-service.test.cjs`
- Top-up/checkout wiring: `node apps/web/test/waafi-topup.test.cjs`
- Database migration and concurrent crediting: `WAAFI_TEST_CONTAINER=sts-waafi-payment-tests node apps/api/test/waafi-database.test.cjs`

The database test requires a dedicated, disposable PostgreSQL container named `sts-waafi-payment-tests` (or a suffixed variant). It creates its own isolated database and never connects to QA or production. The bootstrap loads the existing wallet request/settlement functions with a minimal local fixture schema, then applies and tests the actual new migration. Stop the test container when finished; preserve existing project databases and volumes.

## Provider documentation

- [API introduction and endpoints](https://docs.waafipay.com/api-introduction)
- [Hosted payments and transaction inquiries](https://docs.waafipay.com/hpp-api)
- [Signed webhooks, registration and retries](https://docs.waafipay.com/webhooks)
- [Sandbox test accounts](https://docs.waafipay.com/quickstart)
