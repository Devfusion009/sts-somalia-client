require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const { createHmac } = require('node:crypto');
const Module = require('node:module');
const ts = require('typescript');
function load(file, mocks) {
  file = resolve(__dirname, file);
  const mod = new Module(file, module); mod.filename = file; mod.paths = Module._nodeModulePaths(dirname(file));
  const original = mod.require.bind(mod);
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : original(id);
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, experimentalDecorators: true } }).outputText, file);
  return mod.exports;
}
const id = '00000000-0000-4000-8000-000000000001';
const gateway = { merchantUid: 'test-merchant', apiUserId: 'test-user', apiKey: 'test-api', apiUrl: 'https://sandbox.waafipay.com/asm', environment: 'sandbox', webhookSecret: 'signing-test', hpp: { storeId: '1000000', hppKey: 'test-hpp' } };
const event = { event: 'authorization', merchant_uid: 'test-merchant', payment: { reference_id: id, transaction_id: 'tx-1', amount: 10, currency: 'USD', status: 'APPROVED' } };
function fixture({ attemptStatus = 'pending', mismatch = {}, rpcFailure = false } = {}) {
  let paid = false;
  const seen = new Set(), calls = [];
  const attempt = { reference_id: id, amount: 10, currency: 'USD', status: attemptStatus, ...mismatch };
  const db = {
    from(table) {
      const filters = {}, chain = {
        select() { return this; }, eq(key, value) { filters[key] = value; return this; },
        async maybeSingle() {
          if (table === 'waafi_receipts') return { data: paid ? { reference_id: id } : null, error: null };
          if (table === 'waafi_webhook_events') return { data: seen.has(filters.event_id) ? { event_id: filters.event_id } : null, error: null };
          if (table === 'waafi_payment_attempts') return { data: filters.reference_id === id && filters.environment === 'sandbox' && filters.merchant_uid === 'test-merchant' ? attempt : null, error: null };
          throw new Error(`Unexpected table: ${table}`);
        },
        async upsert(row) { seen.add(row.event_id); return { error: null }; },
      };
      return chain;
    },
    async rpc(name, args) {
      calls.push({ name, args });
      if (rpcFailure) return { error: { message: 'db unavailable' } };
      if (name === 'settle_waafi_transaction') { paid = true; attempt.status = 'succeeded'; if (args.p_event_id) seen.add(args.p_event_id); }
      if (name === 'fail_waafi_attempt') attempt.status = 'failed';
      if (name === 'record_waafi_review_event') seen.add(args.p_event_id);
      return { error: null };
    },
  };
  const { WaafiService } = load('../src/modules/payments/waafi.service.ts', { '../../infra/payment-config': { getWaafiForSettlement: async () => gateway } });
  return { service: new WaafiService({ get: () => db }), calls, attempt };
}

