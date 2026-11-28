const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(file, mocks) {
  file = resolve(__dirname, file);
  const mod = new Module(file, module); mod.filename = file; mod.paths = Module._nodeModulePaths(dirname(file));
  const original = mod.require.bind(mod);
  mod.require = id => id === 'server-only' ? {} : Object.hasOwn(mocks, id) ? mocks[id] : original(id);
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText, file);
  return mod.exports;
}
const gateway = { merchantUid: 'test-merchant', apiUserId: 'test-user', apiKey: 'test-api', apiUrl: 'https://sandbox.waafipay.com/asm', environment: 'sandbox', webhookSecret: 'test', hpp: { storeId: '1000000', hppKey: 'test-hpp' } };
const topupId = '7e47c9c8-fdfe-41e1-b278-8716a5d87f82';
const method = { id: 'evc_plus', label: 'EVC Plus', provider: 'waafi' };
const admin = { createAdminClient: () => ({ rpc: async () => ({ data: { claimed: true }, error: null }) }) };

test('wallet top-up uses the hosted merchant and a verified-return URL', async t => {
  let body;
  t.mock.method(global, 'fetch', async (_url, options) => { body = JSON.parse(options.body); return { ok: true, json: async () => ({ responseCode: '2001', params: { directPaymentLink: 'https://sandbox.waafipay.com/hpp/token/test?r=1', orderId: 'hosted-order' } }) }; });
  const { initiateTopupWithProvider } = load('../src/modules/payments/providers.ts', {
    '@/lib/provider-runtime/payments': { getPaymentGateways: async () => ({ waafi: gateway, siteUrl: 'https://sts.example' }) },
    '@/lib/supabase/admin': admin, '@/lib/subdomain': { portalOrigin: () => 'https://agent.sts.example' },
  });
  const result = await initiateTopupWithProvider({ topupId, agencyName: 'Test', amount: 12.34, currency: 'USD', method, payerPhone: '+252 611-111111' });
  assert.equal(result.type, 'redirect');
  assert.equal(result.providerRef, 'hosted-order');
  assert.equal(body.serviceParams.transactionInfo.referenceId, topupId);
  assert.equal(body.serviceParams.storeId, 1000000);
  assert.equal(body.serviceParams.transactionInfo.amount, 12.34);
  assert.equal(body.serviceParams.payerInfo.subscriptionId, '252611111111');
  assert.equal(body.serviceParams.hppSuccessCallbackUrl, `https://agent.sts.example/finance/top-up/waafi-return?topupId=${topupId}`);
  assert.equal(body.serviceParams.hppFailureCallbackUrl, body.serviceParams.hppSuccessCallbackUrl);
});
test('wallet browser return delegates to the RLS-checked API instead of trusting callback fields', async () => {
  let received;
  const { reconcileWaafiTopup } = load('../src/modules/payments/waafi-topup.ts', {
    '@/lib/trpc/server': { getServerTrpcForActions: async () => ({ payments: { confirmWaafiTopup: { mutate: async input => { received = input; return 'paid'; } } } }) },
  });
  assert.equal(await reconcileWaafiTopup(topupId, 'own-agency'), 'success');
  assert.deepEqual(received, { topupId, agencyId: 'own-agency' });
});
test('an unavailable API never displays a completed wallet top-up', async () => {
  const { reconcileWaafiTopup } = load('../src/modules/payments/waafi-topup.ts', { '@/lib/trpc/server': { getServerTrpcForActions: async () => { throw new Error('offline'); } } });
  assert.equal(await reconcileWaafiTopup(topupId, 'own-agency'), 'pending');
});
test('WaafiPay connection test is read-only and rejects failed authentication', async t => {
  let service;
  t.mock.method(global, 'fetch', async (_url, options) => { service = JSON.parse(options.body).serviceName; return { ok: true, json: async () => ({ responseCode: '5001', errorCode: '1001' }) }; });
  const { testWaafiConnection, WAAFI_URLS } = load('../src/lib/provider-runtime/payments-test.ts', {});
  assert.equal((await testWaafiConnection({ environment: 'sandbox', merchant_uid: 'merchant', store_id: '1000000', hpp_key: 'key' })).ok, false);
  assert.equal(service, 'WEBHOOK_LIST');
  assert.equal(WAAFI_URLS.sandbox, 'https://sandbox.waafipay.com/asm');
});
test('missing encryption returns a clear error without database writes', async () => {
  let saved = false;
  const { saveIntegrationCredentials } = load('../src/modules/admin/integrations/actions.ts', {
    'next/navigation': {}, 'next/cache': {}, '@/lib/trpc/server': {}, '@/lib/supabase/server': { createClient: async () => { saved = true; } },
    '@/lib/supabase/admin': {}, '@/lib/auth/session': { requirePlatformAdmin: async () => ({}) },
    '@/lib/integrations-crypto': {}, '@/lib/provider-catalog': { getProvider: () => ({ key: 'waafi', credentialFields: [{ key: 'merchant_uid' }] }) },
    '@/lib/provider-runtime/payments-test': {}, '@/lib/provider-runtime/duffel': {}, '@/lib/provider-runtime/hotelbeds': {},
    '@/lib/provider-runtime/visa-check': {}, '@/modules/visa/partner/adapters/custom': {}, './waafi-setup': {}, './waafi-state': {},
  });
  const original = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  delete process.env.INTEGRATIONS_ENCRYPTION_KEY;
  try {
    const form = new FormData(); form.set('providerKey', 'waafi'); form.set('merchant_uid', 'merchant');
    assert.deepEqual(await saveIntegrationCredentials(null, form), { error: 'Credential storage is not configured.' });
    assert.equal(saved, false);
  } finally { if (original !== undefined) process.env.INTEGRATIONS_ENCRYPTION_KEY = original; }
});
test('customer checkout and wallet funding use the same hosted protocol', async t => {
  let body;
  t.mock.method(global, 'fetch', async (_url, options) => { body = JSON.parse(options.body); return { ok: true, json: async () => ({ responseCode: '2001', params: { directPaymentLink: 'https://sandbox.waafipay.com/hpp/token/test?r=2', orderId: 'hpp-order' } }) }; });
  const { initiateWithProvider } = load('../../api/src/modules/payments/providers.ts', {
    '../../infra/payment-config': { getPaymentGateways: async () => ({ waafi: gateway, siteUrl: 'https://sts.example' }) },
    '../../infra/supabase/supabase-clients': admin,
  });
  const result = await initiateWithProvider({ paymentId: topupId, orderId: 'order', orderNumber: 'STS-TEST', amount: 12.34, currency: 'USD', description: 'Test', method, payerPhone: '+252611111111' });
  assert.equal(result.type, 'redirect');
  assert.equal(body.serviceParams.transactionInfo.referenceId, topupId);
  assert.equal(body.serviceParams.hppSuccessCallbackUrl, `https://sts.example/checkout/order/success?order_id=${topupId}&gateway=waafi`);
});
test('checkout requires the phone number that HPP needs', async () => {
  const { getAvailablePaymentMethods } = load('../../api/src/modules/payments/registry.ts', { '../../infra/payment-config': { getPaymentGateways: async () => ({ waafi: gateway, testMode: false }) } });
  const methods = await getAvailablePaymentMethods();
  for (const id of ['evc_plus', 'zaad', 'sahal']) {
    assert.equal(methods.find(m => m.id === id).provider, 'waafi');
    assert.equal(methods.find(m => m.id === id).requiresPhone, true);
  }
});
