const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');
const out = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(
  readFileSync(resolve(__dirname, '../src/modules/payments/account.service.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, experimentalDecorators: true } },
).outputText)(id => id === '@nestjs/common' ? { Injectable: () => target => target } : {}, out, out.exports);
const { AccountPaymentsService } = out.exports;

function harness(responses) {
  const calls = [];
  const db = { from: table => {
    const query = { then: (yes, no) => Promise.resolve(responses[table] ?? { data: [], error: null }).then(yes, no) };
    for (const op of ['select', 'eq', 'or', 'in', 'neq', 'order']) query[op] = (...args) => { calls.push([table, op, ...args]); return query; };
    return query;
  } };
  return { service: new AccountPaymentsService({ get: () => db }), calls };
}
test('receipts use the caller-scoped client and include pending orders for balance calculations', async () => {
  const expected = [{ id: 'order', status: 'pending_payment' }];
  const { service, calls } = harness({ orders: { data: expected, error: null } });
  assert.deepEqual(await service.getMyReceipts('me'), expected);
  assert.ok(calls.some(call => call[1] === 'or' && call[2] === 'customer_id.eq.me,booked_by.eq.me'));
  assert.ok(calls.some(call => call[1] === 'select' && call[2].includes('booking_requests(kind, status, approved_amount, currency)')));
  assert.ok(!calls.some(call => call[1] === 'neq'));
});
test('saved wallets remain limited to the authenticated customer', async () => {
  const { service, calls } = harness({});
  assert.deepEqual(await service.getMySavedPaymentMethods('me'), []);
  assert.ok(calls.some(call => call[0] === 'payment_methods' && call[1] === 'eq' && call[2] === 'customer_id' && call[3] === 'me'));
});
test('refunds exclude agency-visible payments belonging to another customer', async () => {
  const payment = (id, customer_id, booked_by) => ({ id, orders: { customer_id, booked_by } });
  const { service, calls } = harness({ payments: { data: [payment('mine', 'me', 'agent'), payment('booked', 'other', 'me'), payment('foreign', 'other', 'agent')] } });
  assert.deepEqual((await service.getMyRefunds('me')).settled.map(p => p.id), ['mine', 'booked']);
  assert.ok(calls.some(call => call[0] === 'booking_requests' && call[1] === 'eq' && call[2] === 'requested_by' && call[3] === 'me'));
});
for (const [table, method] of [['orders', 'getMyReceipts'], ['payment_methods', 'getMySavedPaymentMethods'], ['payments', 'getMyRefunds'], ['booking_requests', 'getMyRefunds']]) {
  test(`${method}: ${table} errors cannot become an empty successful result`, async () => {
    const { service } = harness({ [table]: { data: null, error: { message: 'Database unavailable' } } });
    await assert.rejects(service[method]('me'), /could not be loaded/);
  });
}
