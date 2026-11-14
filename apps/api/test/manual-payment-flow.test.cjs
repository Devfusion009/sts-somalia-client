const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function load(relative, mocks) {
  const file = resolve(__dirname, relative);
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(dirname(file));
  const original = mod.require.bind(mod);
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : original(id);
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, experimentalDecorators: true },
  }).outputText, file);
  return mod.exports;
}
const { PaymentsService } = load('../src/modules/payments/payments.service.ts', {
  '../../infra/payment-config': {},
  '../../infra/supabase/rls-supabase.service': {},
  '../../infra/supabase/admin-supabase.service': {},
  '../orders/orders.service': {},
  './sifalo.service': {}, './waafi.service': {}, './registry': {}, './providers': {},
});

test('manual approval uses the authenticated, atomic database operation', async () => {
  const calls = [];
  const service = new PaymentsService({ get: () => ({ rpc: async (...args) => {
    calls.push(args);
    return { error: null };
  } }) }, { get: () => { throw new Error('Privileged direct writes are forbidden'); } });
  assert.deepEqual(await service.adminConfirmPayment('payment-id'), { ok: true });
  assert.deepEqual(calls, [['confirm_manual_payment', { p_payment_id: 'payment-id' }]]);
});

test('rejected approval reports its error rather than reporting payment success', async () => {
  const service = new PaymentsService({ get: () => ({ rpc: async () => ({ error: { message: 'This order is no longer awaiting payment.' } }) }) });
  await assert.rejects(service.adminConfirmPayment('payment-id'), /no longer awaiting payment/);
});

const { initiateWithProvider } = load('../src/modules/payments/providers.ts', {
  '../../infra/payment-config': { getPaymentGateways: async () => ({ bankTransfer: {
    bankName: 'Test Bank', accountName: 'STS', accountNumber: '123456',
  } }) },
  '../../infra/supabase/supabase-clients': {},
});
for (const id of ['cash_office', 'bank_transfer']) {
  test(`${id}: selection produces instructions, never a paid booking or receipt`, async () => {
    const result = await initiateWithProvider({ paymentId: 'payment-id', orderId: 'order-id', orderNumber: 'STS-TEST',
      amount: 52, currency: 'USD', method: { id, provider: 'manual' } });
    assert.equal(result.type, 'instructions');
    assert.match(result.instructions, /STS-TEST/);
    assert.match(result.instructions, /52\.00/);
  });
}

test('staff cannot bypass a pending manual payment by recording it a second time', async () => {
  const db = { from: table => {
    const query = {
      select: () => query, eq: () => query,
      maybeSingle: async () => ({ data: { id: 'order-id', total: 52, currency: 'USD', status: 'pending_payment' } }),
      limit: async () => ({ data: [{ id: 'pending-payment' }], error: null }),
      insert: () => { throw new Error('A second payment must not be inserted'); },
    };
    assert.ok(['orders', 'payments'].includes(table));
    return query;
  } };
  const service = new PaymentsService({}, { get: () => db });
  const result = await service.adminRecordPayment({ orderId: 'order-id', amount: 52, methodLabel: 'Cash' });
  assert.match(result.error, /Approve the pending payment/);
});

test('staff cannot record payment against a cancelled order', async () => {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { id: 'order-id', status: 'cancelled' } }) };
  const service = new PaymentsService({}, { get: () => ({ from: () => query }) });
  assert.match((await service.adminRecordPayment({ orderId: 'order-id', amount: 52 })).error, /not awaiting payment/);
});