test('authorization is applied once for duplicate event IDs', async () => {
  const f = fixture();
  assert.equal(await f.service.processWebhook(event, 'event-1', gateway), 'paid');
  assert.equal(await f.service.processWebhook(event, 'event-1', gateway), 'ignored');
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].name, 'settle_waafi_transaction');
});
for (const [name, patch] of [['wrong amount', { amount: 9.99 }], ['wrong currency', { currency: 'EUR' }], ['no transaction', { transaction_id: '0' }]]) {
  test(`authorization rejects ${name}`, async () => {
    const f = fixture();
    await assert.rejects(() => f.service.processWebhook({ ...event, payment: { ...event.payment, ...patch } }, 'event-1', gateway));
    assert.equal(f.calls.length, 0);
  });
}
test('another merchant cannot settle a local payment', async () => {
  const f = fixture();
  assert.equal(await f.service.processWebhook({ ...event, merchant_uid: 'other-merchant' }, 'event-1', gateway), 'ignored');
  assert.equal(f.calls.length, 0);
});
test('late failure cannot overwrite an already-authorized payment', async () => {
  const f = fixture();
  await f.service.processWebhook(event, 'approved-event', gateway);
  assert.equal(await f.service.processWebhook({ ...event, event: 'declined', payment: { ...event.payment, status: 'FAILED' } }, 'late-failure', gateway), 'paid');
  assert.equal(f.calls.length, 1);
});
test('an open declined HPP lookup stays pending, but a signed final decline fails', async t => {
  const f = fixture();
  t.mock.method(global, 'fetch', async () => ({ ok: true, json: async () => ({ responseCode: '2001', params: { referenceId: id, transactionId: '0', amount: '10.00', currency: 'USD', status: 'Declined' } }) }));
  assert.equal(await f.service.settle(id), 'pending');
  assert.equal(f.calls.length, 0);
  assert.equal(await f.service.processWebhook({ ...event, event: 'declined', payment: { ...event.payment, status: 'DECLINED' } }, 'declined-event', gateway), 'failed');
  assert.equal(f.calls[0].name, 'fail_waafi_attempt');
});
test('refund and reversal events raise a review instead of crediting money', async () => {
  for (const name of ['refund', 'void']) {
    const f = fixture();
    assert.equal(await f.service.processWebhook({ ...event, event: name }, 'review-event', gateway), 'ignored');
    assert.equal(f.calls[0].name, 'record_waafi_review_event');
    assert.equal(await f.service.processWebhook({ ...event, event: name }, 'review-event', gateway), 'ignored');
    assert.equal(f.calls.length, 1);
  }
});
test('a database settlement failure is retriable and never acknowledged as paid', async () => {
  const f = fixture({ rpcFailure: true });
  await assert.rejects(() => f.service.processWebhook(event, 'event-1', gateway), /reconciliation/);
});
test('an unreachable provider stays pending rather than reporting a failed charge', async t => {
  const f = fixture();
  t.mock.method(global, 'fetch', async () => { throw new Error('timeout'); });
  assert.equal(await f.service.settle(id), 'pending');
  assert.equal(f.calls.length, 0);
});

function response() { return { code: null, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
function controller(service) {
  const { WaafiWebhookController } = load('../src/modules/payments/waafi-webhook.controller.ts', {
    '../../infra/payment-config': { getWaafiForSettlement: async () => gateway },
    './waafi.service': {},
  });
  return new WaafiWebhookController(service);
}
function request(body, signatureValid = true) {
  const rawBody = Buffer.from(JSON.stringify(body));
  const timestamp = String(Math.floor(Date.now() / 1000)), eventId = 'signed-event';
  const signature = createHmac('sha256', gateway.webhookSecret).update(`${timestamp}.${eventId}.`).update(rawBody).digest('hex');
  const headers = { 'x-webhook-timestamp': timestamp, 'x-webhook-event-id': eventId, 'x-webhook-signature-alg': 'HMAC-SHA256', 'x-webhook-signature': signatureValid ? signature : '0'.repeat(64) };
  return { body, rawBody, get(name) { return headers[name]; } };
}
test('unsigned registration ping acknowledges without touching a payment', async () => {
  const c = controller({ processWebhook() { assert.fail('ping must not settle'); } }), res = response();
  await c.handleWebhook(request({ event: 'webhook.test' }, false), res);
  assert.equal(res.code, 200);
});
test('invalid webhook signature is rejected before settlement', async () => {
  const c = controller({ processWebhook() { assert.fail('forged event must not settle'); } }), res = response();
  await c.handleWebhook(request(event, false), res);
  assert.equal(res.code, 401);
});
test('signed webhook acknowledges only after successful persistence', async () => {
  for (const fail of [false, true]) {
    let calls = 0;
    const c = controller({ async processWebhook() { calls++; if (fail) throw new Error('db unavailable'); } }), res = response();
    await c.handleWebhook(request(event), res);
    assert.equal(calls, 1);
    assert.equal(res.code, fail ? 503 : 200);
  }
});
