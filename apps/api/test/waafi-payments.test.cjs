const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(file, mocks) {
  file = resolve(__dirname, file);
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(dirname(file));
  const original = mod.require.bind(mod);
  mod.require = id => id === 'server-only' ? {} : Object.hasOwn(mocks, id) ? mocks[id] : original(id);
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText, file);
  return mod.exports;
}
const gateways = { waafi: { merchantUid: 'test', apiUserId: 'test', apiKey: 'test', apiUrl: 'https://sandbox.waafipay.com/asm', environment: 'sandbox', webhookSecret: 'test', hpp: null }, siteUrl: 'https://example.test' };
for (const [name, file, mocks] of [
  ['checkout', '../src/modules/payments/providers.ts', { '../../infra/payment-config': { getPaymentGateways: async () => gateways } }],
  ['wallet top-up', '../../web/src/modules/payments/providers.ts', { '@/lib/provider-runtime/payments': { getPaymentGateways: async () => gateways }, '@/lib/subdomain': { portalOrigin: () => '' } }],
]) {
  const adapter = load(file, { ...mocks,
    '@/lib/supabase/admin': { createAdminClient: () => ({ rpc: async () => ({ data: { claimed: true }, error: null }) }) },
    '../../infra/supabase/supabase-clients': { createAdminClient: () => ({ rpc: async () => ({ data: { claimed: true }, error: null }) }) },
  });
  for (const [state, expected] of [['APPROVED','success'], ['approved','success'], ['DECLINED','error'], ['FAILED','error'], ['CANCELLED','error'], ['PENDING','instructions'], [undefined,'instructions']]) {
    test(`${name}: 2001 with ${state} returns ${expected}`, async t => {
      let sent;
      t.mock.method(global, 'fetch', async (_url, options) => {
        sent = JSON.parse(options.body);
        return { ok: true, json: async () => ({ responseCode: '2001', params: { state, transactionId: 'test-transaction', referenceId: sent.serviceParams.transactionInfo.referenceId, txAmount: '10.00' } }) };
      });
      const input = { paymentId: 'payment', topupId: 'topup', orderId: 'order', orderNumber: 'TEST', agencyName: 'QA', amount: 10, currency: 'USD', description: 'QA', method: { provider: 'waafi' }, payerPhone: '+252611111111' };
      const result = name === 'checkout' ? await adapter.initiateWithProvider(input) : await adapter.initiateTopupWithProvider(input);
      assert.equal(result.type, expected);
      assert.equal(sent.serviceParams.payerInfo.accountNo, '252611111111');
    });
  }
  test(`${name}: HTTP failure stays pending without retrying a possible charge`, async t => {
    t.mock.method(global, 'fetch', async () => ({ ok: false, json: async () => ({ responseCode: '2001', params: { state: 'APPROVED', transactionId: 'x' } }) }));
    const result = await adapter.initiateWithProvider({ paymentId: 'p', orderId: 'o', orderNumber: 'r', amount: 1, currency: 'USD', method: { provider: 'waafi' }, payerPhone: '+252611111111' });
    assert.equal(result.type, 'instructions');
  });
}
