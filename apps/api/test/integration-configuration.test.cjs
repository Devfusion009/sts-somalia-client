const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(file, mocks) {
  file = resolve(__dirname, file); const mod = new Module(file, module);
  mod.filename = file; mod.paths = Module._nodeModulePaths(dirname(file)); const original = mod.require.bind(mod);
  mod.require = id => id === 'server-only' ? {} : Object.hasOwn(mocks, id) ? mocks[id] : original(id);
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText, file);
  return mod.exports;
}
const config = { DEPLOYMENT_ENV: 'qa', NODE_ENV: 'production', STRIPE_SECRET_KEY: 'env-test', STRIPE_WEBHOOK_SECRET: 'env-webhook', EDAHAB_API_KEY: 'env-test', EDAHAB_AGENT_CODE: 'env-agent', SIFALO_API_USER: 'env-user', SIFALO_API_KEY: 'env-test' };
for (const surface of ['api', 'web']) {
  const read = async (t, rows, error = null) => {
    t.mock.property(process, 'env', { ...config });
    const client = () => ({ from: () => ({ select: () => ({ eq: () => ({ abortSignal: async () => ({ data: rows, error }), maybeSingle: async () => ({ data: null }) }) }) }) });
    const mocks = { '../config/env': { env: () => config }, './supabase/supabase-clients': { createAdminClient: client }, './provider-credentials/crypto': { decryptCredentials: JSON.parse },
      '@/lib/supabase/admin': { createAdminClient: client }, '@/lib/integrations-crypto': { decryptCredentials: JSON.parse }, '@/lib/site-settings': { getBankTransfer: async () => ({}) }, react: { cache: f => f } };
    return load(surface === 'api' ? '../src/infra/payment-config.ts' : '../../web/src/lib/provider-runtime/payments.ts', mocks).getPaymentGateways();
  };
  test(`${surface}: explicitly disabled providers never fall back to leftover environment keys`, async t => {
    const result = await read(t, ['stripe', 'edahab', 'sifalo'].map(provider_key => ({ provider_key, is_active: false, credentials_encrypted: '{}' })));
    assert.equal(result.stripe, null); assert.equal(result.edahab, null); if (surface === 'api') assert.equal(result.sifalo, null);
  });
  test(`${surface}: database outage disables external payments instead of using another account`, async t => {
    const result = await read(t, null, { message: 'offline' });
    for (const key of ['stripe', 'razorpay', 'waafi', 'edahab']) assert.equal(result[key], null);
    if (surface === 'api') assert.equal(result.sifalo, null);
  });
  test(`${surface}: untouched legacy deployment still uses environment credentials`, async t => {
    const result = await read(t, []); assert.equal(result.stripe.secretKey, 'env-test'); assert.equal(result.edahab.agentCode, 'env-agent');
  });
  test(`${surface}: saved Stripe account cannot inherit a different environment webhook secret`, async t => {
    const result = await read(t, [{ provider_key: 'stripe', is_active: true, credentials_encrypted: JSON.stringify({ secret_key: 'saved-test' }) }]);
    assert.deepEqual(result.stripe, { secretKey: 'saved-test', webhookSecret: null });
  });
  test(`${surface}: undecryptable saved credentials remain disabled`, async t => {
    const result = await read(t, [{ provider_key: 'stripe', is_active: true, credentials_encrypted: 'broken' }]); assert.equal(result.stripe, null);
  });
}
const waafiConfig = { apiUrl: 'https://sandbox.waafipay.com/asm', merchantUid: 'test', hpp: { storeId: '1', hppKey: 'test' } };
const waafi = load('../../web/src/modules/admin/integrations/waafi-setup.ts', {
  '@sts/shared-types/dist/waafi-server': { resolveWaafiConfig: () => waafiConfig, validWaafiSiteUrl: () => true },
});
for (const [name, webhooks, secret, expected] of [
  ['matching default webhook', [{ url: 'https://sts.example.test/api/payments/waafi/webhook', eventType: null }], 'test', null],
  ['wrong site', [{ url: 'https://other.example.test/webhook' }], 'test', /Register a default/],
  ['authorization-only webhook', [{ url: 'https://sts.example.test/api/payments/waafi/webhook', eventType: 'authorization' }], 'test', /Register a default/],
  ['missing signing secret', [{ url: 'https://sts.example.test/api/payments/waafi/webhook' }], '', /signing secret/],
]) test(`Waafi activation: ${name}`, async t => {
  t.mock.property(process, 'env', { NEXT_PUBLIC_SITE_URL: 'https://sts.example.test', API_INTERNAL_URL: 'http://api:4000' });
  const calls = [];
  t.mock.method(global, 'fetch', async (_url, opts) => { calls.push(JSON.parse(opts.body).serviceName); return { ok: true, json: async () => ({ responseCode: '2001', params: { data: webhooks } }) }; });
  const result = await waafi.verifyWaafiWebhook({ webhook_secret: secret });
  if (expected) assert.match(result.error, expected); else assert.equal(result.error, null);
  assert.deepEqual(calls, ['WEBHOOK_LIST']);
});
test('manual flight retry requires supplier reconciliation before any database write', async () => {
  let writes = 0;
  const action = load('../../web/src/modules/flights/admin-actions.ts', { 'next/cache': { revalidatePath() {} }, '@/lib/auth/session': { requirePlatformAdmin: async () => {} }, '@/lib/supabase/admin': { createAdminClient: () => { writes++; throw new Error('must not write'); } } });
  const form = new FormData(); form.set('bookingId', '00000000-0000-4000-8000-000000000001');
  const result = await action.retryFlightTicketing(null, form);
  assert.match(result.error, /Confirm with the supplier/); assert.equal(writes, 0);
});
for (const [name, flight] of [
  ['supplier offer expired inside the local 30-minute window', { priced_at: new Date().toISOString(), raw_payload: { offer_expires_at: new Date(Date.now() - 1000).toISOString() } }],
  ['legacy offer passed its local hold', { priced_at: new Date(Date.now() - 31 * 60000).toISOString() }],
  ['supplier expiry is invalid', { priced_at: new Date().toISOString(), raw_payload: { offer_expires_at: 'invalid' } }],
]) test(`payment rejected before a charge: ${name}`, async () => {
  const db = { from(table) {
    const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { id: 'order', status: 'pending_payment' } }),
      then: done => Promise.resolve(done({ data: [{ flight_booking: { ticketing_status: 'awaiting_payment', ...flight } }] })),
      insert: () => assert.fail('expired fare must not create a payment'),
    };
    assert.ok(['orders', 'order_items'].includes(table)); return q;
  } };
  const { PaymentsService } = load('../src/modules/payments/payments.service.ts', {
    '@nestjs/common': { Injectable: () => target => target },
    '../../infra/payment-config': {}, '../../infra/supabase/rls-supabase.service': {}, '../../infra/supabase/admin-supabase.service': {},
    '../orders/orders.service': {}, './sifalo.service': {}, './waafi.service': {}, './registry': {}, './providers': {},
  });
  const result = await new PaymentsService({ get: () => db }, {}, {}, {}, {}).initiatePayment('user', { orderId: 'order', methodId: 'evc_plus' });
  assert.match(result.error, /fare has expired/);
});
for (const mode of ['sandbox', 'production']) test(`Hotelbeds ${mode} uses the matching supplier host`, async t => {
  t.mock.property(process, 'env', { DEPLOYMENT_ENV: mode === 'sandbox' ? 'qa' : 'production' });
  t.mock.method(global, 'fetch', async url => { assert.ok(url.startsWith(mode === 'sandbox' ? 'https://api.test.hotelbeds.com/' : 'https://api.hotelbeds.com/')); return { ok: true }; });
  const module = load('../../web/src/lib/provider-runtime/hotelbeds.ts', { './credentials': {}, '@/lib/redis': {} });
  const result = await module.testHotelbedsConnection('test-key', 'test-secret', mode); assert.equal(result.ok, true); assert.match(result.message, /search only/);
});
test('Hotelbeds test credentials are never sent to production', async t => {
  t.mock.property(process, 'env', { DEPLOYMENT_ENV: 'production' });
  t.mock.method(global, 'fetch', async () => assert.fail('must not send'));
  const module = load('../../web/src/lib/provider-runtime/hotelbeds.ts', { './credentials': {}, '@/lib/redis': {} });
  assert.equal((await module.testHotelbedsConnection('test-key', 'test-secret', 'sandbox')).ok, false);
});
