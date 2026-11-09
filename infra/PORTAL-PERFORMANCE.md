# Portal loading and Redis

Redis stores shared public catalogs, reference data, calendar holidays and public site settings. It never supplies a wallet balance, payment status, authorization decision, customer record or booking inventory. These remain live database reads with the user's access controls.

## Release

1. Apply `supabase/migrations/20261109000002_portal_payment_queue_summary.sql` to QA first. It replaces dashboard row downloads with one authorized database aggregate. It handles more than 1,000 bookings, successful partial payments and separate currencies. A missing-function fallback preserves the existing read path during rollout; other database errors are reported rather than displayed as zero balances.
2. Configure `REDIS_URL` for both services. QA currently runs web/API on different servers: both must reach the same Redis instance, with authentication and a private connection or TLS. `localhost` on separate servers means separate caches and cannot share invalidation. Production Compose already connects both containers to its internal Redis service. Keep Redis off the public internet.
3. Set matching `DEPLOYMENT_ENV` values and matching Supabase project URLs within each environment. The cache namespace includes both; QA and production must use their respective values. Empty `REDIS_URL` deliberately runs without a cache.
4. Deploy web and API in the same release batch. The version-2 cache format ignores older entries; existing entries expire naturally. No Redis flush or data deletion is required. Test QA before promoting to production.

## Cache behavior

- Public misses in one app instance share one source read. Cache entries have a jittered TTL. Live availability and dated/occupancy pricing are not cached.
- Each tag uses a random generation. A read and its tag metadata are captured atomically in Redis. A fill only writes if its generations still match. Invalidation cannot be undone by an older in-flight fill; metadata eviction also invalidates the old entry.
- Tags are not unbounded sets of expired keys. Invalidation advances a few tag generations without listing or deleting every catalog entry. The small Lua operations target the standalone Redis instances configured by this project.
- Cache commands time out after 250 ms. Repeated failures open a 30-second circuit breaker. A failed cache read falls back to the source without a second write attempt. Cold connections do not hold page reads in an offline queue.
- Gallery and site-setting edits await invalidation. Failed setting reads are not cached as fallback bank details or empty settings.
- Both calendars share Redis holiday data for 24 hours. Provider failures are not cached as an empty year or month.

## Page work

The agent shell streams optional account discovery, while membership/suspension checks still precede access. Account statuses are fetched in one query instead of one per program. The admin shell no longer fetches account-switching data that its admin account menu does not use. Supabase clients are reused within a server render, never across users.

## Verification

Run type checking and lint on the changed files. Source-based regression tests do not require app servers or builds:

- `node apps/api/test/redis-service.test.mjs` covers disabled/unavailable/cold Redis.
- `STS_TEST_REDIS_SOCKET=/tmp/sts-redis-performance-tests/redis.sock node apps/api/test/redis-service.test.mjs` also verifies actual Redis scripts, cross-app hits, a 20-request miss burst, invalidation races, metadata eviction, environment/project isolation, corrupt entries and TTLs. Only use the dedicated network-isolated test instance.
- `STS_TEST_POSTGRES_CONTAINER=sts-waafi-payment-tests node apps/api/test/portal-summary-database.test.cjs` creates a fresh fixture database and verifies the real migration with over 1,000 bookings, fresh payments, separate currencies and rejected access. It does not use QA or production.
- `node apps/web/test/portal-loading.test.mjs` verifies streaming and notification behavior.
- `node apps/web/test/portal-cache.test.cjs` verifies shared holiday reads, retry after provider failure, and batched account discovery.
- `node apps/web/test/agent-bookings.test.cjs` verifies filters, exports and the migration fallback.

After deployment, measure cold and repeat navigation on QA for Dashboard, Bookings, Customers, Wallet and Calendar. Check Redis hits/misses (`INFO stats`) on the deployed instance and confirm a catalog edit is visible in both services. Pause Redis in QA to confirm pages still work. Check a payment/top-up immediately afterward to confirm financial values remain current. Local cache timings are not a substitute for measuring the deployed portal.

Stop task-created test containers and services after verification; preserve all databases and volumes.
